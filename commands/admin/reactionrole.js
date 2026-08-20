import {
    SlashCommandBuilder,
    PermissionsBitField,
    ChannelType,
    InteractionContextType,
    MessageFlags
} from 'discord.js';
import { getPb } from '../../utils/pocketbase.js';
import { parseColorHex } from '../../utils/utils.js';
import { replyError, replySuccess, replyEphemeral } from '../../utils/replies.js';
import {
    getEmojiIdentifier,
    BUTTON_STYLE_CHOICES
} from '../../utils/reactionroles.js';
import {
    createMessage,
    addEntry as svcAddEntry,
    editEntry as svcEditEntry,
    removeEntry as svcRemoveEntry,
    updateEmbed as svcUpdateEmbed,
    deleteMessage as svcDeleteMessage,
    ReactionServiceError
} from '../../utils/reactionservice.js';

export default {
    data: new SlashCommandBuilder()
        .setName('reactionrole')
        .setDescription('Manage reaction roles (emoji reactions or modern buttons).')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .setContexts(InteractionContextType.Guild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Create a new reaction role message with its first role.')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The channel to send the message to.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('message_content')
                        .setDescription('The text/description for the message (use \\n for new lines).')
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role to assign.')
                        .setRequired(true))
                .addBooleanOption(option =>
                    option.setName('button')
                        .setDescription('Use a clickable button instead of an emoji reaction (recommended).')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('emoji')
                        .setDescription('Emoji: required for reaction mode, optional decoration for button mode.')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('label')
                        .setDescription('Button mode only: text shown on the button (defaults to role name).')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('style')
                        .setDescription('Button mode only: button color.')
                        .addChoices(...BUTTON_STYLE_CHOICES.map(s => ({ name: s, value: s })))
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('embed_title')
                        .setDescription('Optional: title for the embed message.')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('color')
                        .setDescription('Optional: embed color hex code (e.g. #FF0000).')
                        .setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add another role to an existing reaction role message.')
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
                        .setDescription('Emoji: required for reaction messages, optional for button messages.')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('label')
                        .setDescription('Button messages only: text shown on the button.')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('style')
                        .setDescription('Button messages only: button color.')
                        .addChoices(...BUTTON_STYLE_CHOICES.map(s => ({ name: s, value: s })))
                        .setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all roles for a reaction role message.')
                .addStringOption(option =>
                    option.setName('message_id')
                        .setDescription('The ID of the reaction role message.')
                        .setAutocomplete(true)
                        .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('edit')
                .setDescription('Edit a reaction role message or one of its role entries.')
                .addStringOption(option =>
                    option.setName('message_id')
                        .setDescription('The ID of the reaction role message.')
                        .setAutocomplete(true)
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('current_emoji')
                        .setDescription('Reaction messages: current emoji of the entry to edit.')
                        .setAutocomplete(true)
                        .setRequired(false))
                .addRoleOption(option =>
                    option.setName('target_role')
                        .setDescription('Button messages: the existing role entry to edit.')
                        .setRequired(false))
                .addRoleOption(option =>
                    option.setName('new_role')
                        .setDescription('The new role to assign for this entry.')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('new_emoji')
                        .setDescription('The new emoji for this entry.')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('new_label')
                        .setDescription('Button messages: new button label.')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('new_style')
                        .setDescription('Button messages: new button color.')
                        .addChoices(...BUTTON_STYLE_CHOICES.map(s => ({ name: s, value: s })))
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
                        .setDescription('New embed color hex code (e.g. #FF0000).')
                        .setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a single role from a reaction role message.')
                .addStringOption(option =>
                    option.setName('message_id')
                        .setDescription('The ID of the reaction role message.')
                        .setAutocomplete(true)
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('emoji')
                        .setDescription('Reaction messages: emoji of the entry to remove.')
                        .setAutocomplete(true)
                        .setRequired(false))
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Button messages: the role entry to remove.')
                        .setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete an entire reaction role message and all its roles.')
                .addStringOption(option =>
                    option.setName('message_id')
                        .setDescription('The ID of the reaction role message to delete.')
                        .setAutocomplete(true)
                        .setRequired(true))
                .addBooleanOption(option =>
                    option.setName('delete_message')
                        .setDescription('Also delete the Discord message? (Default: false)')
                        .setRequired(false))
        )
    ,
    async execute(interaction) {
        if (!interaction.inGuild()) {
            await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
            return;
        }

        const botMember = interaction.guild.members.me ?? await interaction.guild.members.fetch(interaction.client.user.id);
        if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            await interaction.reply({ content: 'I need the **Manage Roles** permission to manage reaction roles.', flags: MessageFlags.Ephemeral });
            return;
        }

        const subcommand = interaction.options.getSubcommand();
        const pb = await getPb();

        const handlers = {
            setup: handleSetup,
            add: handleAdd,
            list: handleList,
            edit: handleEdit,
            remove: handleRemove,
            delete: handleDelete
        };

        const handler = handlers[subcommand];
        if (handler) {
            await handler(interaction, pb);
        } else {
            await interaction.reply({ content: 'Unknown subcommand.', flags: MessageFlags.Ephemeral });
        }
    }
};

async function handleSetup(interaction, pb) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const targetChannel = interaction.options.getChannel('channel');
    const messageContent = interaction.options.getString('message_content');
    const role = interaction.options.getRole('role');
    const useButton = interaction.options.getBoolean('button') ?? false;
    const emojiInput = interaction.options.getString('emoji');
    const label = interaction.options.getString('label');
    const style = interaction.options.getString('style') || 'secondary';
    const embedTitle = interaction.options.getString('embed_title');
    const colorInput = interaction.options.getString('color');

    try {
        const { messageId } = await createMessage(interaction.client, pb, interaction.guildId, {
            channelId: targetChannel.id,
            embed: { title: embedTitle, description: messageContent, color: colorInput },
            entries: [{
                roleId: role.id,
                mode: useButton ? 'button' : 'reaction',
                emoji: emojiInput || undefined,
                label: label || undefined,
                style
            }]
        });
        return replySuccess(interaction, `Reaction role created in ${targetChannel} (Message ID: \`${messageId}\`).`);
    } catch (error) {
        if (error instanceof ReactionServiceError) return replyError(interaction, error.message);
        console.error('Error setting up reaction role:', error);
        if (error.code === 10014) return replyError(interaction, `I couldn't use the emoji "${emojiInput}". Custom emojis must be from this server.`);
        if (error.code === 50013) return replyError(interaction, `I'm missing permissions in ${targetChannel}.`);
        return replyError(interaction, 'An unexpected error occurred while setting up the reaction role.');
    }
}

