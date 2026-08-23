import {SlashCommandBuilder, MessageFlags} from 'discord.js';
import {equipCosmetic, findItem, slotLabel} from '../../utils/economy.js';
import {replyError, replySuccess} from '../../utils/replies.js';
import {getPb} from '../../utils/pocketbase.js';

export default {
    data: new SlashCommandBuilder()
        .setName('equip')
        .setDescription('Equip a cosmetic you own (or remove one)')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('Item to equip, or "Remove current <slot>"')
                .setRequired(true)
                .setAutocomplete(true)),

    async execute(interaction) {
        await interaction.deferReply({flags: MessageFlags.Ephemeral});
        const pb = await getPb();
        const candidate = interaction.options.getString('item');

        try {
            const result = await equipCosmetic(pb, interaction.guildId, interaction.user.id, candidate);
            if (!result.ok) {
                return replyError(interaction, result.error);
            }

            if (result.action === 'unequip') {
                await replySuccess(interaction, `Removed your **${slotLabel(result.slot)}**.`);
            } else {
                await replySuccess(interaction, `Equipped **${result.item.name}** (${slotLabel(result.slot)}).`);
            }
        } catch (error) {
            console.error('Error equipping item:', error);
            await replyError(interaction, 'Failed to equip the item.');
        }
    }
};