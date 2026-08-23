import { SlashCommandBuilder } from 'discord.js';
import { calculateLevelFromXp } from '../../utils/leveling.js';
import { buildLevelCard } from '../../utils/levelui.js';
import { CV2 } from '../../utils/ui.js';
import { getPb } from '../../utils/pocketbase.js';
import { getEquippedCosmetics } from '../../utils/economy.js';

export default {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Check your current level and XP')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to check (defaults to yourself)')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply();
        const pb = await getPb();

        const targetUser = interaction.options.getUser('user') || interaction.user;
        const isOwnLevel = targetUser.id === interaction.user.id;

        try {
            const filter = pb.filter('guild_id = {:guild_id} && user_id = {:user_id}',
                { guild_id: interaction.guildId, user_id: targetUser.id });
            const userData = await pb.collection('user_levels').getList(1, 1, { filter });

            if (userData.totalItems === 0) {
                return interaction.editReply(isOwnLevel ?
                    "You don't have any XP yet — start chatting to earn some! ✨" :
                    `${targetUser.username} doesn't have any XP yet.`);
            }

            const user = userData.items[0];
            const level = calculateLevelFromXp(user.xp);

            // Get the user's rank in the server: everyone above them plus themself.
            const ahead = await pb.collection('user_levels').getList(1, 1, {
                filter: pb.filter('guild_id = {:guild_id} && xp > {:xp}',
                    { guild_id: interaction.guildId, xp: user.xp })
            });
            const rank = ahead.totalItems + 1;

            // Resolve the target's display color + avatar for the card.
            const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

            // Equipped cosmetics (gold-bought card personalisation).
            const equipped = await getEquippedCosmetics(pb, interaction.guildId, targetUser.id).catch(() => null);

            // Optional link to the public web profile (only when PUBLIC_URL is set).
            const publicBase = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');
            const profileUrl = publicBase
                ? `${publicBase}/u/${targetUser.id}?g=${interaction.guildId}`
                : undefined;

            const card = buildLevelCard({
                displayName: member?.displayName ?? targetUser.globalName ?? targetUser.username,
                avatarUrl: targetUser.displayAvatarURL({ size: 128 }),
                // Custom equipped accent colour wins over the member role colour.
                accentColor: (equipped?.color?.accent ?? member?.displayColor) || null,
                titleText: equipped?.title?.name,
                flairEmoji: equipped?.flair?.emoji,
                level,
                xp: user.xp,
                rank,
                isSelf: isOwnLevel,
                profileUrl
            });

            await interaction.editReply({ components: [card], flags: CV2 });
        } catch (error) {
            console.error('Error getting level data:', error);
            await interaction.editReply('Sorry, there was an error fetching level data.');
        }
    }
};
