/**
 * Shared reaction-role operations used by BOTH the /reactionrole slash command and
 * the internal HTTP API (api/server.js). These touch Discord (posting/editing
 * messages, adding reactions/buttons) so they must run inside the bot process.
 */
import { PermissionsBitField } from 'discord.js';
import { parseColorHex } from './utils.js';
import {
    getEmojiIdentifier,
    buildReactionRoleEmbed,
    refreshButtonMessage
} from './reactionroles.js';

/** Error thrown by service functions; carries a user-facing message. */
export class ReactionServiceError extends Error {}

/**
 * Reject roles the bot cannot assign (hierarchy / managed / @everyone).
 * @returns {string|null} an error message, or null if the role is assignable.
 */
export function validateAssignableRole(guild, role) {
    const botMember = guild.members.me;
    if (botMember && botMember.roles.highest.position <= role.position) {
        return `I cannot assign **${role.name}** because it is higher than or equal to my highest role.`;
    }
    if (role.id === guild.id || role.managed) {
        return 'I cannot assign the @everyone role or managed roles (e.g. Nitro Booster).';
    }
    return null;
}

/** Resolve a role from a guild or throw a friendly error. */
async function requireRole(guild, roleId) {
    const role = guild.roles.cache.get(roleId) || (await guild.roles.fetch(roleId).catch(() => null));
    if (!role) throw new ReactionServiceError(`Role \`${roleId}\` was not found in this server.`);
    const err = validateAssignableRole(guild, role);
    if (err) throw new ReactionServiceError(err);
    return role;
}

/**
 * Create a new reaction-role message and its entries.
 * @param {object} p
 * @param {string} p.channelId
 * @param {{title?:string,description:string,color?:string}} p.embed
 * @param {Array<{roleId:string,mode?:'button'|'reaction',emoji?:string,label?:string,style?:string}>} p.entries
 * @returns {Promise<{messageId:string, channelId:string, count:number}>}
 */
export async function createMessage(client, pb, guildId, { channelId, embed, entries }) {
    const guild = await client.guilds.fetch(guildId);
    if (!Array.isArray(entries) || entries.length === 0) {
        throw new ReactionServiceError('At least one role entry is required.');
    }

    const useButton = (entries[0].mode ?? 'button') === 'button';
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || channel.guildId !== guildId) {
        throw new ReactionServiceError('Target channel was not found in this server.');
    }

    // Permission check.
    const perms = channel.permissionsFor(guild.members.me);
    const need = [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.EmbedLinks];
    if (!useButton) need.push(PermissionsBitField.Flags.AddReactions);
    if (!perms || !perms.has(need)) {
        throw new ReactionServiceError(`I lack permissions in that channel (need Send Messages, Embed Links${useButton ? '' : ', Add Reactions'}).`);
    }

    // Validate every entry up-front so we don't post a half-configured message.
    const prepared = [];
    for (const e of entries) {
        const role = await requireRole(guild, e.roleId);
        let emojiId = e.emoji ? getEmojiIdentifier(e.emoji) : null;
        if (e.emoji && !emojiId) throw new ReactionServiceError(`Invalid emoji: "${e.emoji}".`);
        if (!useButton && !emojiId) throw new ReactionServiceError(`An emoji is required for reaction-mode role ${role.name}.`);
        prepared.push({ role, emojiId, label: e.label || '', style: e.style || 'secondary' });
    }

    const builtEmbed = buildReactionRoleEmbed({
        description: embed?.description,
        title: embed?.title,
        color: embed?.color,
        roleColor: prepared[0].role.color || undefined
    });
    const message = await channel.send({ embeds: [builtEmbed] });

    for (const p of prepared) {
        await pb.collection('reaction_roles').create({
            guild_id: guildId, channel_id: channelId, message_id: message.id,
            emoji_identifier: p.emojiId || '', role_id: p.role.id,
            component_type: useButton ? 'button' : 'reaction',
            label: useButton ? p.label : '', button_style: useButton ? p.style : ''
        });
    }

    if (useButton) {
        await refreshButtonMessage(client, pb, guildId, channelId, message.id);
    } else {
        for (const p of prepared) await message.react(p.emojiId);
    }

    return { messageId: message.id, channelId, count: prepared.length };
}

/** Fetch the Discord message backing a reaction-role group, or throw. */
async function fetchGroupMessage(client, pb, guildId, messageId) {
    const first = await pb.collection('reaction_roles').getList(1, 1, {
        filter: pb.filter('guild_id = {:g} && message_id = {:m}', { g: guildId, m: messageId }),
        sort: 'created'
    });
    if (first.totalItems === 0) {
        throw new ReactionServiceError(`No reaction-role message found with ID \`${messageId}\`.`);
    }
    const channelId = first.items[0].channel_id;
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) throw new ReactionServiceError('The channel for that message no longer exists.');
    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message) throw new ReactionServiceError('That Discord message no longer exists.');
    return { channelId, channel, message, isButton: first.items[0].component_type === 'button' };
}

/** Update the embed (title/description/color) of an existing message. */
export async function updateEmbed(client, pb, guildId, messageId, embed) {
    const { message } = await fetchGroupMessage(client, pb, guildId, messageId);
    const current = message.embeds[0];
    const next = buildReactionRoleEmbed({
        description: embed?.description ?? current?.description ?? '',
        title: embed?.title ?? current?.title ?? undefined,
        color: embed?.color,
        roleColor: current?.color ?? undefined
    });
    await message.edit({ embeds: [next] });
    return { messageId };
}

