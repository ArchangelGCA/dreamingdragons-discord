import {SlashCommandBuilder, PermissionsBitField, EmbedBuilder, MessageFlags} from 'discord.js';
import {invalidateLevelSettingsCache} from '../../utils/leveling.js';
import {
    recoverGuildXp,
    syncGuildRoles,
    setUserLevel,
    resetUser
} from '../../utils/levelservice.js';
import {getPb} from "../../utils/pocketbase.js";

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

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        const pb = await getPb();

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
                await interaction.reply({content: 'Unknown subcommand', flags: MessageFlags.Ephemeral});
        }
    }
};

async function handleSetup(interaction, pb) {
    await interaction.deferReply({flags: MessageFlags.Ephemeral});

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

        invalidateLevelSettingsCache(interaction.guildId);

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
    await interaction.deferReply({flags: MessageFlags.Ephemeral});

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
    await interaction.deferReply({flags: MessageFlags.Ephemeral});

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
    await interaction.deferReply({flags: MessageFlags.Ephemeral});

    const user = interaction.options.getUser('user');

    try {
        const { deleted } = await resetUser(pb, interaction.guildId, user.id);
        if (!deleted) {
            return interaction.editReply(`❌ ${user.username} doesn't have any level data to reset.`);
        }
        await interaction.editReply(`✅ Level data reset for ${user.username}`);
    } catch (error) {
        console.error('Error resetting user level:', error);
        await interaction.editReply('❌ Failed to reset user level data.');
    }
}

async function handleToggle(interaction, pb, enable) {
    await interaction.deferReply({flags: MessageFlags.Ephemeral});

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

        invalidateLevelSettingsCache(interaction.guildId);

        await interaction.editReply(`✅ Leveling system ${enable ? 'enabled' : 'disabled'}.`);

    } catch (error) {
        console.error(`Error ${enable ? 'enabling' : 'disabling'} level system:`, error);
        await interaction.editReply(`❌ Failed to ${enable ? 'enable' : 'disable'} the leveling system.`);
    }
}

async function handleSync(interaction, pb) {
    await interaction.deferReply({flags: MessageFlags.Ephemeral});

    try {
        const { total, success, failed } = await syncGuildRoles(pb, interaction.client, interaction.guildId);

        if (total === 0) {
            return interaction.editReply('❌ No level data found for any users.');
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
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        // Shared logic with the dashboard "Recover XP" action.
        const { changes, skipped, updated, errors } = await recoverGuildXp(
            pb, interaction.client, interaction.guildId, { dryRun: false }
        );

        if (changes.length === 0 && updated === 0) {
            return interaction.editReply(
                '❌ No members needed XP recovery. Ensure level rewards are configured and members hold those roles.'
            );
        }

        await interaction.editReply(`✅ Role migration complete:
• Users updated: ${updated}
• Users skipped: ${skipped} (bots, no level roles, or already at/above the role level)
• Errors: ${errors}`);

    } catch (error) {
        console.error('Error migrating roles to XP:', error);
        await interaction.editReply('❌ Failed to migrate roles to XP.');
    }
}

async function handleSetLevel(interaction, pb) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const targetUser = interaction.options.getUser('user');
    const newLevel = interaction.options.getInteger('level');

    try {
        const { xp } = await setUserLevel(pb, interaction.client, interaction.guildId, targetUser.id, newLevel);
        await interaction.editReply(`✅ ${targetUser.username}'s level has been set to ${newLevel} with ${xp} XP.`);
    } catch (error) {
        console.error('Error setting user level:', error);
        await interaction.editReply('❌ Failed to set user level.');
    }
}