async function handleAdd(interaction, pb) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const messageId = interaction.options.getString('message_id');
    const role = interaction.options.getRole('role');
    const emojiInput = interaction.options.getString('emoji');
    const label = interaction.options.getString('label');
    const style = interaction.options.getString('style') || 'secondary';

    try {
        await svcAddEntry(interaction.client, pb, interaction.guildId, messageId, {
            roleId: role.id, emoji: emojiInput || undefined, label: label || undefined, style
        });
        return replySuccess(interaction, `Added role → <@&${role.id}>.`);
    } catch (error) {
        if (error instanceof ReactionServiceError) return replyError(interaction, error.message);
        console.error('Error adding reaction role:', error);
        if (error.code === 10008) return replyError(interaction, `Message \`${messageId}\` not found.`);
        if (error.code === 10014) return replyError(interaction, `I couldn't use the emoji "${emojiInput}".`);
        if (error.code === 50013) return replyError(interaction, `I'm missing permissions on that message.`);
        return replyError(interaction, 'An error occurred while adding the reaction role.');
    }
}

async function handleList(interaction, pb) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const messageId = interaction.options.getString('message_id');

    try {
        const filter = pb.filter(`message_id = {:m} && guild_id = {:g}`, { m: messageId, g: interaction.guildId });
        const records = await pb.collection('reaction_roles').getFullList({ filter, sort: 'created' });

        if (records.length === 0) {
            return replyError(interaction, `No reaction roles found for message \`${messageId}\`.`);
        }

        const mode = records[0].component_type === 'button' ? 'Buttons' : 'Emoji reactions';
        const lines = records.map(r => {
            if (r.component_type === 'button') {
                const emoji = r.emoji_identifier ? `${r.emoji_identifier} ` : '';
                const lbl = r.label ? ` "${r.label}"` : '';
                return `• ${emoji}[${r.button_style || 'secondary'}]${lbl} → <@&${r.role_id}>`;
            }
            return `• ${r.emoji_identifier} → <@&${r.role_id}>`;
        }).join('\n');

        return replyEphemeral(interaction, `**Reaction roles for \`${messageId}\`** (${mode}):\n${lines}`);
    } catch (error) {
        console.error('Error listing reaction roles:', error);
        return replyError(interaction, 'An error occurred while listing the reaction roles.');
    }
}

