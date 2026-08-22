/**
 * Internal HTTP API for the bot.
 *
 * The SvelteKit admin dashboard cannot talk to Discord (only the bot holds the
 * token and the live caches). This tiny, secret-protected HTTP server lets the
 * dashboard's SERVER-SIDE code read Discord metadata (guild/role/channel/member
 * names) and trigger Discord-affecting actions (recover XP, sync roles, manage
 * reaction-role messages).
 *
 * Security: every request except GET /health must carry
 *   Authorization: Bearer <INTERNAL_API_SECRET>
 * checked in constant time. This server is bound to the container only and is
 * NEVER mapped to a host port in docker-compose (internal Docker network only).
 */
import http from 'node:http';
import crypto from 'node:crypto';
import { PermissionsBitField, ChannelType } from 'discord.js';
import { getPb } from '../utils/pocketbase.js';
import { invalidateLevelSettingsCache, invalidateUserCache, invalidateGuildUserCache } from '../utils/leveling.js';
import {
    recoverGuildXp,
    syncGuildRoles,
    setUserXp,
    setUserLevel,
    resetUser
} from '../utils/levelservice.js';
import {
    createMessage,
    updateEmbed,
    addEntry,
    editEntry,
    removeEntry,
    deleteMessage,
    adoptMessage,
    resendMessage,
    listBotMessages,
    ReactionServiceError
} from '../utils/reactionservice.js';
import { extractReactionPanelTexts } from '../utils/reactionroles.js';

const MAX_BODY_BYTES = 256 * 1024;

/** Thrown by handlers to return a specific HTTP status with a message. */
class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

/** Constant-time compare of the provided bearer token against the secret. */
function isAuthorized(req, secret) {
    const header = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return false;
    const a = Buffer.from(token);
    const b = Buffer.from(secret);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Read and JSON-parse the request body (bounded). Returns {} for empty bodies. */
function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];
        req.on('data', (c) => {
            size += c.length;
            if (size > MAX_BODY_BYTES) {
                reject(new HttpError(413, 'Request body too large.'));
                req.destroy();
                return;
            }
            chunks.push(c);
        });
        req.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8').trim();
            if (!raw) return resolve({});
            try {
                resolve(JSON.parse(raw));
            } catch {
                reject(new HttpError(400, 'Invalid JSON body.'));
            }
        });
        req.on('error', () => reject(new HttpError(400, 'Failed to read request body.')));
    });
}

function sendJson(res, status, data) {
    const body = JSON.stringify(data ?? {});
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
    res.end(body);
}

/** Get a guild the bot is in, or throw 404. */
function requireGuild(client, guildId) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) throw new HttpError(404, `Bot is not in guild ${guildId}.`);
    return guild;
}


const TEXT_CHANNEL_TYPES = new Set([ChannelType.GuildText, ChannelType.GuildAnnouncement]);

function toHexColor(int) {
    return '#' + (int & 0xffffff).toString(16).padStart(6, '0');
}

function mapRole(guild, role) {
    const botHighest = guild.members.me?.roles.highest.position ?? 0;
    return {
        id: role.id,
        name: role.name,
        color: role.color ? toHexColor(role.color) : null,
        position: role.position,
        managed: role.managed,
        assignable: !role.managed && role.id !== guild.id && role.position < botHighest
    };
}

function mapChannel(ch) {
    return { id: ch.id, name: ch.name, type: ch.type, position: ch.rawPosition ?? 0 };
}

function mapMember(m) {
    return {
        id: m.id,
        username: m.user.username,
        displayName: m.displayName ?? m.user.globalName ?? m.user.username,
        avatar: m.user.displayAvatarURL({ size: 64 }),
        bot: m.user.bot
    };
}


/** Resolve a batch of user IDs to name/avatar info (members first, then users). */
async function resolveMembers(client, guild, ids) {
    const out = {};
    const missing = [];
    try {
        const found = await guild.members.fetch({ user: ids });
        for (const m of found.values()) out[m.id] = mapMember(m);
    } catch {
        // fall through to per-id resolution below
    }
    for (const id of ids) {
        if (!out[id]) missing.push(id);
    }
    for (const id of missing) {
        const user = await client.users.fetch(id).catch(() => null);
        if (user) {
            out[id] = {
                id: user.id,
                username: user.username,
                displayName: user.globalName ?? user.username,
                avatar: user.displayAvatarURL({ size: 64 }),
                bot: user.bot,
                left: true
            };
        }
    }
    return out;
}

