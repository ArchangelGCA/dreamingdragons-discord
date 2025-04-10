// Cache for level settings by guild ID
const levelSettingsCache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes cache TTL
const userXpCache = new Map();
const USER_CACHE_TTL = 30 * 60 * 1000; // 30 minutes cache TTL
const pendingUpdates = new Map();
const UPDATE_BATCH_INTERVAL = 60 * 1000; // Flush updates every minute

/**
 * Calculates the total XP required for a specific level
 * Uses a non-linear formula: 100 * (level^1.5)
 */
function calculateXpForLevel(level) {
    return Math.round(100 * Math.pow(level, 1.5));
}

/**
 * Calculates the level based on XP amount
 */
function calculateLevelFromXp(xp) {
    // Start at level 0 and work up
    let level = 0;
    let xpForNextLevel = calculateXpForLevel(level + 1);

    while (xp >= xpForNextLevel) {
        level++;
        xpForNextLevel += calculateXpForLevel(level + 1);
    }

    return level;
}

/**
 * Calculates how much XP is needed to reach the next level
 */
function calculateXpToNextLevel(xp) {
    const currentLevel = calculateLevelFromXp(xp);
    let totalXpNeeded = 0;

    for (let i = 1; i <= currentLevel + 1; i++) {
        totalXpNeeded += calculateXpForLevel(i);
    }

    return totalXpNeeded - xp;
}

/**
 * Gets level settings for a guild, using cache when possible
 */
async function getLevelSettings(guildId, pb, forceRefresh = false) {
    const now = Date.now();
    const cachedSettings = levelSettingsCache.get(guildId);

    // Return cached settings if they exist and are not expired
    if (!forceRefresh && cachedSettings && now - cachedSettings.timestamp < CACHE_TTL) {
        return cachedSettings.settings;
    }

    // Fetch settings from database
    const settingsFilter = pb.filter(`guild_id = {:guild_id}`, { guild_id: guildId });
    const settings = await pb.collection('level_settings').getList(1, 1, { filter: settingsFilter });

    // Cache the settings with timestamp
    if (settings.totalItems > 0) {
        levelSettingsCache.set(guildId, {
            settings: settings.items[0],
            timestamp: now
        });
        return settings.items[0];
    }

    return null;
}

/**
 * Invalidates the settings cache for a guild
 */
function invalidateLevelSettingsCache(guildId) {
    levelSettingsCache.delete(guildId);
}

/**
 * Adds XP to a user, handles leveling up, and rewards
 */
async function addXpToUser(userId, guildId, client, pb) {
    // Get guild settings from cache when possible
    const settings = await getLevelSettings(guildId, pb);

    // Early return if leveling is disabled
    if (!settings || !settings.enabled) {
        return null;
    }

    const xpPerMessage = settings.xp_per_message || 20;
    const xpCooldown = settings.xp_cooldown || 60; // Seconds
    const notificationChannelId = settings.notification_channel_id;

    // Create unique key for this user in this guild
    const cacheKey = `${guildId}-${userId}`;
    const now = Date.now();

    // Check if user is in cache and not expired
    let userData = userXpCache.get(cacheKey);
    if (userData && (now - userData.cacheTime) > USER_CACHE_TTL) {
        // Cache expired, remove it
        userXpCache.delete(cacheKey);
        userData = null;
    }

    // Random XP between 75-125% of base amount
    const xpToAdd = Math.floor(xpPerMessage * (0.75 + Math.random() * 0.5));

    let leveledUp = false;
    let oldLevel = 0;
    let newLevel = 0;

    if (!userData) {
        // Not in cache, fetch from database
        const userFilter = pb.filter(`guild_id = {:guild_id} && user_id = {:user_id}`,
            { guild_id: guildId, user_id: userId });
        const result = await pb.collection('user_levels').getList(1, 1, { filter: userFilter });

        if (result.totalItems > 0) {
            // Existing user
            userData = {
                id: result.items[0].id,
                xp: result.items[0].xp,
                level: calculateLevelFromXp(result.items[0].xp),
                lastMessageTime: new Date(result.items[0].last_message_time).getTime(),
                lastDbSync: now,
                cacheTime: now // Add timestamp when this was cached
            };
        } else {
            // New user
            userData = {
                id: null,
                xp: 0,
                level: 0,
                lastMessageTime: 0,
                lastDbSync: 0,
                cacheTime: now
            };
        }

        // Add to cache
        userXpCache.set(cacheKey, userData);
    }

    // Check cooldown
    if ((now - userData.lastMessageTime) < (xpCooldown * 1000)) {
        return null; // On cooldown
    }

    // User passed cooldown, update cached data
    oldLevel = userData.level;
    userData.xp += xpToAdd;
    userData.lastMessageTime = now;
    userData.level = calculateLevelFromXp(userData.xp);
    newLevel = userData.level;
    leveledUp = newLevel > oldLevel;

    // Schedule database update
    scheduleUserUpdate(cacheKey, userData, guildId, userId, pb);

    // Handle level-up immediately if needed
    if (leveledUp) {
        // Force immediate database update on level-up
        await syncUserToDatabase(userData, guildId, userId, pb);

        // Send notification if configured
        if (notificationChannelId) {
            try {
                const guild = await client.guilds.fetch(guildId);
                const member = await guild.members.fetch(userId);
                const channel = await guild.channels.fetch(notificationChannelId);

                if (channel) {
                    await channel.send({
                        content: `Congratulations ${member}! You've reached **Level ${newLevel}**!`
                    });
                }
            } catch (error) {
                console.error('Error sending level-up notification:', error);
            }
        }

        // Award role rewards
        await checkAndAwardRoles(userId, guildId, newLevel, client, pb);
    }

    return {
        leveledUp,
        oldLevel,
        newLevel,
        xpGained: xpToAdd
    };
}

