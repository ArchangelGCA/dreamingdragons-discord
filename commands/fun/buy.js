import {SlashCommandBuilder, MessageFlags} from 'discord.js';
import {purchaseCosmetic} from '../../utils/economy.js';
import {replyError, replySuccess} from '../../utils/replies.js';
import {getPb} from '../../utils/pocketbase.js';

export default {
    data: new SlashCommandBuilder()
        .setName('buy')
        .setDescription('Purchase a cosmetic from the shop')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('The item to buy')
                .setRequired(true)
                .setAutocomplete(true)),

    async execute(interaction) {
        await interaction.deferReply({flags: MessageFlags.Ephemeral});
        const pb = await getPb();
        const itemId = interaction.options.getString('item');

        try {
            const result = await purchaseCosmetic(pb, interaction.guildId, interaction.user.id, itemId);
            if (!result.ok) {
                return replyError(interaction, result.error);
            }
            await replySuccess(interaction, `You bought **${result.item.name}** for ${result.item.price} 🪙. New balance: ${result.newGold} 🪙. Equip it with \`/equip\`.`);
        } catch (error) {
            console.error('Error buying item:', error);
            await replyError(interaction, 'Failed to complete the purchase.');
        }
    }
};