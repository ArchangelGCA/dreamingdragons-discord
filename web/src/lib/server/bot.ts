/**
 * Server-only client for the bot's internal HTTP API (api/server.js).
 *
 * The dashboard uses this to resolve Discord names and to trigger Discord-affecting
 * actions. It is imported only from server code (`+page.server.ts`, actions, hooks)
 * — never shipped to the browser — because it holds INTERNAL_API_SECRET.
 *
 * Every call returns a BotResult and NEVER throws, so pages can degrade gracefully
 * to raw IDs + a banner when the bot is offline or unconfigured.
 */
import { env } from '$env/dynamic/private';

const BASE = (env.BOT_API_URL || 'http://bot:8787').replace(/\/+$/, '');
const SECRET = env.INTERNAL_API_SECRET || '';
const TIMEOUT_MS = 5000;

export type BotResult<T> =
	| { ok: true; data: T }
	| { ok: false; error: string; status?: number };

export interface GuildDTO {
	id: string;
	name: string;
	icon: string | null;
	memberCount: number;
	canManageRoles?: boolean;
}
export interface RoleDTO {
	id: string;
	name: string;
	color: string | null;
	position: number;
	managed: boolean;
	assignable: boolean;
}
export interface ChannelDTO {
	id: string;
	name: string;
	type: number;
	position: number;
}
export interface MemberDTO {
	id: string;
	username: string;
	displayName: string;
	avatar: string;
	bot: boolean;
	left?: boolean;
}
export interface RecoveryChange {
	userId: string;
	name: string | null;
	recordId: string | null;
	action: 'create' | 'update';
	fromXp: number;
	fromLevel: number;
	toXp: number;
	toLevel: number;
}
export interface RecoveryResult {
	dryRun: boolean;
	changes: RecoveryChange[];
	skipped: number;
	updated: number;
	errors: number;
}

// APPEND-CORE

/** Whether the bridge is configured at all (secret present). */
export const botConfigured = (): boolean => SECRET.length > 0;