async function handleEdit(interaction, pb) {
    const messageId = interaction.options.getString('message_id');
    const currentEmojiInput = interaction.options.getString('current_emoji');
    const targetRole = interaction.options.getRole('target_role');
    const newRole = interaction.options.getRole('new_role');
    const newEmojiInput = interaction.options.getString('new_emoji');
    const newLabel = interaction.options.getString('new_label');
    const newStyle = interaction.options.getString('new_style');
    const newMessageContent = interaction.options.getString('new_message_content');
    const newEmbedTitle = interaction.options.getString('new_embed_title');
    const newColorInput = interaction.options.getString('new_embed_color');

    const isEditingEntry = (currentEmojiInput || targetRole) && (newRole || newEmojiInput || newLabel || newStyle);
    const isEditingMessage = newMessageContent || newEmbedTitle !== null || newColorInput;

    if (!isEditingEntry && !isEditingMessage) {
        return replyEphemeral(
            interaction,
            'Specify something to change: an entry (`current_emoji`/`target_role` + a new_* option) or the message (`new_message_content`/`new_embed_title`/`new_embed_color`).'
        );
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const baseFilter = pb.filter(`message_id = {:m} && guild_id = {:g}`, { m: messageId, g: interaction.guildId });
        const existing = await pb.collection('reaction_roles').getList(1, 1, { filter: baseFilter, sort: 'created' });
        if (existing.totalItems === 0) return replyError(interaction, `No reaction role message found with ID \`${messageId}\`.`);

        const isButton = existing.items[0].component_type === 'button';
        const summary = [];

        if (isEditingEntry) {
            const entryError = await editEntry(interaction, pb, {
                messageId, isButton, currentEmojiInput, targetRole,
                newRole, newEmojiInput, newLabel, newStyle, summary
            });
            if (entryError) return replyError(interaction, entryError);
        }

        if (isEditingMessage) {
            if (newColorInput && parseColorHex(newColorInput) === null) {
                return replyError(interaction, `Invalid color: ${newColorInput}. Use a hex code like #FF0000.`);
            }
            const embedPatch = {};
            if (newMessageContent) embedPatch.description = newMessageContent;
            if (newEmbedTitle !== null) embedPatch.title = newEmbedTitle; // '' clears the title
            if (newColorInput) embedPatch.color = newColorInput;
            await svcUpdateEmbed(interaction.client, pb, interaction.guildId, messageId, embedPatch);
            summary.push('message content updated.');
        }

        return replySuccess(interaction, `Updated: ${summary.join(' ') || 'no changes'}`);
    } catch (error) {
        console.error('Error editing reaction role:', error);
        if (error.code === 10008) return replyError(interaction, `Message \`${messageId}\` not found.`);
        if (error.code === 50013) return replyError(interaction, `I'm missing permissions on that message.`);
        return replyError(interaction, 'An error occurred while editing the reaction role.');
    }
}

/**
 * Locate the entry being edited and delegate the mutation to the reaction service.
 * Mutates `opts.summary`. Returns an error string, or null on success.
 */
