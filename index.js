import { Client, GatewayIntentBits, Collection, Events } from 'discord.js';
import { startDeviantArtCheckers } from './scrapers/deviantart-checker.js';
import { config } from 'dotenv';
import {initPocketBase} from './utils/pocketbase.js'
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadReactionRoleMessages } from "./init/init.js";
import { addXpToUser } from './utils/leveling.js';

// Load environment variables
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let pb = null;


// Initialize Discord client with required intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers,
    ]
});

// Store commands for easy access
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
                    console.log(`[HANDLER LOADED] ${command.data.name}`);
                } else {
                    console.log(`[WARNING] The command at ${filePath} is missing "data" or "execute" property.`);
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
    const activities = [
        { name: 'with reaction roles', type: 0 },
        { name: 'DreamingDragons', type: 3 },
        { name: 'some cool people', type: 2 },
        { name: `in ${client.guilds.cache.size} servers`, type: 0 }
    ];

    let activityIndex = 0;

    // Initial presence
    client.user.setPresence({
        activities: [activities[0]],
        status: 'online'
    });

    // Rotate status every 3 minutes
    setInterval(() => {
        activityIndex = (activityIndex + 1) % activities.length;
        client.user.setPresence({
            activities: [activities[activityIndex]],
            status: 'online'
        });
    }, 3 * 60 * 1000);
}

/**
 * Setup PocketBase refresh init
 */
async function setupPocketBaseRefresh() {

    console.log('Setting up PocketBase refresh...');

    // First init.
    if (!pb) {
        console.log('Initializing PocketBase...');
        pb = await initPocketBase();
    }

    setInterval(async () => {
        try {
            pb = await initPocketBase();
            console.log('PocketBase refreshed successfully.');
        } catch (error) {
            console.error('Error refreshing PocketBase:', error);
        }
    }, 4 * 60 * 60 * 1000); // 4 hours
}

/**
 * Handle chat command interactions
 */
async function handleCommandInteraction(interaction, pb) {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        try {
            await interaction.reply({ content: `Command not found: ${interaction.commandName}`, ephemeral: true });
        } catch (e) {
            console.error("Error replying to unknown command interaction:", e);
        }
        return;
    }

    try {
        await command.execute(interaction, pb);
    } catch (error) {
        console.error(`Error executing command ${interaction.commandName}:`, error);
        const response = { content: 'There was an error while executing this command!', ephemeral: true };

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(response);
        } else {
            await interaction.reply(response);
        }
    }
}

/**
 * Process message reaction add events
 */
async function handleReactionAdd(reaction, user, pb) {
    // Ignore bots and DMs
    if (user.bot || !reaction.message.guild) return;

    try {
        // Fetch partial data if needed
        if (reaction.partial) await reaction.fetch();
        if (reaction.message.partial) await reaction.message.fetch();

        // Ignore reactions on non-guild messages
        if (!reaction.message.guildId) return;

        const { message, emoji } = reaction;
        const emojiIdentifier = emoji.id ?
            `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>` :
            emoji.name;

        // Query reaction role configuration
        const filter = pb.filter(
            `guild_id = {:guild_id} && message_id = {:message_id} && emoji_identifier = {:emoji_identifier}`,
            { guild_id: message.guildId, message_id: message.id, emoji_identifier: emojiIdentifier }
        );

        const resultList = await pb.collection('reaction_roles').getList(1, 1, { filter });

        if (resultList.totalItems > 0) {
            const config = resultList.items[0];
            const roleId = config.role_id;

            // Fetch the guild member
            const guild = reaction.message.guild;
            const member = await guild.members.fetch(user.id);

            if (member.roles.cache.has(roleId)) {
                // User already has the role
                return;
            }

            // Add the role
            await member.roles.add(roleId);
            console.log(`[Reaction Add] Added role ${roleId} to user ${user.tag} in guild ${guild.id}`);

            // Send a temporary notification message
            try {
                const roleName = guild.roles.cache.get(roleId)?.name || "Unknown Role";
                const roleColor = guild.roles.cache.get(roleId)?.color || 0x3498db;

                const tempMessage = await message.channel.send({
                    content: `<@${user.id}>`,
                    embeds: [{
                        color: roleColor,
                        description: `✅ You've received the **${roleName}** role!`,
                        footer: {
                            text: "This notification will disappear in a few seconds"
                        }
                    }]
                });

                // Delete the notification after 5 seconds
                setTimeout(() => {
                    tempMessage.delete().catch(() => {});
                }, 5000);
            } catch (msgError) {
                console.error("Error sending role notification:", msgError);
            }
        }
    } catch (error) {
        console.error(`Error processing reaction add:`, error);
        if (error.code === 50013) {
            console.error(`[Reaction Add] Missing permissions to add role. Bot role position may be too low.`);
        }
    }
}

/**
 * Process message reaction remove events
 */
