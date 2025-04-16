import {Client, GatewayIntentBits, Collection, Events, ActivityType} from 'discord.js';
import {startDeviantArtCheckers} from './scrapers/deviantart-checker.js';
import {config} from 'dotenv';
import {getPb} from './utils/pocketbase.js';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {loadReactionRoleMessages} from "./init/init.js";
import {addXpToUser} from './utils/leveling.js';

// Load environment variables
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pbInstance = null;

// Initialize Discord client with required intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
    ]
});

// Store commands
client.commands = new Collection();

/**
 * Load command handlers from the commands directory
 */
async function loadCommands() {
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
                    // console.log(`[HANDLER LOADED] ${command.data.name}`); // Debug
                } else {
                    console.log(`[WARNING] Command at ${filePath} missing "data" or "execute".`);
                }
            } catch (error) {
                console.error(`Error loading command at ${filePath}:`, error);
            }
        }
    }
    console.log('Command handlers loaded.');
}

/**
 * Set up presence rotation for the bot
 */
function setupPresenceRotation() {
    if (!client.user) {
        console.warn("Cannot setup presence rotation before client is ready.");
        return;
    }
    const activities = [
        {name: 'with reaction roles', type: ActivityType.Playing},
        {name: 'DreamingDragons', type: ActivityType.Watching},
        {name: 'cool people', type: ActivityType.Listening},
        {name: () => `in ${client.guilds.cache.size} servers`, type: ActivityType.Playing}
    ];
    let activityIndex = 0;

    const updatePresence = () => {
        if (!client.user) return;
        const currentActivity = activities[activityIndex];
        const activityName = typeof currentActivity.name === 'function' ? currentActivity.name() : currentActivity.name;

        client.user.setPresence({
            activities: [{name: activityName, type: currentActivity.type}],
            status: 'online'
        });
        activityIndex = (activityIndex + 1) % activities.length;
    };

    updatePresence(); // Initial presence
    setInterval(updatePresence, 3 * 60 * 1000); // Rotate every 3 minutes
}

/**
 * Handle chat command interactions
 */
async function handleCommandInteraction(interaction, pb) {
    if (!pb) {
        console.error("PocketBase instance unavailable for command interaction.");
        if (!interaction.replied && !interaction.deferred) {
            try {
                await interaction.reply({content: 'Bot is initializing, please wait.', ephemeral: true});
            } catch { /* ignore */
            }
        }
        return;
    }
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        try {
            await interaction.reply({content: `Command not found: ${interaction.commandName}`, ephemeral: true});
        } catch (e) {
            console.error("Error replying to unknown command interaction:", e);
        }
        return;
    }

    try {
        await command.execute(interaction, pb);
    } catch (error) {
        console.error(`Error executing command ${interaction.commandName}:`, error);
        const response = {content: 'There was an error executing this command!', ephemeral: true};
        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(response);
            } else {
                await interaction.reply(response);
            }
        } catch (replyError) {
            console.error("Error sending error reply:", replyError);
        }
    }
}

/**
 * Process message reaction add events
 */