/** Leveling action routes: segments after /guilds/:id/leveling. */
async function handleLeveling(client, pb, guild, rest, method, query, body) {
    const guildId = guild.id;
    // rest e.g. ['settings'] | ['recover'] | ['sync'] | ['users','set-xp'] | ['users', ':userId']
    if (rest[0] === 'settings' && rest.length === 1 && (method === 'PUT' || method === 'POST')) {
        const existing = await pb.collection('level_settings').getList(1, 1, {
            filter: pb.filter('guild_id = {:g}', { g: guildId })
        });
        const data = {
            notification_channel_id: String(body.notification_channel_id || ''),
            xp_per_message: clampInt(body.xp_per_message, 1, 1000, 20),
            xp_cooldown: clampInt(body.xp_cooldown, 1, 86400, 60),
            enabled: !!body.enabled
        };
        if (existing.totalItems > 0) await pb.collection('level_settings').update(existing.items[0].id, data);
        else await pb.collection('level_settings').create({ guild_id: guildId, ...data });
        invalidateLevelSettingsCache(guildId);
        return { ok: true };
    }
    if (rest[0] === 'recover' && rest.length === 1 && method === 'POST') {
        const dryRun = query.get('dryRun') === '1' || query.get('dryRun') === 'true';
        return recoverGuildXp(pb, client, guildId, { dryRun });
    }
    if (rest[0] === 'sync' && rest.length === 1 && method === 'POST') {
        return syncGuildRoles(pb, client, guildId);
    }
    if (rest[0] === 'users' && rest[1] === 'set-xp' && rest.length === 2 && method === 'POST') {
        requireUserId(body.userId);
        return setUserXp(pb, client, guildId, String(body.userId), body.xp);
    }
    if (rest[0] === 'users' && rest[1] === 'set-level' && rest.length === 2 && method === 'POST') {
        requireUserId(body.userId);
        return setUserLevel(pb, client, guildId, String(body.userId), body.level);
    }
    if (rest[0] === 'users' && rest.length === 2 && method === 'DELETE') {
        requireUserId(rest[1]);
        return resetUser(pb, guildId, rest[1]);
    }
    throw new HttpError(404, 'Unknown leveling route.');
}


function clampInt(value, min, max, fallback) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

function requireUserId(userId) {
    if (!userId || !/^\d{5,25}$/.test(String(userId))) {
        throw new HttpError(400, 'A valid Discord user ID is required.');
    }
}

/**
 * Existence check for a batch of reaction-role message IDs (are they still on
 * Discord?). Also returns the message's current embed content (title/description/
 * color) so the dashboard can pre-fill its "edit message text" form instead of
 * making the admin retype everything. Runs the per-message lookups in PARALLEL —
 * a sequential loop here was the main cause of the page feeling "really slow"
 * and of the Add-role button appearing stuck while a reload was in flight.
 */
async function reactionMessagesStatus(client, pb, guildId, messageIds) {
    const ids = messageIds.map(String).filter((s) => /^\d{5,25}$/.test(s)).slice(0, 100);
    const statuses = {};
    if (ids.length === 0) return { statuses };
    const records = await pb.collection('reaction_roles').getFullList({
        filter: pb.filter('guild_id = {:g}', { g: guildId }),
        fields: 'message_id,channel_id'
    });
    const chanOf = new Map();
    for (const r of records) if (!chanOf.has(r.message_id)) chanOf.set(r.message_id, r.channel_id);

    // Cache channel fetches so multiple messages in the same channel share one lookup.
    const channelCache = new Map();
    const fetchChannel = (channelId) => {
        if (!channelCache.has(channelId)) {
            channelCache.set(channelId, client.channels.fetch(channelId).catch(() => null));
        }
        return channelCache.get(channelId);
    };

    await Promise.all(
        ids.map(async (id) => {
            const channelId = chanOf.get(id);
            let status = { exists: false };
            if (channelId) {
                const channel = await fetchChannel(channelId);
                const message = channel ? await channel.messages.fetch(id).catch(() => null) : null;
                if (message) {
                    // CV2 panels keep their texts in the container; legacy ones in embeds.
                    const panel = extractReactionPanelTexts(message);
                    const embed = message.embeds?.[0];
                    status = panel
                        ? {
                            exists: true,
                            title: panel.title,
                            description: panel.description,
                            color: panel.accentColor != null ? toHexColor(panel.accentColor) : ''
                        }
                        : {
                            exists: true,
                            title: embed?.title ?? '',
                            description: embed?.description ?? '',
                            color: typeof embed?.color === 'number' ? toHexColor(embed.color) : ''
                        };
                }
            }
            statuses[id] = status;
        })
    );
    return { statuses };
}

