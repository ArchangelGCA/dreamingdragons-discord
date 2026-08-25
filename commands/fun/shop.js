import {SlashCommandBuilder} from 'discord.js';
import {COSMETICS, SLOTS, getEconomyRecord, itemsBySlot, slotLabel, slotEmoji} from '../../utils/economy.js';
import {buildShopCard} from '../../utils/economyui.js';
import {CV2} from '../../utils/ui.js';
import {getPb} from '../../utils/pocketbase.js';

export default {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('Browse the cosmetics shop')
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Filter by category')
                .setRequired(false)
                .addChoices(
                    {name: 'Colours', value: 'color'},
                    {name: 'Titles', value: 'title'},
                    {name: 'Banners', value: 'banner'},
                    {name: 'Frames', value: 'frame'},
                    {name: 'Flair', value: 'flair'},
                    {name: 'Badges', value: 'badge'},
                    {name: 'Effects', value: 'effect'}
                )),

    async execute(interaction) {
        await interaction.deferReply();
        const pb = await getPb();
        const category = interaction.options.getString('category');

        try {
            const record = await getEconomyRecord(pb, interaction.guildId, interaction.user.id);
            const owned = new Set(record?.cosmetics || []);
            const balance = record?.gold ?? 0;

            const allGroups = itemsBySlot();
            let groups = [];
            for (const slot of SLOTS) {
                if (category && slot !== category) continue;
                groups.push({slot, items: allGroups[slot]});
            }

            const card = buildShopCard({balance, owned, groups});
            await interaction.editReply({components: [card], flags: CV2});
        } catch (error) {
            console.error('Error loading shop:', error);
            await interaction.editReply('Sorry, there was an error loading the shop.');
        }
    }
};