import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Load .env
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commands = [];
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

console.log('Loading commands...');

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    // Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const commandModule = await import(pathToFileURL(filePath));
        if (commandModule.default && 'data' in commandModule.default && 'execute' in commandModule.default) {
            commands.push(commandModule.default.data.toJSON());
            console.log(`[COMMAND LOADED] ${commandModule.default.data.name}`);
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

console.log(`Found ${commands.length} application (/) commands.`);

// Construct and prepare an instance of the REST module
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

// Deploy commands
(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        // The put method is used to fully refresh all commands in the guild with the current set
        // applicationGuildCommands ONLY for development/testing in a specific guild
        const data = await rest.put(
            Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
            { body: commands },
        );

        // applicationCommands for global deployment (can take up to an hour)
        // const data = await rest.put(
        //  Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
        //  { body: commands },
        // );

        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
        process.exit(0);
    } catch (error) {
        console.error('Error deploying commands:', error);
        process.exit(1);
    }
})();