/** Reaction-role routes: segments after /guilds/:id/reaction-roles. */
async function handleReactionRoles(client, pb, guild, rest, method, query, body) {
    const guildId = guild.id;
    try {
        // GET /bot-messages?channelId=…  — bot-authored messages available to adopt
        if (method === 'GET' && rest[0] === 'bot-messages' && rest.length === 1) {
            const channelId = query.get('channelId') || '';
            if (!/^\d{5,25}$/.test(channelId)) throw new HttpError(400, 'A valid channelId is required.');
            return await listBotMessages(client, pb, guildId, channelId, {
                limit: clampInt(query.get('limit'), 1, 100, 50)
            });
        }
        // POST /status  — which stored messages still exist on Discord
        if (method === 'POST' && rest[0] === 'status' && rest.length === 1) {
            return await reactionMessagesStatus(client, pb, guildId, Array.isArray(body.messageIds) ? body.messageIds : []);
        }
        // POST /messages  — create a new message
        if (method === 'POST' && rest[0] === 'messages' && rest.length === 1) {
            return await createMessage(client, pb, guildId, body);
        }
        // POST /messages/adopt  — reuse an existing bot message
        if (method === 'POST' && rest[0] === 'messages' && rest[1] === 'adopt' && rest.length === 2) {
            return await adoptMessage(client, pb, guildId, body);
        }
        // POST /messages/:messageId/resend  — repost a (missing) message
        if (method === 'POST' && rest[0] === 'messages' && rest[2] === 'resend' && rest.length === 3) {
            return await resendMessage(client, pb, guildId, rest[1], body);
        }
        // PATCH /messages/:messageId  — update the embed
        if (method === 'PATCH' && rest[0] === 'messages' && rest.length === 2) {
            return await updateEmbed(client, pb, guildId, rest[1], body.embed ?? body);
        }
        // DELETE /messages/:messageId  — delete the whole message group
        if (method === 'DELETE' && rest[0] === 'messages' && rest.length === 2) {
            const deleteDiscordMessage = query.get('deleteMessage') === '1' || query.get('deleteMessage') === 'true';
            return await deleteMessage(client, pb, guildId, rest[1], { deleteDiscordMessage });
        }
        // POST /messages/:messageId/entries  — add an entry
        if (method === 'POST' && rest[0] === 'messages' && rest[2] === 'entries' && rest.length === 3) {
            return await addEntry(client, pb, guildId, rest[1], body);
        }
        // PATCH /entries/:recordId  — edit an entry
        if (method === 'PATCH' && rest[0] === 'entries' && rest.length === 2) {
            return await editEntry(client, pb, guildId, rest[1], body);
        }
        // DELETE /entries/:recordId  — remove an entry
        if (method === 'DELETE' && rest[0] === 'entries' && rest.length === 2) {
            return await removeEntry(client, pb, guildId, rest[1]);
        }
    } catch (error) {
        if (error instanceof ReactionServiceError) throw new HttpError(422, error.message);
        throw error;
    }
    throw new HttpError(404, 'Unknown reaction-role route.');
}


