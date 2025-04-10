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
 * Adds XP to a user, handles leveling up, and rewards
 */
async function addXpToUser(userId, guildId, client, pb) {
    // Get guild settings
    const settingsFilter = pb.filter(`guild_id = {:guild_id}`, { guild_id: guildId });
    const settings = await pb.collection('level_settings').getList(1, 1, { filter: settingsFilter });

    if (settings.totalItems === 0 || !settings.items[0].enabled) {
        return null; // Leveling disabled for this guild
    }

    const xpPerMessage = settings.items[0].xp_per_message || 20;
    const xpCooldown = settings.items[0].xp_cooldown || 60; // Seconds
    const notificationChannelId = settings.items[0].notification_channel_id;

    // Random XP between 75-125% of base amount to add variety
    const xpToAdd = Math.floor(xpPerMessage * (0.75 + Math.random() * 0.5));

    // Get user's current level data
    const userFilter = pb.filter(`guild_id = {:guild_id} && user_id = {:user_id}`,
        { guild_id: guildId, user_id: userId });
    const userData = await pb.collection('user_levels').getList(1, 1, { filter: userFilter });

    let userRecord;
    let oldLevel = 0;

    // Check cooldown and update or create record
    const now = new Date();

    if (userData.totalItems > 0) {
        userRecord = userData.items[0];
        oldLevel = calculateLevelFromXp(userRecord.xp);

        // Check cooldown
        const lastMessage = new Date(userRecord.last_message_time);
        const timeDiff = (now - lastMessage) / 1000; // in seconds

        if (timeDiff < xpCooldown) {
            return null; // On cooldown
        }

        // Update XP
        await pb.collection('user_levels').update(userRecord.id, {
            xp: userRecord.xp + xpToAdd,
            last_message_time: now.toISOString(),
        });

        userRecord.xp += xpToAdd;
    } else {
        // Create new record
        userRecord = await pb.collection('user_levels').create({
            guild_id: guildId,
            user_id: userId,
            xp: xpToAdd,
            level: 0,
            last_message_time: now.toISOString(),
        });
    }

    // Calculate new level
    const newLevel = calculateLevelFromXp(userRecord.xp);

    // Handle level-up
    if (newLevel > oldLevel) {
        // Update level in database
        await pb.collection('user_levels').update(userRecord.id, {
            level: newLevel,
        });

        // Send level-up notification if channel is set
        if (notificationChannelId) {
            try {
                const guild = await client.guilds.fetch(guildId);
                const member = await guild.members.fetch(userId);
                const channel = await guild.channels.fetch(notificationChannelId);

                if (channel) {
                    await channel.send({
                        content: `🎉 Congratulations ${member.toString()}! You leveled up to **Level ${newLevel}**!`
                    });
                }
            } catch (error) {
                console.error('Error sending level-up notification:', error);
            }
        }

        // Award role rewards if any
        await checkAndAwardRoles(userId, guildId, newLevel, client, pb);

        return {
            levelUp: true,
            oldLevel,
            newLevel,
        };
    }

    return {
        levelUp: false,
        level: newLevel,
        xp: userRecord.xp,
    };
}

/**
 * Checks and awards role rewards for a user at their current level
 */
async function checkAndAwardRoles(userId, guildId, userLevel, client, pb) {
    try {
        const rewardFilter = pb.filter(`guild_id = {:guild_id} && level <= {:level}`,
            { guild_id: guildId, level: userLevel });
        const rewards = await pb.collection('level_rewards').getList(1, 50, {
            filter: rewardFilter,
            sort: '+level'
        });

        if (rewards.totalItems === 0) {
            return; // No rewards to give
        }

        const guild = await client.guilds.fetch(guildId);
        const member = await guild.members.fetch(userId);

        // Award all roles up to and including the user's level
        for (const reward of rewards.items) {
            const role = guild.roles.cache.get(reward.role_id);
            if (role && !member.roles.cache.has(reward.role_id)) {
                await member.roles.add(reward.role_id);
            }
        }
    } catch (error) {
        console.error('Error awarding role rewards:', error);
    }
}

export {
    calculateXpForLevel,
    calculateLevelFromXp,
    calculateXpToNextLevel,
    addXpToUser,
    checkAndAwardRoles
};