async function handleReactionRemove(reaction, user, pb) {
    // Ignore bots and DMs
    if (user.bot || !reaction.message.guild) return;

    try {
        // Fetch partial data if needed
        if (reaction.partial) await reaction.fetch();
        if (reaction.message.partial) await reaction.message.fetch();

        // Ignore reactions on non-guild messages
        if (!reaction.message.guildId) return;

        const { message, emoji } = reaction;
        const emojiIdentifier = emoji.id ?
            `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>` :
            emoji.name;

        // Query reaction role configuration
        const filter = pb.filter(
            `guild_id = {:guild_id} && message_id = {:message_id} && emoji_identifier = {:emoji_identifier}`,
            { guild_id: message.guildId, message_id: message.id, emoji_identifier: emojiIdentifier }
        );

        const resultList = await pb.collection('reaction_roles').getList(1, 1, { filter });

        if (resultList.totalItems > 0) {
            const config = resultList.items[0];
            const roleId = config.role_id;

            // Fetch the guild member
            const guild = reaction.message.guild;
            let member;

            try {
                member = await guild.members.fetch(user.id);
            } catch (memberError) {
                // User may have left the server
                console.log(`[Reaction Remove] User ${user.tag} not found in guild ${guild.id}`);
                return;
            }

            // Check if member has the role
            if (!member.roles.cache.has(roleId)) {
                return;
            }

            // Remove the role
            await member.roles.remove(roleId);
            console.log(`[Reaction Remove] Removed role ${roleId} from user ${user.tag} in guild ${guild.id}`);

            // Send a temporary notification message
            try {
                const roleName = guild.roles.cache.get(roleId)?.name || "Unknown Role";
                const roleColor = guild.roles.cache.get(roleId)?.color || 0x3498db; // Use role color or default blue

                const tempMessage = await message.channel.send({
                    content: `<@${user.id}>`,
                    embeds: [{
                        color: roleColor,
                        description: `❌ You've lost the **${roleName}** role!`,
                        footer: {
                            text: "This notification will disappear in a few seconds"
                        }
                    }]
                });

                // Delete the notification after 5 seconds
                setTimeout(() => {
                    tempMessage.delete().catch(() => {});
                }, 5000);
            } catch (msgError) {
                console.error("Error sending role removal notification:", msgError);
            }
        }
    } catch (error) {
        console.error(`Error processing reaction remove:`, error);
        if (error.code === 50013) {
            console.error(`[Reaction Remove] Missing permissions to remove role. Bot role position may be too low.`);
        }
    }
}

/**
 * Handle autocomplete interactions
 */
async function handleAutocomplete(interaction, pb) {
    if (!interaction.isAutocomplete() || !interaction.guild) return;

    const { commandName } = interaction;
    const focusedOption = interaction.options.getFocused(true);

    try {
        if (commandName === 'reactionrole' && focusedOption.name === 'message_id') {
            // Handle reaction role message_id autocomplete
            // Implementation omitted for brevity
        } else if (commandName === 'deviantart' && focusedOption.name === 'feed_id') {
            const filter = pb.filter(`guild_id = {:guild_id}`, { guild_id: interaction.guildId });
            const records = await pb.collection('deviantart_feeds').getList(1, 25, { filter });

            if (records.totalItems === 0) {
                return await interaction.respond([]);
            }

            const choices = records.items.map(feed => ({
                name: `${feed.url.substring(0, 30)}... (${feed.id})`,
                value: feed.id
            }));

            await interaction.respond(choices);
        }
    } catch (error) {
        console.error(`Error handling autocomplete for ${commandName}:`, error);
        await interaction.respond([]);
    }
}

/**
 * Handle message creation events
 */
async function handleMessageCreate(message, pb) {
    // Ignore bots, DMs, and commands
    if (message.author.bot || !message.guild || message.content.startsWith('/')) return;

    try {
        // Award XP (will handle cooldowns internally)
        const result = await addXpToUser(message.author.id, message.guild.id, client, pb);
    } catch (error) {
        console.error('Error in XP system:', error);
    }
}

// Main execution flow
async function main() {
    try {
        // Load command handlers
        await loadCommands();

        // Register event handlers
        client.once(Events.ClientReady, async c => {
            console.log(`Ready! Logged in as ${c.user.tag}`);

            await setupPocketBaseRefresh();
            setupPresenceRotation();
            await loadReactionRoleMessages(client, pb);
            await startDeviantArtCheckers(client, pb);
        });

        client.on(Events.InteractionCreate, interaction => handleCommandInteraction(interaction, pb));
        client.on(Events.InteractionCreate, interaction => handleAutocomplete(interaction, pb));
        client.on(Events.MessageReactionAdd, (reaction, user) => handleReactionAdd(reaction, user, pb));
        client.on(Events.MessageReactionRemove, (reaction, user) => handleReactionRemove(reaction, user, pb));
        client.on(Events.MessageReactionAdd, (reaction, user) => handleStarReaction(reaction, user, true, client, pb)); // TODO: Use only one handler and implement caching
        client.on(Events.MessageReactionRemove, (reaction, user) => handleStarReaction(reaction, user, false, client, pb)); // TODO: Use only one handler and implement caching
        client.on(Events.MessageCreate, (message) => handleMessageCreate(message, pb));

        // Login to Discord
        console.log('Logging into Discord...');
        await client.login(process.env.DISCORD_BOT_TOKEN);
        console.log('Login successful!');

        // Graceful shutdown
        process.on('SIGINT', () => {
            console.log('Shutting down bot...');
            client.destroy();
            process.exit(0);
        });
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

// Start the bot
main();