async function handleReactionAdd(reaction, user, pb) {
    if (!pb || user.bot || !reaction.message.guild) return;

    try {
        if (reaction.partial) await reaction.fetch();
        if (reaction.message.partial) await reaction.message.fetch();
        if (!reaction.message.guildId) return;

        const {message, emoji} = reaction;
        const emojiIdentifier = emoji.id ? `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>` : emoji.name;

        const filter = pb.filter(
            `guild_id = {:guild_id} && message_id = {:message_id} && emoji_identifier = {:emoji_identifier}`,
            {guild_id: message.guildId, message_id: message.id, emoji_identifier: emojiIdentifier}
        );

        const resultList = await pb.collection('reaction_roles').getList(1, 1, {filter});

        if (resultList.totalItems > 0) {
            const config = resultList.items[0];
            const roleId = config.role_id;
            const guild = reaction.message.guild;
            const member = await guild.members.fetch(user.id);

            if (!member || member.roles.cache.has(roleId)) return;

            await member.roles.add(roleId);
            console.log(`[Reaction Add] Role ${roleId} added to ${user.tag} in ${guild.id}`);

            // Send temporary notification message
            try {
                const role = guild.roles.cache.get(roleId);
                const roleName = role?.name || "Unknown Role";
                const roleColor = role?.color || 0x3498db;

                const tempMessage = await message.channel.send({
                    content: `<@${user.id}>`,
                    embeds: [{
                        color: roleColor,
                        description: `✅ You've received the **${roleName}** role!`,
                        footer: {text: "This notification will disappear shortly."}
                    }]
                });
                setTimeout(() => {
                    tempMessage.delete().catch(() => {
                    });
                }, 5000);
            } catch (msgError) {
                console.error("Error sending role add notification:", msgError);
            }
        }
    } catch (error) {
        console.error(`Error processing reaction add:`, error);
        if (error.code === 50013) {
            console.error(`[Reaction Add] Missing permissions.`);
        } else if (error.status && error.data) {
            console.error("PB API Error (Reaction Add):", error.status, error.data);
        }
    }
}

/**
 * Process message reaction remove events
 */
async function handleReactionRemove(reaction, user, pb) {
    if (!pb || user.bot || !reaction.message.guild) return;

    try {
        if (reaction.partial) await reaction.fetch();
        if (reaction.message.partial) await reaction.message.fetch();
        if (!reaction.message.guildId) return;

        const {message, emoji} = reaction;
        const emojiIdentifier = emoji.id ? `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>` : emoji.name;

        const filter = pb.filter(
            `guild_id = {:guild_id} && message_id = {:message_id} && emoji_identifier = {:emoji_identifier}`,
            {guild_id: message.guildId, message_id: message.id, emoji_identifier: emojiIdentifier}
        );

        const resultList = await pb.collection('reaction_roles').getList(1, 1, {filter});

        if (resultList.totalItems > 0) {
            const config = resultList.items[0];
            const roleId = config.role_id;
            const guild = reaction.message.guild;
            let member;
            try {
                member = await guild.members.fetch(user.id);
            } catch (memberError) {
                if (memberError.code === 10007) { // Unknown Member
                    console.log(`[Reaction Remove] User ${user.tag} not found in guild ${guild.id}.`);
                } else {
                    console.error(`[Reaction Remove] Error fetching member ${user.tag}:`, memberError);
                }
                return;
            }

            if (!member.roles.cache.has(roleId)) return;

            await member.roles.remove(roleId);
            console.log(`[Reaction Remove] Role ${roleId} removed from ${user.tag} in ${guild.id}`);

            try {
                const role = guild.roles.cache.get(roleId);
                const roleName = role?.name || "Unknown Role";
                const roleColor = role?.color || 0x3498db;

                const tempMessage = await message.channel.send({
                    content: `<@${user.id}>`,
                    embeds: [{
                        color: roleColor,
                        description: `❌ You've lost the **${roleName}** role!`,
                        footer: {text: "This notification will disappear shortly."}
                    }]
                });
                setTimeout(() => {
                    tempMessage.delete().catch(() => {
                    });
                }, 5000);
            } catch (msgError) {
                console.error("Error sending role remove notification:", msgError);
            }
        }
    } catch (error) {
        console.error(`Error processing reaction remove:`, error);
        if (error.code === 50013) {
            console.error(`[Reaction Remove] Missing permissions.`);
        } else if (error.status && error.data) {
            console.error("PB API Error (Reaction Remove):", error.status, error.data);
        }
    }
}

/**
 * Handle autocomplete interactions
 */
