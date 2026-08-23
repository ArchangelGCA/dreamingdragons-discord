import {SlashCommandBuilder} from 'discord.js';
import {getEconomyRecord, getEquippedCosmetics} from '../../utils/economy.js';
import {buildBalanceCard} from '../../utils/economyui.js';
import {CV2} from '../../utils/ui.js';
import {getPb} from '../../utils/pocketbase.js';

export default {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check your gold balance and streak')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to check (defaults to yourself)')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply();
        const pb = await getPb();
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        try {
            const record = await getEconomyRecord(pb, interaction.guildId, targetUser.id);
            const equipped = await getEquippedCosmetics(pb, interaction.guildId, targetUser.id);

            const card = buildBalanceCard({
                displayName: member?.displayName ?? targetUser.globalName ?? targetUser.username,
                avatarUrl: targetUser.displayAvatarURL({size: 128}),
                accentColor: member?.displayColor || null,
                gold: record?.gold ?? 0,
                streak: record?.daily_streak ?? 0,
                bestStreak: record?.best_streak ?? 0,
                claims: record?.total_claims ?? 0,
                equipped
            });

            await interaction.editReply({components: [card], flags: CV2});
        } catch (error) {
            console.error('Error fetching balance:', error);
            await interaction.editReply('Sorry, there was an error fetching the balance.');
        }
    }
};