async function botFetch<T>(path: string, init?: RequestInit): Promise<BotResult<T>> {
	if (!SECRET) {
		return { ok: false, error: 'Bot bridge is not configured (INTERNAL_API_SECRET missing).' };
	}
	try {
		const res = await fetch(`${BASE}${path}`, {
			...init,
			headers: {
				authorization: `Bearer ${SECRET}`,
				'content-type': 'application/json',
				...(init?.headers ?? {})
			},
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		const text = await res.text();
		const body = text ? JSON.parse(text) : {};
		if (!res.ok) {
			return { ok: false, error: body?.error || `Bot API error (${res.status}).`, status: res.status };
		}
		return { ok: true, data: body as T };
	} catch {
		return { ok: false, error: 'Bot is unreachable. Start the bot to manage Discord data.' };
	}
}

// ── Reads ──────────────────────────────────────────────────────────────────

export async function getGuilds(): Promise<BotResult<GuildDTO[]>> {
	const r = await botFetch<{ guilds: GuildDTO[] }>('/guilds');
	return r.ok ? { ok: true, data: r.data.guilds } : r;
}

export async function getGuild(guildId: string): Promise<BotResult<GuildDTO>> {
	return botFetch<GuildDTO>(`/guilds/${guildId}`);
}

export async function getRoles(guildId: string): Promise<BotResult<RoleDTO[]>> {
	const r = await botFetch<{ roles: RoleDTO[] }>(`/guilds/${guildId}/roles`);
	return r.ok ? { ok: true, data: r.data.roles } : r;
}

export async function getChannels(guildId: string): Promise<BotResult<ChannelDTO[]>> {
	const r = await botFetch<{ channels: ChannelDTO[] }>(`/guilds/${guildId}/channels`);
	return r.ok ? { ok: true, data: r.data.channels } : r;
}

export async function resolveMembers(
	guildId: string,
	ids: string[]
): Promise<Record<string, MemberDTO>> {
	if (ids.length === 0) return {};
	const r = await botFetch<{ members: Record<string, MemberDTO> }>(
		`/guilds/${guildId}/members/resolve`,
		{ method: 'POST', body: JSON.stringify({ ids }) }
	);
	return r.ok ? r.data.members : {};
}

export async function searchMembers(
	guildId: string,
	q: string,
	limit = 10
): Promise<BotResult<MemberDTO[]>> {
	const r = await botFetch<{ members: MemberDTO[] }>(
		`/guilds/${guildId}/members/search?q=${encodeURIComponent(q)}&limit=${limit}`
	);
	return r.ok ? { ok: true, data: r.data.members } : r;
}

// APPEND-ACTIONS

// ── Leveling actions ────────────────────────────────────────────────────────

export interface LevelSettingsInput {
	notification_channel_id: string;
	xp_per_message: number;
	xp_cooldown: number;
	enabled: boolean;
}

export function saveLevelSettings(guildId: string, data: LevelSettingsInput) {
	return botFetch<{ ok: true }>(`/guilds/${guildId}/leveling/settings`, {
		method: 'PUT',
		body: JSON.stringify(data)
	});
}

export function recoverXp(guildId: string, dryRun: boolean) {
	return botFetch<RecoveryResult>(`/guilds/${guildId}/leveling/recover?dryRun=${dryRun ? 1 : 0}`, {
		method: 'POST'
	});
}

export function syncRoles(guildId: string) {
	return botFetch<{ total: number; success: number; failed: number }>(
		`/guilds/${guildId}/leveling/sync`,
		{ method: 'POST' }
	);
}

export function setUserXp(guildId: string, userId: string, xp: number) {
	return botFetch<{ userId: string; xp: number; level: number }>(
		`/guilds/${guildId}/leveling/users/set-xp`,
		{ method: 'POST', body: JSON.stringify({ userId, xp }) }
	);
}

export function setUserLevel(guildId: string, userId: string, level: number) {
	return botFetch<{ userId: string; xp: number; level: number }>(
		`/guilds/${guildId}/leveling/users/set-level`,
		{ method: 'POST', body: JSON.stringify({ userId, level }) }
	);
}

export function resetUser(guildId: string, userId: string) {
	return botFetch<{ deleted: boolean }>(`/guilds/${guildId}/leveling/users/${userId}`, {
		method: 'DELETE'
	});
}

// ── Reaction-role actions ───────────────────────────────────────────────────

export interface ReactionEntryInput {
	roleId: string;
	mode?: 'button' | 'reaction';
	emoji?: string;
	label?: string;
	style?: string;
}
export interface CreateMessageInput {
	channelId: string;
	embed: { title?: string; description: string; color?: string };
	entries: ReactionEntryInput[];
}

export function createReactionMessage(guildId: string, payload: CreateMessageInput) {
	return botFetch<{ messageId: string; channelId: string; count: number }>(
		`/guilds/${guildId}/reaction-roles/messages`,
		{ method: 'POST', body: JSON.stringify(payload) }
	);
}

export function updateReactionEmbed(
	guildId: string,
	messageId: string,
	embed: { title?: string; description?: string; color?: string }
) {
	return botFetch<{ messageId: string }>(
		`/guilds/${guildId}/reaction-roles/messages/${messageId}`,
		{ method: 'PATCH', body: JSON.stringify({ embed }) }
	);
}

export function addReactionEntry(guildId: string, messageId: string, entry: ReactionEntryInput) {
	return botFetch<{ messageId: string; roleId: string }>(
		`/guilds/${guildId}/reaction-roles/messages/${messageId}/entries`,
		{ method: 'POST', body: JSON.stringify(entry) }
	);
}

export function editReactionEntry(
	guildId: string,
	recordId: string,
	patch: { roleId?: string; emoji?: string; label?: string; style?: string }
) {
	return botFetch<{ recordId: string }>(`/guilds/${guildId}/reaction-roles/entries/${recordId}`, {
		method: 'PATCH',
		body: JSON.stringify(patch)
	});
}

export function removeReactionEntry(guildId: string, recordId: string) {
	return botFetch<{ recordId: string }>(`/guilds/${guildId}/reaction-roles/entries/${recordId}`, {
		method: 'DELETE'
	});
}

export function deleteReactionMessage(guildId: string, messageId: string, deleteMessage: boolean) {
	return botFetch<{ messageId: string; removed: number }>(
		`/guilds/${guildId}/reaction-roles/messages/${messageId}?deleteMessage=${deleteMessage ? 1 : 0}`,
		{ method: 'DELETE' }
	);
}

// ── Reaction-role: reuse & resend ────────────────────────────────────────────

export interface BotMessageDTO {
	id: string;
	preview: string;
	hasEmbed: boolean;
	hasComponents: boolean;
	reactionCount: number;
	createdTimestamp: number;
	managed: boolean;
}

/** List bot-authored messages in a channel that can be adopted as reaction roles. */
export async function getBotMessages(
	guildId: string,
	channelId: string,
	limit = 50
): Promise<BotResult<BotMessageDTO[]>> {
	const r = await botFetch<{ messages: BotMessageDTO[] }>(
		`/guilds/${guildId}/reaction-roles/bot-messages?channelId=${encodeURIComponent(channelId)}&limit=${limit}`
	);
	return r.ok ? { ok: true, data: r.data.messages } : r;
}

export interface AdoptMessageInput {
	channelId: string;
	messageId: string;
	mode: 'button' | 'reaction';
	entries: ReactionEntryInput[];
}

/** Reuse an existing bot message as a reaction-role message (no new post). */
export function adoptReactionMessage(guildId: string, payload: AdoptMessageInput) {
	return botFetch<{ messageId: string; channelId: string; count: number }>(
		`/guilds/${guildId}/reaction-roles/messages/adopt`,
		{ method: 'POST', body: JSON.stringify(payload) }
	);
}

/** Re-post a reaction-role message that was deleted on Discord. */
export function resendReactionMessage(
	guildId: string,
	messageId: string,
	payload: { channelId?: string; embed?: { title?: string; description?: string; color?: string } }
) {
	return botFetch<{ messageId: string; oldMessageId: string; channelId: string; count: number }>(
		`/guilds/${guildId}/reaction-roles/messages/${messageId}/resend`,
		{ method: 'POST', body: JSON.stringify(payload) }
	);
}

/** Check which stored reaction-role messages still exist on Discord (and their current embed content). */
export interface MessageStatus {
	exists: boolean;
	title?: string;
	description?: string;
	color?: string;
}
export async function getMessagesStatus(
	guildId: string,
	messageIds: string[]
): Promise<Record<string, MessageStatus>> {
	if (messageIds.length === 0) return {};
	const r = await botFetch<{ statuses: Record<string, MessageStatus> }>(
		`/guilds/${guildId}/reaction-roles/status`,
		{ method: 'POST', body: JSON.stringify({ messageIds }) }
	);
	return r.ok ? r.data.statuses : {};
}