async function handleAutocomplete(interaction, pb) {
    if (!pb || !interaction.isAutocomplete() || !interaction.guild) return;

    const {commandName} = interaction;
    const focusedOption = interaction.options.getFocused(true);

    try {
        if (commandName === 'reactionrole' && focusedOption.name === 'message_id') {
            const filter = pb.filter(`guild_id = {:guild_id}`, {guild_id: interaction.guildId});
            const records = await pb.collection('reaction_roles').getList(1, 25, {
                filter,
                sort: '-created'
            });

            const uniqueMessages = new Map();

            records.items.forEach(role => {
                if (!uniqueMessages.has(role.message_id)) {
                    uniqueMessages.set(role.message_id, role);
                }
            });

            const choices = Array.from(uniqueMessages.values()).map(role => {
                const messageSnippet = role.message_id.length > 60 ? role.message_id.substring(0, 57) + '...' : role.message_id;
                return {
                    name: `Message ID: ${messageSnippet}`,
                    value: role.message_id
                };
            });
            await interaction.respond(choices);
        } else if (commandName === 'deviantart' && focusedOption.name === 'feed_id') {
            const filter = pb.filter(`guild_id = {:guild_id} && url ~ {:query}`, {
                guild_id: interaction.guildId,
                query: focusedOption.value
            });
            const records = await pb.collection('deviantart_feeds').getList(1, 25, {
                filter,
                sort: '-created'
            });

            const choices = records.items.map(feed => {
                const urlSnippet = feed.url.length > 60 ? feed.url.substring(0, 57) + '...' : feed.url;
                return {
                    name: `Feed: ${urlSnippet}`,
                    value: feed.id
                };
            });
            await interaction.respond(choices);
        }
    } catch (error) {
        console.error(`Error handling autocomplete for ${commandName}/${focusedOption.name}:`, error);
        if (error.status && error.data) {
            console.error("PB API Error (Autocomplete):", error.status, error.data);
        }
        try {
            await interaction.respond([]);
        } catch {}
    }
}

/**
 * Handle message creation events for XP
 */
async function handleMessageCreate(message, pb) {
    if (!pb || message.author.bot || !message.guild || message.interaction) return;
    if (!message.content && message.attachments.size === 0 && message.embeds.length === 0) return;

    try {
        await addXpToUser(message.author.id, message.guild.id, client, pb);
    } catch (error) {
        console.error('Error in XP system:', error);
        if (error.status && error.data) {
            console.error("PB API Error (XP System):", error.status, error.data);
        }
    }
}

// Main execution flow
async function main() {
    try {
        await loadCommands();

        client.once(Events.ClientReady, async c => {
            console.log(`Ready! Logged in as ${c.user.tag}`);
            try {
                pbInstance = await getPb();
                console.log('PocketBase connection established.');

                setupPresenceRotation();
                await loadReactionRoleMessages(client, pbInstance);
                await startDeviantArtCheckers(client, pbInstance);

            } catch (error) {
                console.error("FATAL: Failed to initialize PocketBase during ClientReady.", error);
                process.exit(1);
            }
        });

        client.on(Events.InteractionCreate, interaction => {
            if (interaction.isChatInputCommand()) handleCommandInteraction(interaction, pbInstance);
            else if (interaction.isAutocomplete()) handleAutocomplete(interaction, pbInstance);
        });
        client.on(Events.MessageReactionAdd, (reaction, user) => handleReactionAdd(reaction, user, pbInstance));
        client.on(Events.MessageReactionRemove, (reaction, user) => handleReactionRemove(reaction, user, pbInstance));
        client.on(Events.MessageCreate, (message) => handleMessageCreate(message, pbInstance));

        // Login to Discord
        console.log('Logging into Discord...');
        await client.login(process.env.DISCORD_BOT_TOKEN);
        console.log('Login successful!');

        // Graceful shutdown
        process.on('SIGINT', () => {
            console.log('SIGINT received. Shutting down bot...');
            client.destroy();
            console.log('Bot shut down.');
            process.exit(0);
        });
        process.on('SIGTERM', () => {
            console.log('SIGTERM received. Shutting down bot...');
            client.destroy();
            console.log('Bot shut down.');
            process.exit(0);
        });

    } catch (error) {
        console.error('Fatal error during bot setup:', error);
        process.exit(1);
    }
}

// Start the bot
main();