/** Add one role entry to an existing message (mode is fixed by the message). */
export async function addEntry(client, pb, guildId, messageId, entry) {
    const guild = await client.guilds.fetch(guildId);
    const { channelId, message, isButton } = await fetchGroupMessage(client, pb, guildId, messageId);
    const role = await requireRole(guild, entry.roleId);

    let emojiId = entry.emoji ? getEmojiIdentifier(entry.emoji) : null;
    if (entry.emoji && !emojiId) throw new ReactionServiceError(`Invalid emoji: "${entry.emoji}".`);
    if (!isButton && !emojiId) throw new ReactionServiceError('This is a reaction message, so an emoji is required.');

    const dupe = await pb.collection('reaction_roles').getList(1, 1, {
        filter: pb.filter('message_id = {:m} && role_id = {:r} && guild_id = {:g}', { m: messageId, r: role.id, g: guildId })
    });
    if (dupe.totalItems > 0) throw new ReactionServiceError(`Role ${role.name} is already on this message.`);

    if (isButton) {
        const count = await pb.collection('reaction_roles').getList(1, 1, {
            filter: pb.filter('message_id = {:m}', { m: messageId })
        });
        if (count.totalItems >= 25) throw new ReactionServiceError('This message already has the maximum of 25 buttons.');
    }

    await pb.collection('reaction_roles').create({
        guild_id: guildId, channel_id: channelId, message_id: messageId,
        emoji_identifier: emojiId || '', role_id: role.id,
        component_type: isButton ? 'button' : 'reaction',
        label: isButton ? (entry.label || '') : '', button_style: isButton ? (entry.style || 'secondary') : ''
    });

    if (isButton) await refreshButtonMessage(client, pb, guildId, channelId, messageId);
    else await message.react(emojiId);
    return { messageId, roleId: role.id };
}

/** Edit a single entry (role/emoji/label/style) identified by its record id. */
export async function editEntry(client, pb, guildId, recordId, patch) {
    const guild = await client.guilds.fetch(guildId);
    const record = await pb.collection('reaction_roles').getOne(recordId).catch(() => null);
    if (!record || record.guild_id !== guildId) {
        throw new ReactionServiceError('That reaction-role entry was not found.');
    }
    const isButton = record.component_type === 'button';
    const { channelId, message } = await fetchGroupMessage(client, pb, guildId, record.message_id);

    const update = {};
    if (patch.roleId && patch.roleId !== record.role_id) {
        const role = await requireRole(guild, patch.roleId);
        update.role_id = role.id;
    }
    if (isButton && patch.label !== undefined) update.label = patch.label || '';
    if (isButton && patch.style) update.button_style = patch.style;

    let newEmojiId;
    if (patch.emoji !== undefined) {
        newEmojiId = patch.emoji ? getEmojiIdentifier(patch.emoji) : '';
        if (patch.emoji && !newEmojiId) throw new ReactionServiceError(`Invalid emoji: "${patch.emoji}".`);
        if (!isButton && !newEmojiId) throw new ReactionServiceError('An emoji is required for reaction messages.');
        update.emoji_identifier = newEmojiId;
    }

    await pb.collection('reaction_roles').update(recordId, update);

    if (isButton) {
        await refreshButtonMessage(client, pb, guildId, channelId, record.message_id);
    } else if (newEmojiId !== undefined && newEmojiId !== record.emoji_identifier) {
        const old = message.reactions.cache.find((r) =>
            r.emoji.id ? r.emoji.toString() === record.emoji_identifier : r.emoji.name === record.emoji_identifier);
        if (old) await old.users.remove(client.user.id).catch(() => {});
        if (newEmojiId) await message.react(newEmojiId);
    }
    return { recordId };
}

/** Remove a single entry by record id and clean up its reaction/button. */
export async function removeEntry(client, pb, guildId, recordId) {
    const record = await pb.collection('reaction_roles').getOne(recordId).catch(() => null);
    if (!record || record.guild_id !== guildId) {
        throw new ReactionServiceError('That reaction-role entry was not found.');
    }
    const isButton = record.component_type === 'button';
    await pb.collection('reaction_roles').delete(recordId);

    try {
        const { channelId, message } = await fetchGroupMessage(client, pb, guildId, record.message_id);
        if (isButton) {
            await refreshButtonMessage(client, pb, guildId, channelId, record.message_id);
        } else {
            const reaction = message.reactions.cache.find((r) =>
                r.emoji.id ? r.emoji.toString() === record.emoji_identifier : r.emoji.name === record.emoji_identifier);
            if (reaction) await reaction.users.remove(client.user.id).catch(() => {});
        }
    } catch {
        // Message already gone; DB row is removed regardless.
    }
    return { recordId, messageId: record.message_id };
}

/** Delete every entry for a message and either delete or clean the Discord message. */
export async function deleteMessage(client, pb, guildId, messageId, { deleteDiscordMessage = false } = {}) {
    const records = await pb.collection('reaction_roles').getFullList({
        filter: pb.filter('guild_id = {:g} && message_id = {:m}', { g: guildId, m: messageId })
    });
    if (records.length === 0) throw new ReactionServiceError(`No reaction roles found for message \`${messageId}\`.`);

    try {
        const channel = await client.channels.fetch(records[0].channel_id);
        const message = await channel.messages.fetch(messageId);
        if (deleteDiscordMessage) await message.delete();
        else if (records[0].component_type === 'button') await message.edit({ components: [] });
        else await message.reactions.removeAll();
    } catch {
        // Message may already be gone; continue with DB cleanup.
    }

    for (const r of records) await pb.collection('reaction_roles').delete(r.id);
    return { messageId, removed: records.length, deletedDiscordMessage: deleteDiscordMessage };
}