/** Route a parsed, authenticated request to a handler. Returns the JSON payload. */
async function dispatch(client, method, pathname, query, body) {
    const segments = pathname.split('/').filter(Boolean);

    // /cache/invalidate — best-effort cache busting after direct-to-PB writes.
    if (segments[0] === 'cache' && segments[1] === 'invalidate' && method === 'POST') {
        const guildId = String(body.guildId || '');
        if (!guildId) throw new HttpError(400, 'guildId is required.');
        invalidateLevelSettingsCache(guildId);
        if (body.userId) invalidateUserCache(guildId, String(body.userId));
        else invalidateGuildUserCache(guildId);
        return { ok: true };
    }

    if (segments[0] !== 'guilds') throw new HttpError(404, 'Not found.');

    if (!client.isReady()) throw new HttpError(503, 'Bot is not ready yet.');
    const pb = await getPb();
    if (!pb) throw new HttpError(503, 'Database unavailable.');

    // GET /guilds
    if (segments.length === 1 && method === 'GET') {
        const guilds = [...client.guilds.cache.values()].map((g) => ({
            id: g.id, name: g.name, icon: g.iconURL({ size: 64 }) ?? null, memberCount: g.memberCount
        }));
        guilds.sort((a, b) => a.name.localeCompare(b.name));
        return { guilds };
    }

    const guildId = segments[1];
    const guild = requireGuild(client, guildId);
    const rest = segments.slice(2);

    if (rest.length === 0 && method === 'GET') {
        return {
            id: guild.id, name: guild.name, icon: guild.iconURL({ size: 64 }) ?? null,
            memberCount: guild.memberCount,
            canManageRoles: guild.members.me?.permissions.has(PermissionsBitField.Flags.ManageRoles) ?? false
        };
    }
    if (rest[0] === 'roles' && method === 'GET') {
        const roles = [...guild.roles.cache.values()]
            .filter((r) => r.id !== guild.id)
            .sort((a, b) => b.position - a.position)
            .map((r) => mapRole(guild, r));
        return { roles };
    }
    if (rest[0] === 'channels' && method === 'GET') {
        const channels = [...guild.channels.cache.values()]
            .filter((c) => TEXT_CHANNEL_TYPES.has(c.type))
            .sort((a, b) => (a.rawPosition ?? 0) - (b.rawPosition ?? 0))
            .map(mapChannel);
        return { channels };
    }
    if (rest[0] === 'members' && rest[1] === 'resolve' && method === 'POST') {
        const ids = Array.isArray(body.ids) ? body.ids.map(String).filter((s) => /^\d{5,25}$/.test(s)).slice(0, 100) : [];
        if (ids.length === 0) return { members: {} };
        return { members: await resolveMembers(client, guild, ids) };
    }
    if (rest[0] === 'members' && rest[1] === 'search' && method === 'GET') {
        const q = (query.get('q') || '').trim();
        const limit = clampInt(query.get('limit'), 1, 25, 10);
        if (!q) return { members: [] };
        const found = await guild.members.search({ query: q, limit });
        return { members: [...found.values()].map(mapMember) };
    }
    if (rest[0] === 'leveling') {
        return handleLeveling(client, pb, guild, rest.slice(1), method, query, body);
    }
    if (rest[0] === 'reaction-roles') {
        return handleReactionRoles(client, pb, guild, rest.slice(1), method, query, body);
    }

    throw new HttpError(404, 'Not found.');
}


/**
 * Start the internal API server.
 * @param {import('discord.js').Client} client
 * @returns {import('node:http').Server|null}
 */
export function startApiServer(client) {
    const secret = process.env.INTERNAL_API_SECRET;
    const port = parseInt(process.env.BOT_API_PORT || '8787', 10);

    if (!secret) {
        console.warn('[api] INTERNAL_API_SECRET is not set — internal API DISABLED. The dashboard will run in read-only/degraded mode.');
        return null;
    }
    if (secret.length < 16) {
        console.warn('[api] INTERNAL_API_SECRET is shorter than 16 chars — use a longer random secret.');
    }

    const server = http.createServer(async (req, res) => {
        const url = new URL(req.url, 'http://internal');
        const pathname = url.pathname.replace(/\/+$/, '') || '/';

        // Public health check (no auth) for container orchestration.
        if (pathname === '/health' && req.method === 'GET') {
            return sendJson(res, 200, { ok: true, ready: client.isReady(), guilds: client.guilds.cache.size });
        }

        if (!isAuthorized(req, secret)) {
            return sendJson(res, 401, { error: 'Unauthorized.' });
        }

        try {
            const body = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)
                ? await readJsonBody(req)
                : {};
            const data = await dispatch(client, req.method, pathname, url.searchParams, body);
            sendJson(res, 200, data);
        } catch (error) {
            if (error instanceof HttpError) {
                sendJson(res, error.status, { error: error.message });
            } else {
                console.error('[api] handler error:', error);
                sendJson(res, 500, { error: 'Internal error.' });
            }
        }
    });

    server.on('error', (err) => console.error('[api] server error:', err));
    server.listen(port, () => console.log(`[api] internal API listening on :${port}`));
    return server;
}





