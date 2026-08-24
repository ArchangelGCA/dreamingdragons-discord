import { REST, Routes } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
        const clientId = process.env.DISCORD_CLIENT_ID;
        const guildId = process.env.DISCORD_GUILD_ID;

        if (!clientId) {
            console.error('Error: DISCORD_CLIENT_ID is not set. Cannot deploy commands.');
            process.exit(1);
        }

        // Guild commands update instantly (ideal for a single server / development).
        // With no DISCORD_GUILD_ID, deploy globally (may take up to ~1 hour to propagate).
        const route = guildId
            ? Routes.applicationGuildCommands(clientId, guildId)
            : Routes.applicationCommands(clientId);

        console.log(`Started refreshing ${commands.length} application (/) commands (${guildId ? `guild ${guildId}` : 'global'}).`);

        const data = await rest.put(route, { body: commands });

        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
        process.exit(0);
    } catch (error) {
        console.error('Error deploying commands:', error);
        process.exit(1);
    }
})();