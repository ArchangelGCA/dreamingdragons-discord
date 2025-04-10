import {SlashCommandBuilder, EmbedBuilder} from 'discord.js';
import {calculateLevelFromXp, calculateXpToNextLevel} from '../../utils/leveling.js';

export default {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Check your current level and XP')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to check (defaults to yourself)')
                .setRequired(false)),

    async execute(interaction, pb) {
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('user') || interaction.user;
        const isOwnLevel = targetUser.id === interaction.user.id;

        // Get user level data
        try {
            const filter = pb.filter(`guild_id = {:guild_id} && user_id = {:user_id}`,
                {guild_id: interaction.guildId, user_id: targetUser.id});
            const userData = await pb.collection('user_levels').getList(1, 1, {filter});

            if (userData.totalItems === 0) {
                return interaction.editReply(isOwnLevel ?
                    "You don't have any XP yet. Start chatting to earn some!" :
                    `${targetUser.username} doesn't have any XP yet.`);
            }

            const user = userData.items[0];
            const level = calculateLevelFromXp(user.xp);
            const xpToNext = calculateXpToNextLevel(user.xp);

            // Get user's rank in server
            const allUsersFilter = pb.filter(`guild_id = {:guild_id}`, {guild_id: interaction.guildId});
            const allUsers = await pb.collection('user_levels').getList(1, 100, {
                filter: allUsersFilter,
                sort: '-xp'
            });

            let rank = allUsers.items.findIndex(u => u.user_id === targetUser.id) + 1;

            // Create embed
            const embed = new EmbedBuilder()
                .setColor(0x4CAF50)
                .setTitle(`${isOwnLevel ? 'Your' : `${targetUser.username}'s`} Level Stats`)
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    {name: 'Level', value: `${level}`, inline: true},
                    {name: 'Total XP', value: `${user.xp}`, inline: true},
                    {name: 'Rank', value: `#${rank}`, inline: true},
                    {name: 'XP to Next Level', value: `${xpToNext}`, inline: false},
                )
                .setFooter({text: 'Keep chatting to earn more XP!'})
                .setTimestamp();

            await interaction.editReply({embeds: [embed]});
        } catch (error) {
            console.error('Error getting level data:', error);
            await interaction.editReply('Sorry, there was an error fetching level data.');
        }
    }
};