/**
 * Check and award any level-based role rewards
 */
async function checkAndAwardRoles(userId, guildId, userLevel, client, pb) {
    try {
        // Get all level rewards for this guild
        const filter = pb.filter(`guild_id = {:guild_id} && level <= {:level}`,
            { guild_id: guildId, level: userLevel });

        const rewards = await pb.collection('level_rewards').getFullList({
            filter,
            sort: '+level'
        });

        if (rewards.length === 0) {
            return; // No rewards to give
        }

        // Get the user's member object
        const guild = await client.guilds.fetch(guildId);
        const member = await guild.members.fetch(userId);

        // Award all roles the user qualifies for but doesn't have yet
        for (const reward of rewards) {
            // Check if user already has this role
            if (!member.roles.cache.has(reward.role_id)) {
                try {
                    await member.roles.add(reward.role_id);
                    console.log(`Awarded role ${reward.role_id} to user ${userId} for reaching level ${reward.level}`);
                } catch (roleError) {
                    console.error(`Failed to award role ${reward.role_id}:`, roleError);
                }
            }
        }
    } catch (error) {
        console.error('Error checking/awarding level roles:', error);
    }
}

/**
 * Schedule a user update to be processed in batch
 */
function scheduleUserUpdate(cacheKey, userData, guildId, userId, pb) {
    pendingUpdates.set(cacheKey, { userData, guildId, userId });

    // Set up the batch update interval if not already running
    if (!global.xpUpdateInterval) {
        global.xpUpdateInterval = setInterval(() => processPendingUpdates(pb), UPDATE_BATCH_INTERVAL);

        // Ensure interval is cleared on process exit
        process.on('exit', () => {
            if (global.xpUpdateInterval) {
                clearInterval(global.xpUpdateInterval);
            }
        });
    }
}

/**
 * Process all pending user updates in batch
 */
async function processPendingUpdates(pb) {
    if (pendingUpdates.size === 0) return;

    console.log(`Processing ${pendingUpdates.size} pending XP updates`);

    const updates = [...pendingUpdates.entries()];
    pendingUpdates.clear();

    for (const [cacheKey, { userData, guildId, userId }] of updates) {
        try {
            await syncUserToDatabase(userData, guildId, userId, pb);
        } catch (error) {
            console.error(`Error updating XP for user ${userId} in guild ${guildId}:`, error);
            // Put failed update back in queue
            pendingUpdates.set(cacheKey, { userData, guildId, userId });
        }
    }
}

/**
 * Sync a user's XP data to the database
 */
async function syncUserToDatabase(userData, guildId, userId, pb) {
    const now = new Date();

    if (userData.id) {
        // Update existing record
        await pb.collection('user_levels').update(userData.id, {
            xp: userData.xp,
            level: userData.level,
            last_message_time: now.toISOString()
        });
    } else {
        // Create new record
        const newRecord = await pb.collection('user_levels').create({
            guild_id: guildId,
            user_id: userId,
            xp: userData.xp,
            level: userData.level,
            last_message_time: now.toISOString()
        });

        // Update cache with the new record ID
        userData.id = newRecord.id;
    }

    userData.lastDbSync = Date.now();
}

/**
 * Clean up expired user cache entries
 */
function cleanupExpiredUserCache() {
    const now = Date.now();
    for (const [key, userData] of userXpCache.entries()) {
        if ((now - userData.cacheTime) > USER_CACHE_TTL) {
            userXpCache.delete(key);
        }
    }
}

// Periodic cache cleanup
setInterval(cleanupExpiredUserCache, USER_CACHE_TTL / 2);

export {
    calculateXpForLevel,
    calculateLevelFromXp,
    calculateXpToNextLevel,
    invalidateLevelSettingsCache,
    addXpToUser,
    checkAndAwardRoles
};