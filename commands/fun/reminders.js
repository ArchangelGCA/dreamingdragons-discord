import {SlashCommandBuilder, MessageFlags} from 'discord.js';
import {setReminderOptIn} from '../../utils/economy.js';
import {replySuccess, replyError} from '../../utils/replies.js';
import {getPb} from '../../utils/pocketbase.js';

export default {
    data: new SlashCommandBuilder()
        .setName('reminders')
        .setDescription('Opt in or out of DM streak reminders (default off)')
        .addBooleanOption(option =>
            option.setName('enabled')
                .setDescription('Receive a DM when your streak is about to break?')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({flags: MessageFlags.Ephemeral});
        const pb = await getPb();
        const enabled = interaction.options.getBoolean('enabled');

        try {
            await setReminderOptIn(pb, interaction.guildId, interaction.user.id, enabled);
            if (enabled) {
                await replySuccess(interaction, `I'll DM you a reminder when your daily streak is about to break.`);
            } else {
                await replySuccess(interaction, `You won't receive streak reminders.`);
            }
        } catch (error) {
            console.error('Error updating reminder setting:', error);
            await replyError(interaction, 'Failed to update reminder setting.');
        }
    }
};