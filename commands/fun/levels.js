import {SlashCommandBuilder, EmbedBuilder} from 'discord.js';
import {calculateLevelFromXp} from '../../utils/leveling.js';
import {getPb} from "../../utils/pocketbase.js";

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

        const page = interaction.options.getInteger('page') || 1;
        const perPage = 10;

        try {
            // Get all users sorted by XP
            const filter = pb.filter(`guild_id = {:guild_id}`, {guild_id: interaction.guildId});
            const levelData = await pb.collection('user_levels').getList(page, perPage, {
                filter,
                sort: '-xp'
            });

            if (levelData.totalItems === 0) {
                return interaction.editReply('No one has earned XP in this server yet.');
            }

            // Build leaderboard
            let description = '';
            for (let i = 0; i < levelData.items.length; i++) {
                const user = levelData.items[i];
                const rank = (page - 1) * perPage + i + 1;
                const level = calculateLevelFromXp(user.xp);

                try {
                    // Try to fetch username
                    const member = await interaction.guild.members.fetch(user.user_id);
                    description += `**${rank}.** ${member.toString()} - Level ${level} (${user.xp} XP)\n`;
                } catch {
                    // User may have left the server
                    description += `**${rank}.** Unknown User - Level ${level} (${user.xp} XP)\n`;
                }
            }

            const maxPages = Math.ceil(levelData.totalItems / perPage);

            const embed = new EmbedBuilder()
                .setColor(0x4CAF50)
                .setTitle(`${interaction.guild.name} - Level Leaderboard`)
                .setDescription(description)
                .setFooter({text: `Page ${page}/${maxPages} • Total Users: ${levelData.totalItems}`})
                .setTimestamp();

            await interaction.editReply({embeds: [embed]});
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
            await interaction.editReply('Sorry, there was an error getting the leaderboard.');
        }
    }
};