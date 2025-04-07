import {Client, GatewayIntentBits, Collection, Events} from 'discord.js';
import {config} from 'dotenv';
import PocketBase from 'pocketbase';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {loadReactionRoleMessages} from "./init/init.js";

// Load .env variables
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pocketbase setup
const pb = new PocketBase(process.env.POCKETBASE_URL);

try {
    await pb.admins.authWithPassword(
        process.env.POCKETBASE_ADMIN_EMAIL,
        process.env.POCKETBASE_ADMIN_PASSWORD
    );
    console.log('PocketBase admin authenticated successfully.');
} catch (error) {
    console.error('PocketBase admin authentication failed:', error);
    process.exit(1);
}

// Discord Client Setup: intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers,
    ]
});

// Command Handling
client.commands = new Collection();

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

console.log('Loading command handlers...');

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        try {
            const commandModule = await import(pathToFileURL(filePath));
            const command = commandModule.default;

            if (command && 'data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                console.log(`[HANDLER LOADED] ${command.data.name}`);
            } else {
                console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
            }
        } catch (error) {
            console.error(`Error loading command at ${filePath}:`, error);
        }
    }
}
console.log('Command handlers loaded.');

/////////////////////
// Event Listeners //
/////////////////////

// Ready Event (Run only once, init content)
client.once(Events.ClientReady, async c => {
    console.log(`Ready! Logged in as ${c.user.tag}`);

    await loadReactionRoleMessages(client, pb);
});

// Listen for interactions (slash commands)
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        try {
            await interaction.reply({content: `Command not found: ${interaction.commandName}`, flags: { ephemeral: true }});
        } catch (e) {
            console.error("Error replying to unknown command interaction:", e);
        }
        return;
    }

    try {
        await command.execute(interaction, pb);
    } catch (error) {
        console.error(`Error executing command ${interaction.commandName}:`, error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({content: 'There was an error while executing this command!', flags: { ephemeral: true }});
        } else {
            await interaction.reply({content: 'There was an error while executing this command!', flags: { ephemeral: true }});
        }
    }
});

// Reaction Add Listener
client.on(Events.MessageReactionAdd, async (reaction, user) => {

    // Ignore bots and DMs
    if (user.bot || !reaction.message.guild) return;

    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('Error fetching partial reaction:', error);
            return;
        }
    }
    if (reaction.message.partial) {
        try {
            await reaction.message.fetch();
        } catch (error) {
            console.error('Error fetching partial message:', error);
            return;
        }
    }

    // Ignore reactions on messages not sent in guilds
    if (!reaction.message.guildId) return;

    const {message, emoji} = reaction;
    const emojiIdentifier = emoji.id ? `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>` : emoji.name; // Construct identifier '<:name:id>' or use unicode name

    try {
        // Find configured reaction role in PocketBase
        const filter = pb.filter(`guild_id = {:guild_id} && message_id = {:message_id} && emoji_identifier = {:emoji_identifier}`, {guild_id: message.guildId, message_id: message.id, emoji_identifier: emojiIdentifier});
        // console.log(`[Reaction Add] Querying PB: ${filter}`);

        const resultList = await pb.collection('reaction_roles').getList(1, 1, {filter});

        if (resultList.totalItems > 0) {
            const config = resultList.items[0];
            const roleId = config.role_id;

            // Fetch the member who reacted
            const guild = reaction.message.guild;
            const member = await guild.members.fetch(user.id);

            if (!member) {
                console.warn(`[Reaction Add] Could not fetch member ${user.id} in guild ${guild.id}`);
                return;
            }

            // Check if member already has the role
            if (member.roles.cache.has(roleId)) {
                // console.log(`[Reaction Add] Member ${user.tag} already has role ${roleId}.`);
                return;
            }

            // Add the role
            await member.roles.add(roleId);
            console.log(`[Reaction Add] Added role ${roleId} to user ${user.tag} in guild ${guild.id}`);

            // DM the user
            /*try {
                await user.send(`You've been given the "${guild.roles.cache.get(roleId)?.name || roleId}" role in ${guild.name}!`);
            } catch {}*/

        } else {
            // console.log(`[Reaction Add] No config found for message ${message.id}, emoji ${emojiIdentifier}`);
        }

    } catch (error) {
        console.error(`Error processing reaction add (Msg: ${message.id}, Emoji: ${emojiIdentifier}, User: ${user.tag}):`, error);
        if (error.code === 50013) {
            console.error(`[Reaction Add] Missing Permissions to add role ${config?.role_id} to ${user.tag}. Bot role might be too low or missing 'Manage Roles' perm.`);
        }
    }
});

