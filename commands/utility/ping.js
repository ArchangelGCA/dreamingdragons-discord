// commands/utility/ping.js
import { SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with Pong!'),
    async execute(interaction) {
        // interaction.reply() is used to send a response to the command
        await interaction.reply('Pong!');
    },
};