import {SlashCommandBuilder, MessageFlags} from 'discord.js';
import {getEconomyRecord, getEquippedCosmetics, COSMETICS, findItem} from '../../utils/economy.js';
import {buildInventoryCard} from '../../utils/economyui.js';
import {CV2} from '../../utils/ui.js';
import {getPb} from '../../utils/pocketbase.js';

export default {
    data: new SlashCommandBuilder()
        .setName('inventory')
        .setDescription('View your owned cosmetics'),

    async execute(interaction) {
        await interaction.deferReply({flags: MessageFlags.Ephemeral});
        const pb = await getPb();

        try {
            const record = await getEconomyRecord(pb, interaction.guildId, interaction.user.id);
            const equipped = await getEquippedCosmetics(pb, interaction.guildId, interaction.user.id);
            const ownedIds = record?.cosmetics || [];
            const ownedItems = ownedIds.map((id) => findItem(id)).filter(Boolean);

            const card = buildInventoryCard({
                balance: record?.gold ?? 0,
                equipped,
                ownedItems
            });

            await interaction.editReply({components: [card], flags: CV2});
        } catch (error) {
            console.error('Error loading inventory:', error);
            await interaction.editReply('Sorry, there was an error loading your inventory.');
        }
    }
};