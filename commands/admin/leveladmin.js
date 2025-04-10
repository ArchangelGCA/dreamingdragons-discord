import {SlashCommandBuilder, PermissionsBitField, EmbedBuilder} from 'discord.js';
import {calculateLevelFromXp, calculateXpForLevel, checkAndAwardRoles} from '../../utils/leveling.js';

export default {
    data: new SlashCommandBuilder()
        .setName('leveladmin')
        .setDescription('Manage the server leveling system')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Configure the leveling system')
                .addChannelOption(option =>
                    option.setName('notification_channel')
                        .setDescription('Channel for level-up notifications')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('xp_per_message')
                        .setDescription('Base XP rewarded per message (default: 20)')
                        .setMinValue(1)
                        .setMaxValue(100)
                        .setRequired(false))
                .addIntegerOption(option =>
                    option.setName('xp_cooldown')
                        .setDescription('Seconds between XP rewards (default: 60)')
                        .setMinValue(10)
                        .setMaxValue(600)
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('setreward')
                .setDescription('Set a role reward for reaching a level')
                .addIntegerOption(option =>
                    option.setName('level')
                        .setDescription('Level required to earn this role')
                        .setMinValue(1)
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Role to award')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('removereward')
                .setDescription('Remove a level role reward')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Role to remove from rewards')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('resetuser')
                .setDescription('Reset a user\'s level data')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to reset')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('enable')
                .setDescription('Enable the leveling system'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Disable the leveling system'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('sync')
                .setDescription('Sync user roles with their levels'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('migrateroles')
                .setDescription('Grant XP to users based on level roles they already have'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('setlevel')
                .setDescription('Set a user\'s level manually')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to set level for')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('level')
                        .setDescription('Level to set for the user')
                        .setMinValue(1)
                        .setRequired(true))),

    async execute(interaction, pb) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'setup':
                await handleSetup(interaction, pb);
                break;
            case 'setreward':
                await handleSetReward(interaction, pb);
                break;
            case 'removereward':
                await handleRemoveReward(interaction, pb);
                break;
            case 'resetuser':
                await handleResetUser(interaction, pb);
                break;
            case 'enable':
                await handleToggle(interaction, pb, true);
                break;
            case 'disable':
                await handleToggle(interaction, pb, false);
                break;
            case 'sync':
                await handleSync(interaction, pb);
                break;
            case 'migrateroles':
                await handleMigrateRoles(interaction, pb);
                break;
            case 'setlevel':
                await handleSetLevel(interaction, pb);
                break;
            default:
                await interaction.reply({content: 'Unknown subcommand', ephemeral: true});
        }
    }
};

async function handleSetup(interaction, pb) {
    await interaction.deferReply({ephemeral: true});

    const notificationChannel = interaction.options.getChannel('notification_channel');
    const xpPerMessage = interaction.options.getInteger('xp_per_message') || 20;
    const xpCooldown = interaction.options.getInteger('xp_cooldown') || 60;

    try {
        // Check if settings already exist
        const filter = pb.filter(`guild_id = {:guild_id}`, {guild_id: interaction.guildId});
        const existingSettings = await pb.collection('level_settings').getList(1, 1, {filter});

        if (existingSettings.totalItems > 0) {
            // Update existing settings
            await pb.collection('level_settings').update(existingSettings.items[0].id, {
                notification_channel_id: notificationChannel.id,
                xp_per_message: xpPerMessage,
                xp_cooldown: xpCooldown,
                enabled: true
            });
        } else {
            // Create new settings
            await pb.collection('level_settings').create({
                guild_id: interaction.guildId,
                notification_channel_id: notificationChannel.id,
                xp_per_message: xpPerMessage,
                xp_cooldown: xpCooldown,
                enabled: true
            });
        }

        await interaction.editReply(`✅ Leveling system configured successfully:
• Level-up notifications will be sent to ${notificationChannel}
• Base XP per message: ${xpPerMessage} (varies ±25%)
• XP cooldown: ${xpCooldown} seconds`);

    } catch (error) {
        console.error('Error setting up level system:', error);
        await interaction.editReply('❌ Failed to set up the leveling system.');
    }
}

async function handleSetReward(interaction, pb) {
    await interaction.deferReply({ephemeral: true});

    const level = interaction.options.getInteger('level');
    const role = interaction.options.getRole('role');

    // Check if role is manageable by the bot
    if (role.managed || role.position >= interaction.guild.members.me.roles.highest.position) {
        return interaction.editReply('❌ I cannot assign this role. It may be managed by an integration or higher than my highest role.');
    }

    try {
        // Check if reward already exists
        const filter = pb.filter(`guild_id = {:guild_id} && level = {:level}`,
            {guild_id: interaction.guildId, level});
        const existingReward = await pb.collection('level_rewards').getList(1, 1, {filter});

        if (existingReward.totalItems > 0) {
            // Update existing reward
            await pb.collection('level_rewards').update(existingReward.items[0].id, {
                role_id: role.id
            });
        } else {
            // Create new reward
            await pb.collection('level_rewards').create({
                guild_id: interaction.guildId,
                level: level,
                role_id: role.id
            });
        }

        await interaction.editReply(`✅ Role reward set: ${role} will be awarded at level ${level}`);

    } catch (error) {
        console.error('Error setting level reward:', error);
        await interaction.editReply('❌ Failed to set level reward.');
    }
}

async function handleRemoveReward(interaction, pb) {
    await interaction.deferReply({ephemeral: true});

    const role = interaction.options.getRole('role');

    try {
        // Find reward with this role
        const filter = pb.filter(`guild_id = {:guild_id} && role_id = {:role_id}`,
            {guild_id: interaction.guildId, role_id: role.id});
        const existingReward = await pb.collection('level_rewards').getList(1, 1, {filter});

        if (existingReward.totalItems === 0) {
            return interaction.editReply(`❌ No level reward found for the role ${role.name}.`);
        }

        // Delete the reward
        await pb.collection('level_rewards').delete(existingReward.items[0].id);

        await interaction.editReply(`✅ Level reward removed for role ${role.name}`);

    } catch (error) {
        console.error('Error removing level reward:', error);
        await interaction.editReply('❌ Failed to remove level reward.');
    }
}

async function handleResetUser(interaction, pb) {
    await interaction.deferReply({ephemeral: true});

    const user = interaction.options.getUser('user');

    try {
        // Find user data
        const filter = pb.filter(`guild_id = {:guild_id} && user_id = {:user_id}`,
            {guild_id: interaction.guildId, user_id: user.id});
        const userData = await pb.collection('user_levels').getList(1, 1, {filter});

        if (userData.totalItems === 0) {
            return interaction.editReply(`❌ ${user.username} doesn't have any level data to reset.`);
        }

        // Delete the user data
        await pb.collection('user_levels').delete(userData.items[0].id);

        await interaction.editReply(`✅ Level data reset for ${user.username}`);

    } catch (error) {
        console.error('Error resetting user level:', error);
        await interaction.editReply('❌ Failed to reset user level data.');
    }
}

async function handleToggle(interaction, pb, enable) {
    await interaction.deferReply({ephemeral: true});

    try {
        // Check if settings exist
        const filter = pb.filter(`guild_id = {:guild_id}`, {guild_id: interaction.guildId});
        const existingSettings = await pb.collection('level_settings').getList(1, 1, {filter});

        if (existingSettings.totalItems === 0) {
            return interaction.editReply('❌ Please use `/leveladmin setup` first to configure the leveling system.');
        }

        // Update enabled status
        await pb.collection('level_settings').update(existingSettings.items[0].id, {
            enabled: enable
        });

        await interaction.editReply(`✅ Leveling system ${enable ? 'enabled' : 'disabled'}.`);

    } catch (error) {
        console.error(`Error ${enable ? 'enabling' : 'disabling'} level system:`, error);
        await interaction.editReply(`❌ Failed to ${enable ? 'enable' : 'disable'} the leveling system.`);
    }
}

async function handleSync(interaction, pb) {
    await interaction.deferReply({ephemeral: true});

    try {
        // Get all users with level data
        const userFilter = pb.filter(`guild_id = {:guild_id}`, {guild_id: interaction.guildId});
        const users = await pb.collection('user_levels').getFullList({filter: userFilter});

        if (users.length === 0) {
            return interaction.editReply('❌ No level data found for any users.');
        }

        await interaction.editReply(`⏳ Syncing roles for ${users.length} users. This may take some time...`);

        let success = 0;
        let failed = 0;

        // Process each user
        for (const user of users) {
            try {
                const level = calculateLevelFromXp(user.xp);
                await checkAndAwardRoles(user.user_id, interaction.guildId, level, interaction.client, pb);
                success++;
            } catch {
                failed++;
            }
        }

        await interaction.editReply(`✅ Role sync complete:
• Successfully synced: ${success} users
• Failed to sync: ${failed} users`);

    } catch (error) {
        console.error('Error syncing roles:', error);
        await interaction.editReply('❌ Failed to sync user roles.');
    }
}

async function handleMigrateRoles(interaction, pb) {
    await interaction.deferReply({ ephemeral: true });

    try {
        // Get all level rewards to know which roles correspond to which levels
        const rewardFilter = pb.filter(`guild_id = {:guild_id}`, { guild_id: interaction.guildId });
        const rewards = await pb.collection('level_rewards').getFullList({
            filter: rewardFilter,
            sort: '+level'
        });

        if (rewards.length === 0) {
            return interaction.editReply('❌ No level rewards defined. Please set up level rewards first.');
        }

        // Create a map of role IDs to their corresponding levels
        const roleLevels = {};
        for (const reward of rewards) {
            roleLevels[reward.role_id] = reward.level;
        }

        await interaction.editReply('⏳ Migrating roles to XP. Scanning all members...');

        // Get guild members
        const members = await interaction.guild.members.fetch();
        let updated = 0;
        let skipped = 0;
        let errors = 0;

        for (const [memberId, member] of members) {
            // Skip bots
            if (member.user.bot) {
                skipped++;
                continue;
            }

            try {
                // Find the highest level role the member has
                let highestLevel = 0;
                for (const [roleId, role] of member.roles.cache) {
                    if (roleLevels[roleId] && roleLevels[roleId] > highestLevel) {
                        highestLevel = roleLevels[roleId];
                    }
                }

                if (highestLevel === 0) {
                    // No level roles found for this user
                    skipped++;
                    continue;
                }

                // Check if user already has level data
                const userFilter = pb.filter(`guild_id = {:guild_id} && user_id = {:user_id}`,
                    { guild_id: interaction.guildId, user_id: memberId });
                const userData = await pb.collection('user_levels').getList(1, 1, { filter: userFilter });

                // Calculate minimum XP needed for this level
                let totalRequiredXp = 0;
                for (let i = 1; i <= highestLevel; i++) {
                    totalRequiredXp += calculateXpForLevel(i);
                }

                // Add a little extra to prevent edge cases
                totalRequiredXp += 10;

                if (userData.totalItems > 0) {
                    const existingXp = userData.items[0].xp;
                    const existingLevel = calculateLevelFromXp(existingXp);

                    // Only update if their actual level is lower than the role level
                    if (existingLevel < highestLevel) {
                        await pb.collection('user_levels').update(userData.items[0].id, {
                            xp: totalRequiredXp,
                            level: highestLevel,
                            last_message_time: new Date().toISOString()
                        });
                        updated++;
                    } else {
                        skipped++;
                    }
                } else {
                    // Create new record with appropriate XP
                    await pb.collection('user_levels').create({
                        guild_id: interaction.guildId,
                        user_id: memberId,
                        xp: totalRequiredXp,
                        level: highestLevel,
                        last_message_time: new Date().toISOString()
                    });
                    updated++;
                }
            } catch (error) {
                console.error(`Error processing user ${memberId}:`, error);
                errors++;
            }
        }

        await interaction.editReply(`✅ Role migration complete:
• Users updated: ${updated}
• Users skipped: ${skipped} (bots or no level roles)
• Errors: ${errors}`);

    } catch (error) {
        console.error('Error migrating roles to XP:', error);
        await interaction.editReply('❌ Failed to migrate roles to XP.');
    }
}

async function handleSetLevel(interaction, pb) {
    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser('user');
    const newLevel = interaction.options.getInteger('level');

    try {
        // Calculate XP required for this level
        let totalXpRequired = 0;
        for (let i = 1; i <= newLevel; i++) {
            totalXpRequired += calculateXpForLevel(i);
        }

        // Ensure the user has enough XP to be solidly at this level (add a small buffer)
        totalXpRequired += 10;

        // Check if user has level data
        const userFilter = pb.filter(`guild_id = {:guild_id} && user_id = {:user_id}`,
            { guild_id: interaction.guildId, user_id: targetUser.id });
        const userData = await pb.collection('user_levels').getList(1, 1, { filter: userFilter });

        if (userData.totalItems > 0) {
            // Update existing record
            await pb.collection('user_levels').update(userData.items[0].id, {
                xp: totalXpRequired,
                level: newLevel,
                last_message_time: new Date().toISOString()
            });
        } else {
            // Create new record
            await pb.collection('user_levels').create({
                guild_id: interaction.guildId,
                user_id: targetUser.id,
                xp: totalXpRequired,
                level: newLevel,
                last_message_time: new Date().toISOString()
            });
        }

        // Award appropriate roles
        await checkAndAwardRoles(targetUser.id, interaction.guildId, newLevel, interaction.client, pb);

        await interaction.editReply(`✅ ${targetUser.username}'s level has been set to ${newLevel} with ${totalXpRequired} XP.`);

    } catch (error) {
        console.error('Error setting user level:', error);
        await interaction.editReply('❌ Failed to set user level.');
    }
}