// Reaction Remove Listener
client.on(Events.MessageReactionRemove, async (reaction, user) => {
    // Ignore bots and DMs
    if (user.bot || !reaction.message.guild) return;

    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('Error fetching partial reaction:', error);
            return;
        }
    }
    if (reaction.message.partial) {
        try {
            await reaction.message.fetch();
        } catch (error) {
            console.error('Error fetching partial message:', error);
            return;
        }
    }

    if (!reaction.message.guildId) return;

    const {message, emoji} = reaction;
    const emojiIdentifier = emoji.id ? `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>` : emoji.name;

    try {
        // Find configured reaction role in PocketBase
        const filter = pb.filter(`guild_id = {:guild_id} && message_id = {:message_id} && emoji_identifier = {:emoji_identifier}`, {guild_id: message.guildId, message_id: message.id, emoji_identifier: emojiIdentifier});
        // console.log(`[Reaction Remove] Querying PB: ${filter}`); // Debug log

        const resultList = await pb.collection('reaction_roles').getList(1, 1, {filter});

        if (resultList.totalItems > 0) {
            const config = resultList.items[0];
            const roleId = config.role_id;

            // Fetch the member who reacted
            const guild = reaction.message.guild;
            // Fetching the member might fail if they left the server
            let member;
            try {
                member = await guild.members.fetch(user.id);
            } catch (fetchError) {
                if (fetchError.code === 10007) { // Unknown Member
                    console.log(`[Reaction Remove] User ${user.id} not found in guild ${guild.id} (likely left). Cannot remove role.`);
                } else {
                    console.error(`[Reaction Remove] Error fetching member ${user.id} in guild ${guild.id}:`, fetchError);
                }
                return;
            }


            // Check if member actually has the role
            if (!member.roles.cache.has(roleId)) {
                // console.log(`[Reaction Remove] Member ${user.tag} does not have role ${roleId}.`);
                return;
            }

            // Remove the role
            await member.roles.remove(roleId);
            console.log(`[Reaction Remove] Removed role ${roleId} from user ${user.tag} in guild ${guild.id}`);

            // DM the user
            /*try {
                await user.send(`The "${guild.roles.cache.get(roleId)?.name || roleId}" role has been removed in ${guild.name}.`);
            } catch {}*/
        } else {
            // console.log(`[Reaction Remove] No config found for message ${message.id}, emoji ${emojiIdentifier}`);
        }
    } catch (error) {
        console.error(`Error processing reaction remove (Msg: ${message.id}, Emoji: ${emojiIdentifier}, User: ${user.tag}):`, error);
        if (error.code === 50013) {
            console.error(`[Reaction Remove] Missing Permissions to remove role ${config?.role_id} from ${user.tag}. Bot role might be too low or missing 'Manage Roles' perm.`);
        }
    }
});

// Autocomplete Listener
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isAutocomplete()) return;
    if (!interaction.guild) return;

    if (interaction.commandName === 'reactionrole') {
        const subcommand = interaction.options.getSubcommand();
        const focusedOption = interaction.options.getFocused(true);

        try {
            // Handle message_id autocomplete
            if (focusedOption.name === 'message_id' &&
                ['list', 'add', 'edit', 'remove'].includes(subcommand)) {

                const filter = pb.filter(`guild_id = {:guild_id}`, {guild_id: interaction.guildId});
                const records = await pb.collection('reaction_roles').getFullList({ filter });

                if (records.length === 0) {
                    await interaction.respond([]);
                    return;
                }

                // Group by message and create a set of unique message IDs
                const messageGroups = {};
                for (const record of records) {
                    if (!messageGroups[record.message_id]) {
                        messageGroups[record.message_id] = {
                            channelId: record.channel_id,
                            roleCount: 0
                        };
                    }
                    messageGroups[record.message_id].roleCount++;
                }

                // Create choices (limited to 25 by Discord)
                const choices = Object.entries(messageGroups).slice(0, 25).map(([msgId, info]) => ({
                    name: `Message ${msgId.slice(-8)} in #${interaction.guild.channels.cache.get(info.channelId)?.name || 'unknown'} (${info.roleCount} roles)`,
                    value: msgId
                }));

                await interaction.respond(choices);
            } else if (['current_emoji', 'emoji'].includes(focusedOption.name) && ['edit', 'remove'].includes(subcommand)) { // Handle current_emoji/emoji autocomplete for edit/remove subcommand
                const messageId = interaction.options.getString('message_id');

                if (!messageId) {
                    // If message_id hasn't been selected yet
                    await interaction.respond([{
                        name: "Please select a message ID first",
                        value: "placeholder"
                    }]);
                    return;
                }

                // Get all emojis for the selected message
                const filter = pb.filter(`message_id = {:message_id} && guild_id = {:guild_id}`,
                    {message_id: messageId, guild_id: interaction.guildId});
                const records = await pb.collection('reaction_roles').getFullList({ filter });

                if (records.length === 0) {
                    await interaction.respond([]);
                    return;
                }

                // Create choices for each emoji
                const choices = records.slice(0, 25).map(record => {
                    const roleId = record.role_id;
                    const roleName = interaction.guild.roles.cache.get(roleId)?.name || 'Unknown Role';

                    return {
                        name: `${record.emoji_identifier} → ${roleName}`,
                        value: record.emoji_identifier
                    };
                });

                await interaction.respond(choices);
            }
        } catch (error) {
            console.error('Error handling autocomplete:', error);
            await interaction.respond([]);
        }
    }
});

// Login
console.log('Logging into Discord...');
client.login(process.env.DISCORD_BOT_TOKEN)
    .then(() => console.log('Login successful!'))
    .catch(error => {
        console.error('Failed to login:', error);
        process.exit(1);
    });

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down bot...');
    client.destroy();
    process.exit(0);
});