async function editEntry(interaction, pb, opts) {
    const { messageId, isButton, currentEmojiInput, targetRole, newRole, newEmojiInput, newLabel, newStyle, summary } = opts;

    // Locate the record being edited.
    let record;
    if (isButton) {
        if (!targetRole) return 'This is a button message — use `target_role` to pick the entry to edit.';
        const f = pb.filter(`message_id = {:m} && role_id = {:r} && guild_id = {:g}`, { m: messageId, r: targetRole.id, g: interaction.guildId });
        const res = await pb.collection('reaction_roles').getList(1, 1, { filter: f });
        if (res.totalItems === 0) return `No button entry for <@&${targetRole.id}> on that message.`;
        record = res.items[0];
    } else {
        if (!currentEmojiInput) return 'This is a reaction message — use `current_emoji` to pick the entry to edit.';
        const currentId = getEmojiIdentifier(currentEmojiInput);
        if (!currentId) return `Invalid current emoji: "${currentEmojiInput}".`;
        const f = pb.filter(`message_id = {:m} && emoji_identifier = {:e} && guild_id = {:g}`, { m: messageId, e: currentId, g: interaction.guildId });
        const res = await pb.collection('reaction_roles').getList(1, 1, { filter: f });
        if (res.totalItems === 0) return `No reaction entry with ${currentEmojiInput} on that message.`;
        record = res.items[0];
    }

    // Build a patch containing only the fields that were actually provided.
    const patch = {};
    if (newRole) { patch.roleId = newRole.id; summary.push(`role → <@&${newRole.id}>.`); }
    if (newEmojiInput !== null) { patch.emoji = newEmojiInput; summary.push(`emoji → ${newEmojiInput || '(none)'}.`); }
    if (isButton && newLabel !== null) { patch.label = newLabel; summary.push('label updated.'); }
    if (isButton && newStyle) { patch.style = newStyle; summary.push(`style → ${newStyle}.`); }

    try {
        await svcEditEntry(interaction.client, pb, interaction.guildId, record.id, patch);
    } catch (error) {
        if (error instanceof ReactionServiceError) return error.message;
        throw error;
    }
    return null;
}

async function handleRemove(interaction, pb) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const messageId = interaction.options.getString('message_id');
    const emojiInput = interaction.options.getString('emoji');
    const role = interaction.options.getRole('role');

    try {
        const baseFilter = pb.filter(`message_id = {:m} && guild_id = {:g}`, { m: messageId, g: interaction.guildId });
        const existing = await pb.collection('reaction_roles').getList(1, 1, { filter: baseFilter, sort: 'created' });
        if (existing.totalItems === 0) return replyError(interaction, `No reaction role message found with ID \`${messageId}\`.`);

        const isButton = existing.items[0].component_type === 'button';

        let record;
        if (isButton) {
            if (!role) return replyError(interaction, 'This is a button message — use `role` to pick the entry to remove.');
            const f = pb.filter(`message_id = {:m} && role_id = {:r} && guild_id = {:g}`, { m: messageId, r: role.id, g: interaction.guildId });
            const res = await pb.collection('reaction_roles').getList(1, 1, { filter: f });
            if (res.totalItems === 0) return replyError(interaction, `No button entry for <@&${role.id}> on that message.`);
            record = res.items[0];
        } else {
            if (!emojiInput) return replyError(interaction, 'This is a reaction message — use `emoji` to pick the entry to remove.');
            const f = pb.filter(`message_id = {:m} && emoji_identifier = {:e} && guild_id = {:g}`, { m: messageId, e: emojiInput, g: interaction.guildId });
            const res = await pb.collection('reaction_roles').getList(1, 1, { filter: f });
            if (res.totalItems === 0) return replyError(interaction, `No reaction entry with ${emojiInput} on that message.`);
            record = res.items[0];
        }

        const roleMention = `<@&${record.role_id}>`;
        await svcRemoveEntry(interaction.client, pb, interaction.guildId, record.id);
        return replySuccess(interaction, `Removed reaction role → ${roleMention}.`);
    } catch (error) {
        if (error instanceof ReactionServiceError) return replyError(interaction, error.message);
        console.error('Error removing reaction role:', error);
        return replyError(interaction, 'An error occurred while removing the reaction role.');
    }
}

async function handleDelete(interaction, pb) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const messageId = interaction.options.getString('message_id');
    const shouldDeleteMessage = interaction.options.getBoolean('delete_message') ?? false;

    try {
        const { removed } = await svcDeleteMessage(interaction.client, pb, interaction.guildId, messageId, {
            deleteDiscordMessage: shouldDeleteMessage
        });
        const action = shouldDeleteMessage ? 'deleted the message and removed' : 'removed';
        return replySuccess(interaction, `Successfully ${action} all ${removed} reaction role(s) for message \`${messageId}\`.`);
    } catch (error) {
        if (error instanceof ReactionServiceError) return replyError(interaction, error.message);
        console.error('Error deleting reaction role message:', error);
        if (error.code === 50013) return replyError(interaction, `I'm missing permissions to modify the message.`);
        return replyError(interaction, 'An error occurred while deleting the reaction role message.');
    }
}

