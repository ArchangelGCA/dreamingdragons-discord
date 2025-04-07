import {SlashCommandBuilder, EmbedBuilder, PermissionsBitField, ChannelType, InteractionContextType} from 'discord.js';
import {parseColorHex} from "../../utils/utils.js";

// Helper function to validate and extract emoji identifier
function getEmojiIdentifier(emojiString) {
    if (!emojiString) return null;

    // Check if it's a standard Unicode emoji
    const unicodeEmojiRegex = /\p{Emoji}/u;
    if (unicodeEmojiRegex.test(emojiString)) {
        return emojiString; // Unicode of Emoji
    }

    // Check if it's a custom Discord emoji <:name:id>
    const customEmojiRegex = /<a?:.+:(\d+)>$/;
    const match = emojiString.match(customEmojiRegex);
    if (match) {
        return match[0]; // Return the full custom emoji string for reaction matching later "<:name:id>"
        // return match[1]; // Just the ID
    }

    return null;
}


export default {
    data: new SlashCommandBuilder()
        .setName('reactionrole')
        .setDescription('Manage reaction roles.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator) // Only admins can use this
        .setContexts(InteractionContextType.Guild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Create a new reaction role message with the first reaction.')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The channel to send the reaction message to.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('message_content')
                        .setDescription('The text content for the reaction message (use \\n for new lines).')
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role to assign.')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('emoji')
                        .setDescription('The emoji users should react with (e.g., 👍 or a custom server emoji).')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('embed_title')
                        .setDescription('Optional: Title for the embed message.')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('color')
                        .setDescription('Optional: Custom color for the embed (hex code like #FF0000 for red)')
                        .setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add another reaction role to an existing message.')
                .addStringOption(option =>
                    option.setName('message_id')
                        .setDescription('The ID of the existing reaction role message.')
                        .setAutocomplete(true)
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role to assign.')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('emoji')
                        .setDescription('The emoji users should react with (e.g., 👍 or a custom server emoji).')
                        .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all reaction roles for a message.')
                .addStringOption(option =>
                    option.setName('message_id')
                        .setDescription('The ID of the reaction role message.')
                        .setAutocomplete(true)
                        .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('edit')
                .setDescription('Edit an existing reaction role message or role assignment.')
                .addStringOption(option =>
                    option.setName('message_id')
                        .setDescription('The ID of the reaction role message.')
                        .setAutocomplete(true)
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('current_emoji')
                        .setDescription('The current emoji of the reaction role to edit.')
                        .setAutocomplete(true)
                        .setRequired(false))
                .addRoleOption(option =>
                    option.setName('new_role')
                        .setDescription('The new role to assign.')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('new_emoji')
                        .setDescription('The new emoji to use.')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('new_message_content')
                        .setDescription('New text content for the message (use \\n for new lines).')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('new_embed_title')
                        .setDescription('New title for the embed message.')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('new_embed_color')
                        .setDescription('New color for the embed (hex code like #FF0000 for red)')
                        .setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a single reaction role from a message.')
                .addStringOption(option =>
                    option.setName('message_id')
                        .setDescription('The ID of the reaction role message.')
                        .setAutocomplete(true)
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('emoji')
                        .setDescription('The emoji of the reaction role to remove.')
                        .setAutocomplete(true)
                        .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete an entire reaction role message with all roles.')
                .addStringOption(option =>
                    option.setName('message_id')
                        .setDescription('The ID of the reaction role message to delete.')
                        .setAutocomplete(true)
                        .setRequired(true))
                .addBooleanOption(option =>
                    option.setName('delete_message')
                        .setDescription('Also delete the actual Discord message? (Default: false)')
                        .setRequired(false))
        ),

    async execute(interaction, pb) {
        if (!interaction.inGuild()) {
            await interaction.reply({content: 'This command can only be used in a server.', flags: { ephemeral: true }});
            return;
        }

        // Check if bot has Manage Roles permission
        const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
        if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            await interaction.reply({
                content: 'I need the "Manage Roles" permission to set up reaction roles.',
                flags: { ephemeral: true }
            });
            return;
        }
        if (!botMember.permissions.has(PermissionsBitField.Flags.SendMessages) || !botMember.permissions.has(PermissionsBitField.Flags.EmbedLinks) || !botMember.permissions.has(PermissionsBitField.Flags.AddReactions)) {
            await interaction.reply({
                content: 'I need `Send Messages`, `Embed Links`, and `Add Reactions` permissions in the target channel.',
                flags: { ephemeral: true }
            });
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        // Commands switch
        switch (subcommand) {
            case 'setup':
                await handleSetup(interaction, pb);
                break;
            case 'add':
                await handleAdd(interaction, pb);
                break;
            case 'list':
                await handleList(interaction, pb);
                break;
            case 'edit':
                await handleEdit(interaction, pb);
                break;
            case 'remove':
                await handleRemove(interaction, pb);
                break;
            case 'delete':
                await handleDelete(interaction, pb);
                break;
            default:
                await interaction.reply({content: 'Unknown subcommand.', flags: { ephemeral: true }});
        }
    },
};

async function handleSetup(interaction, pb) {
    const targetChannel = interaction.options.getChannel('channel');
    const messageContentInput = interaction.options.getString('message_content');
    const role = interaction.options.getRole('role');
    const emojiInput = interaction.options.getString('emoji');
    const embedTitle = interaction.options.getString('embed_title');
    const colorInput = interaction.options.getString('color');

    await interaction.deferReply({ ephemeral: true });

    // Input Validation
    const emojiIdentifier = getEmojiIdentifier(emojiInput);
    if (!emojiIdentifier) {
        await interaction.editReply(`Invalid emoji provided: "${emojiInput}". Please use a standard Unicode emoji or a custom emoji from this server.`);
        return;
    }

    const customColor = parseColorHex(colorInput);

    // Check role hierarchy: Bot's highest role must be higher than the target role
    const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
    if (botMember.roles.highest.position <= role.position) {
        await interaction.editReply(`I cannot assign the role **${role.name}** because it is higher than or equal to my highest role in the server's role hierarchy.`);
        return;
    }
    // Check if the target role is @everyone or a managed role (like Nitro Booster)
    if (role.id === interaction.guild.id || role.managed) {
        await interaction.editReply(`I cannot assign the @everyone role or managed roles like Nitro Booster roles.`);
        return;
    }

    // Check bot permissions in the target channel
    const channelPermissions = targetChannel.permissionsFor(botMember);
    if (!channelPermissions || !channelPermissions.has(PermissionsBitField.Flags.SendMessages) || !channelPermissions.has(PermissionsBitField.Flags.EmbedLinks) || !channelPermissions.has(PermissionsBitField.Flags.AddReactions)) {
        await interaction.editReply(`I lack permissions in ${targetChannel}! Please ensure I have 'Send Messages', 'Embed Links', and 'Add Reactions' permissions there.`);
        return;
    }

    // Create the Message
    try {
        const embed = new EmbedBuilder()
            .setColor(customColor !== null ? customColor : (role.color || 0x0099FF))
            .setDescription(messageContentInput.replace(/\\n/g, '\n\n'));

        if (embedTitle) {
            embed.setTitle(embedTitle);
        }

        const reactionMessage = await targetChannel.send({embeds: [embed]});

        // React to the Message
        await reactionMessage.react(emojiIdentifier);

        // Store in PocketBase
        const data = {
            guild_id: interaction.guildId,
            channel_id: targetChannel.id,
            message_id: reactionMessage.id,
            emoji_identifier: emojiIdentifier, // Store the parsed identifier
            role_id: role.id,
        };

        await pb.collection('reaction_roles').create(data);

        await interaction.editReply(`✅ Reaction role setup complete! Message sent to ${targetChannel}.`);

    } catch (error) {
        console.error("Error setting up reaction role:", error);
        // Try to catch specific errors like unknown emoji
        if (error.code === 10014) { // Unknown Emoji error code
            await interaction.editReply(`Error: I couldn't react with the emoji "${emojiInput}". Is it a custom emoji from *another* server? I can only use standard Unicode emojis or custom emojis from *this* server.`);
        } else if (error.code === 50013) { // Missing Permissions
            await interaction.editReply(`Error: I seem to be missing permissions in ${targetChannel} to send messages or add reactions.`);
        } else {
            await interaction.editReply('❌ An unexpected error occurred while setting up the reaction role. Please check my permissions and the console.');
        }
    }
}

async function handleAdd(interaction, pb) {
    const messageId = interaction.options.getString('message_id');
    const role = interaction.options.getRole('role');
    const emojiInput = interaction.options.getString('emoji');

    await interaction.deferReply({ ephemeral: true });

    try {
        // Validate the emoji
        const emojiIdentifier = getEmojiIdentifier(emojiInput);
        if (!emojiIdentifier) {
            await interaction.editReply(`Invalid emoji provided: "${emojiInput}". Please use a standard Unicode emoji or a custom emoji from this server.`);
            return;
        }

        // Check role hierarchy
        const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
        if (botMember.roles.highest.position <= role.position) {
            await interaction.editReply(`I cannot assign the role **${role.name}** because it is higher than or equal to my highest role.`);
            return;
        }
        if (role.id === interaction.guild.id || role.managed) {
            await interaction.editReply(`I cannot assign the @everyone role or managed roles like Nitro Booster roles.`);
            return;
        }

        // Try to find the existing message
        const filter = pb.filter(`message_id = {:message_id} && guild_id = {:guild_id}`, {message_id: messageId, guild_id: interaction.guildId});
        const existingRecords = await pb.collection('reaction_roles').getList(1, 1, { filter });

        if (existingRecords.totalItems === 0) {
            await interaction.editReply(`No reaction role message found with ID ${messageId} in this server.`);
            return;
        }

        const channelId = existingRecords.items[0].channel_id;

        // Check for duplicate emoji on same message
        const dupeFilter = pb.filter(`message_id = {:message_id} && emoji_identifier = {:emoji_identifier} && guild_id = {:guild_id}`, {message_id: messageId, emoji_identifier: emojiIdentifier, guild_id: interaction.guildId});
        const dupeCheck = await pb.collection('reaction_roles').getList(1, 1, { filter: dupeFilter });
        if (dupeCheck.totalItems > 0) {
            await interaction.editReply(`This emoji is already used on this message for the role <@&${dupeCheck.items[0].role_id}>.`);
            return;
        }

        // Fetch the message to add a reaction
        const channel = await interaction.client.channels.fetch(channelId);
        const message = await channel.messages.fetch(messageId);

        // Add the reaction
        await message.react(emojiIdentifier);

        // Store in PocketBase
        const data = {
            guild_id: interaction.guildId,
            channel_id: channelId,
            message_id: messageId,
            emoji_identifier: emojiIdentifier,
            role_id: role.id,
        };

        await pb.collection('reaction_roles').create(data);

        await interaction.editReply(`✅ Added reaction role: ${emojiInput} → ${role.name}`);

    } catch (error) {
        console.error("Error adding reaction role:", error);

        if (error.code === 10008) { // Unknown Message
            await interaction.editReply(`Error: Message with ID ${messageId} not found. Please check the ID and try again.`);
        } else if (error.code === 10014) { // Unknown Emoji
            await interaction.editReply(`Error: I couldn't react with the emoji "${emojiInput}". Is it from another server?`);
        } else if (error.code === 50013) { // Missing Permissions
            await interaction.editReply(`Error: I'm missing permissions to add reactions to the message.`);
        } else {
            await interaction.editReply('❌ An error occurred while adding the reaction role. Check the console for details.');
        }
    }
}

async function handleList(interaction, pb) {
    const messageId = interaction.options.getString('message_id');
    await interaction.deferReply({ephemeral: true });

    try {
        const filter = pb.filter(`message_id = {:message_id} && guild_id = {:guild_id}`, {message_id: messageId, guild_id: interaction.guildId});
        const records = await pb.collection('reaction_roles').getList(1, 50, { filter });

        if (records.totalItems === 0) {
            await interaction.editReply(`No reaction roles found for message ID ${messageId}.`);
            return;
        }

        const rolesList = records.items.map(record =>
            `${record.emoji_identifier} → <@&${record.role_id}>`
        ).join('\n');

        await interaction.editReply(`**Reaction Roles for Message ${messageId}:**\n${rolesList}`);

    } catch (error) {
        console.error("Error listing reaction roles:", error);
        await interaction.editReply('❌ An error occurred while listing the reaction roles.');
    }
}

async function handleEdit(interaction, pb) {
    const messageId = interaction.options.getString('message_id');
    const currentEmojiInput = interaction.options.getString('current_emoji');
    const newRole = interaction.options.getRole('new_role');
    const newEmojiInput = interaction.options.getString('new_emoji');
    const newMessageContent = interaction.options.getString('new_message_content');
    const newEmbedTitle = interaction.options.getString('new_embed_title');
    const newColorInput = interaction.options.getString('new_embed_color');

    // Check if we're editing roles/emojis or the message itself
    const isEditingRoleEmoji = currentEmojiInput && (newRole || newEmojiInput);
    const isEditingMessage = newMessageContent || newEmbedTitle || newColorInput;

    // Require at least one change
    if (!isEditingRoleEmoji && !isEditingMessage) {
        await interaction.reply({
            content: 'You must specify at least one thing to change (role, emoji, message content, title or color).',
            ephemeral: true,
        });
        return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        // Find any existing reaction role record to get channel ID
        const recordFilter = pb.filter(`message_id = {:message_id} && guild_id = {:guild_id}`,
            {message_id: messageId, guild_id: interaction.guildId});
        const existingRecords = await pb.collection('reaction_roles').getList(1, 1, { filter: recordFilter });

        if (existingRecords.totalItems === 0) {
            await interaction.editReply(`No reaction role message found with ID ${messageId} in this server.`);
            return;
        }

        const channelId = existingRecords.items[0].channel_id;

        // Get the message to update
        const channel = await interaction.client.channels.fetch(channelId);
        const message = await channel.messages.fetch(messageId);

        if (!message) {
            await interaction.editReply(`Message with ID ${messageId} not found. It may have been deleted.`);
            return;
        }

        // Edit role/emoji if requested
        if (isEditingRoleEmoji) {
            // Validate current emoji
            const currentEmojiIdentifier = getEmojiIdentifier(currentEmojiInput);
            if (!currentEmojiIdentifier) {
                await interaction.editReply(`Invalid current emoji: "${currentEmojiInput}". Please use a standard Unicode emoji or a custom emoji from this server.`);
                return;
            }

            // Validate new emoji if provided
            let newEmojiIdentifier = null;
            if (newEmojiInput) {
                newEmojiIdentifier = getEmojiIdentifier(newEmojiInput);
                if (!newEmojiIdentifier) {
                    await interaction.editReply(`Invalid new emoji: "${newEmojiInput}". Please use a standard Unicode emoji or a custom emoji from this server.`);
                    return;
                }
            }

            // Find the specific reaction role record
            const roleFilter = pb.filter(`message_id = {:message_id} && emoji_identifier = {:current_emoji_identifier} && guild_id = {:guild_id}`,
                {message_id: messageId, current_emoji_identifier: currentEmojiIdentifier, guild_id: interaction.guildId});
            const roleRecords = await pb.collection('reaction_roles').getList(1, 1, { filter: roleFilter });

            if (roleRecords.totalItems === 0) {
                await interaction.editReply(`No reaction role found with emoji ${currentEmojiInput} on message ${messageId}.`);
                return;
            }

            const record = roleRecords.items[0];

            // Check role hierarchy if changing role
            if (newRole) {
                const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
                if (botMember.roles.highest.position <= newRole.position) {
                    await interaction.editReply(`I cannot assign the role **${newRole.name}** because it is higher than or equal to my highest role.`);
                    return;
                }
                if (newRole.id === interaction.guild.id || newRole.managed) {
                    await interaction.editReply(`I cannot assign the @everyone role or managed roles like Nitro Booster roles.`);
                    return;
                }
            }

            // Check for duplicate emoji if changing emoji
            if (newEmojiIdentifier) {
                const dupeFilter = pb.filter(`message_id = {:message_id} && emoji_identifier = {:new_emoji_identifier} && guild_id = {:guild_id}`,
                    {message_id: messageId, new_emoji_identifier: newEmojiIdentifier, guild_id: interaction.guildId});
                const dupeCheck = await pb.collection('reaction_roles').getList(1, 1, { filter: dupeFilter });
                if (dupeCheck.totalItems > 0 && dupeCheck.items[0].id !== record.id) {
                    await interaction.editReply(`This emoji is already used on this message for the role <@&${dupeCheck.items[0].role_id}>.`);
                    return;
                }
            }

            // Update the reaction if emoji is changing
            if (newEmojiIdentifier) {
                // Remove the old reaction from the bot
                const reactions = message.reactions.cache;
                const oldReaction = reactions.find(r =>
                    r.emoji.id ? r.emoji.toString() === currentEmojiIdentifier : r.emoji.name === currentEmojiIdentifier
                );

                if (oldReaction) {
                    await oldReaction.users.remove(interaction.client.user.id);
                }

                // Add the new reaction
                await message.react(newEmojiIdentifier);
            }

            // Update database record for role/emoji
            const updateData = {};
            if (newRole) updateData.role_id = newRole.id;
            if (newEmojiIdentifier) updateData.emoji_identifier = newEmojiIdentifier;

            await pb.collection('reaction_roles').update(record.id, updateData);
        }

        // Edit message content/title if requested
        if (isEditingMessage) {
            // Get the current embed
            const currentEmbed = message.embeds[0];
            if (!currentEmbed) {
                await interaction.editReply('Error: Message does not have an embed to edit.');
                return;
            }

            // Create new embed based on the current one
            const newEmbed = EmbedBuilder.from(currentEmbed);

            // Update description if provided
            if (newMessageContent) {
                newEmbed.setDescription(newMessageContent.replace(/\\n/g, '\n\n'));
            }

            // Update title if provided
            if (newEmbedTitle) {
                newEmbed.setTitle(newEmbedTitle);
            } else if (newEmbedTitle === '') {
                // If empty string is provided, remove the title
                newEmbed.setTitle(null);
            }

            // Update color if provided
            if (newColorInput) {
                const newColor = parseColorHex(newColorInput);
                if (newColor !== null) {
                    newEmbed.setColor(newColor);
                } else {
                    await interaction.editReply(`Invalid color format: ${newColorInput}. Please use a hex color code like #FF0000.`);
                    return;
                }
            }

            // Update the message
            await message.edit({ embeds: [newEmbed] });
        }

        // Build success message
        let successMsg = '✅ Reaction role message updated:';
        if (newRole) successMsg += ` Role changed to ${newRole.name}.`;
        if (newEmojiInput) successMsg += ` Emoji changed to ${newEmojiInput}.`;
        if (newMessageContent) successMsg += ` Message content updated.`;
        if (newEmbedTitle !== undefined && newEmbedTitle !== '') successMsg += ` Title updated.`;
        if (newColorInput) successMsg += ` Color updated.`;

        await interaction.editReply(successMsg);

    } catch (error) {
        console.error("Error editing reaction role:", error);

        if (error.code === 10008) { // Unknown Message
            await interaction.editReply(`Error: Message with ID ${messageId} not found. It may have been deleted.`);
        } else if (error.code === 10014) { // Unknown Emoji
            await interaction.editReply(`Error: I couldn't use the emoji. Is it from another server?`);
        } else if (error.code === 50013) { // Missing Permissions
            await interaction.editReply(`Error: I'm missing permissions to modify the message or reactions.`);
        } else {
            await interaction.editReply('❌ An error occurred while editing the reaction role message. Check the console for details.');
        }
    }
}

async function handleRemove(interaction, pb) {
    const messageId = interaction.options.getString('message_id');
    const emojiInput = interaction.options.getString('emoji');

    await interaction.deferReply({ ephemeral: true });

    try {
        // Validate the emoji
        const emojiIdentifier = emojiInput; // Already from autocomplete, so should be valid

        // Find the reaction role record
        const filter = pb.filter(`message_id = {:message_id} && emoji_identifier = {:emoji} && guild_id = {:guild_id}`,
            {message_id: messageId, emoji: emojiIdentifier, guild_id: interaction.guildId});
        const records = await pb.collection('reaction_roles').getList(1, 1, { filter });

        if (records.totalItems === 0) {
            await interaction.editReply(`No reaction role found with emoji ${emojiInput} on message ${messageId}.`);
            return;
        }

        const record = records.items[0];
        const channelId = record.channel_id;
        const roleId = record.role_id;
        const role = interaction.guild.roles.cache.get(roleId);
        const roleName = role ? role.name : `Unknown Role (${roleId})`;

        // Get the message to remove reaction
        const channel = await interaction.client.channels.fetch(channelId);
        const message = await channel.messages.fetch(messageId);

        // Remove the reaction from the bot
        const reactions = message.reactions.cache;
        const reaction = reactions.find(r =>
            r.emoji.id ? r.emoji.toString() === emojiIdentifier : r.emoji.name === emojiIdentifier
        );

        if (reaction) {
            await reaction.users.remove(interaction.client.user.id);
        }

        // Delete the record from PocketBase
        await pb.collection('reaction_roles').delete(record.id);

        await interaction.editReply(`✅ Successfully removed the reaction role: ${emojiInput} → ${roleName}`);

    } catch (error) {
        console.error("Error removing reaction role:", error);

        if (error.code === 10008) { // Unknown Message
            await interaction.editReply(`Error: Message with ID ${messageId} not found. It may have been deleted.`);
        } else if (error.code === 50013) { // Missing Permissions
            await interaction.editReply(`Error: I'm missing permissions to modify reactions on the message.`);
        } else {
            await interaction.editReply('❌ An error occurred while removing the reaction role. Check the console for details.');
        }
    }
}

async function handleDelete(interaction, pb) {
    const messageId = interaction.options.getString('message_id');
    const shouldDeleteMessage = interaction.options.getBoolean('delete_message') ?? false;

    await interaction.deferReply({ ephemeral: true });

    try {
        // Find all reaction role records for this message
        const filter = pb.filter(`message_id = {:message_id} && guild_id = {:guild_id}`,
            {message_id: messageId, guild_id: interaction.guildId});
        const records = await pb.collection('reaction_roles').getFullList({ filter });

        if (records.length === 0) {
            await interaction.editReply(`No reaction roles found for message ID ${messageId}.`);
            return;
        }

        // Get unique channel ID (should be the same for all records)
        const channelId = records[0].channel_id;

        try {
            // Get the message
            const channel = await interaction.client.channels.fetch(channelId);
            const message = await channel.messages.fetch(messageId);

            if (shouldDeleteMessage) {
                // Delete the entire message
                await message.delete();
            } else {
                // Just remove all bot reactions
                await message.reactions.removeAll();
            }
        } catch (msgError) {
            console.warn(`Could not find or modify message ${messageId}. It might have been already deleted.`);
            // Continue with database cleanup even if message is gone
        }

        // Delete all records from PocketBase
        for (const record of records) {
            await pb.collection('reaction_roles').delete(record.id);
        }

        const actionText = shouldDeleteMessage ?
            "deleted the Discord message and removed" :
            "removed";

        await interaction.editReply(`✅ Successfully ${actionText} all ${records.length} reaction roles for message ID ${messageId}.`);

    } catch (error) {
        console.error("Error deleting reaction role message:", error);

        if (error.code === 50013) { // Missing Permissions
            await interaction.editReply(`Error: I'm missing permissions to delete the message or remove reactions.`);
        } else {
            await interaction.editReply('❌ An error occurred while deleting the reaction role message. Check the console for details.');
        }
    }
}