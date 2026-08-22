import { SlashCommandBuilder } from 'discord.js';
import {
    LEADERBOARD_BUTTON_PREFIX,
    findViewerStanding,
    loadLeaderboard,
    pageForRank,
    parseLeaderboardCustomId
} from '../../utils/levelui.js';
import { CV2, CV2_EPHEMERAL, statusCard } from '../../utils/ui.js';
import { getPb } from '../../utils/pocketbase.js';

export default {
    data: new SlashCommandBuilder()
        .setName('levels')
        .setDescription('View the server level leaderboard')
        .addIntegerOption(option =>
            option.setName('page')
                .setDescription('Leaderboard page number')
                .setMinValue(1)
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply();
        const pb = await getPb();

        try {
            const requested = interaction.options.getInteger('page') || 1;
            const result = await loadLeaderboard(pb, interaction.guild, requested, interaction.user.id);

            if (!result) {
                const card = statusCard('info', 'Nobody has earned XP yet', 'Be the first — start chatting to climb the leaderboard!');
                return interaction.editReply({ components: [card], flags: CV2 });
            }

            await interaction.editReply({ components: result.components, flags: CV2 });
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
            await interaction.editReply('Sorry, there was an error getting the leaderboard.');
        }
    },

    /**
     * Handle leaderboard paging buttons (customId: lb:prev|next|me:<page>).
     * Called from the interaction router in index.js. Anyone may page through.
     * @param {import('discord.js').ButtonInteraction} interaction
     */
    async handlePagination(interaction) {
        const parsed = parseLeaderboardCustomId(interaction.customId);
        if (!parsed || !interaction.guild) return;

        const pb = await getPb();
        if (!pb) {
            await interaction.reply({
                components: [statusCard('error', 'Bot is initializing', 'Please try again in a moment.')],
                flags: CV2_EPHEMERAL
            }).catch(() => {});
            return;
        }

        try {
            let targetPage;
            if (parsed.kind === 'me') {
                // Jump straight to the clicker's rank.
                const standing = await findViewerStanding(pb, interaction.guild.id, interaction.user.id);
                if (!standing) {
                    await interaction.reply({
                        components: [statusCard('info', "You're not ranked yet", 'Chat a little first, and you\'ll appear on the leaderboard.')],
                        flags: CV2_EPHEMERAL
                    });
                    return;
                }
                targetPage = pageForRank(standing.rank);
            } else {
                targetPage = parsed.page + (parsed.direction === 'next' ? 1 : -1);
            }
            if (targetPage < 1) {
                await interaction.deferUpdate().catch(() => {});
                return;
            }

            const result = await loadLeaderboard(pb, interaction.guild, targetPage, interaction.user.id);
            if (!result) {
                await interaction.deferUpdate().catch(() => {});
                return;
            }
            await interaction.update({ components: result.components, flags: CV2 });
        } catch (error) {
            console.error('Error paginating leaderboard:', error);
            await interaction.deferUpdate().catch(() => {});
        }
    }
};

export { LEADERBOARD_BUTTON_PREFIX };
