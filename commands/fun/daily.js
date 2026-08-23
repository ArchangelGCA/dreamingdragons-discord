import {SlashCommandBuilder} from 'discord.js';
import {claimDailyReward} from '../../utils/economy.js';
import {buildDailyCard} from '../../utils/economyui.js';
import {CV2} from '../../utils/ui.js';
import {getPb} from '../../utils/pocketbase.js';

export default {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily reward'),

    async execute(interaction) {
        await interaction.deferReply();
        const pb = await getPb();

        try {
            const result = await claimDailyReward(pb, interaction.client, interaction.guildId, interaction.user.id);

            const card = buildDailyCard({
                ...result,
                avatarUrl: interaction.user.displayAvatarURL({size: 128})
            });

            await interaction.editReply({components: [card], flags: CV2});
        } catch (error) {
            console.error('Error claiming daily reward:', error);
            await interaction.editReply('Sorry, there was an error claiming your daily reward.');
        }
    }
};