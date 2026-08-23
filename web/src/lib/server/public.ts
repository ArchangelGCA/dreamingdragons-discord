/**
 * Data layer for the PUBLIC pages (no login required).
 *
 * PocketBase collections have no public API rules, so public reads go through a
 * dedicated superuser client that never touches the request cookie (visitors
 * stay cookie-less). Everything returned by these functions is a deliberately
 * MINIMAL DTO — the features only need level/XP/rank and (when the bot is
 * reachable to resolve them) the member's Discord display name and avatar, both
 * of which are already visible to anyone in the server. The PocketBase record
 * id, timestamps and any other columns never leave the server, except on the
 * personal page (/u/<id>) where "last activity" is shown — it's the visitor's
 * own data (GDPR transparency, Art. 15).
 */
import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import { calculateLevelFromXp } from '$lib/leveling';
import { resolveEquipped, type PublicCosmetics } from '$lib/cosmetics';
import { getGuilds, resolveMembers, type GuildDTO } from './bot';

const PB_URL = env.POCKETBASE_URL || 'http://127.0.0.1:8090';
const EMAIL = env.POCKETBASE_ADMIN_EMAIL || '';
const PASSWORD = env.POCKETBASE_ADMIN_PASSWORD || '';

// ── Internal superuser client (per-process singleton, lazily authenticated) ──

let cached: PocketBase | null = null;
let cachedAuthAt = 0;
const REAUTH_AFTER_MS = 30 * 60 * 1000;

async function publicPb(): Promise<PocketBase | null> {
	if (!EMAIL || !PASSWORD) return null;
	if (cached && cached.authStore.isValid && Date.now() - cachedAuthAt < REAUTH_AFTER_MS) {
		return cached;
	}
	const pb = new PocketBase(PB_URL);
	pb.autoCancellation(false);
	try {
		await pb.collection('_superusers').authWithPassword(EMAIL, PASSWORD, {
			cache: 'no-store'
		});
	} catch {
		return null; // DB unreachable or creds missing — public pages degrade gracefully
	}
	cached = pb;
	cachedAuthAt = Date.now();
	return pb;
}

// ── Types exposed to public pages ───────────────────────────────────────────

export interface PublicGuild {
	id: string;
	name: string | null;
	icon: string | null;
	memberCount: number | null;
}

export interface PublicEntry {
	userId: string;
	rank: number;
	level: number;
	xp: number;
	/** Discord display name/avatar when the bot bridge can resolve them. */
	name: string | null;
	avatar: string | null;
}

export interface GuildStats {
	leveledMembers: number;
	rewardRoles: number;
	levelingEnabled: boolean;
}

// ── Guild resolution (short-lived cache keeps the bot-bridge cost near zero) ─

let guildsCache: { at: number; value: { guilds: PublicGuild[]; botOnline: boolean } } | null = null;
const GUILDS_TTL_MS = 30_000;

/**
 * Public guilds = guilds where leveling is configured (level_settings rows),
 * enriched with names/icons from the bot when it's online.
 */
export async function publicGuilds(): Promise<{ guilds: PublicGuild[]; botOnline: boolean }> {
	if (guildsCache && Date.now() - guildsCache.at < GUILDS_TTL_MS) return guildsCache.value;

	const pb = await publicPb();
	if (!pb) return { guilds: [], botOnline: false };

	let settings: { guild_id: string }[] = [];
	try {
		settings = await pb.collection('level_settings').getFullList({ fields: 'guild_id' });
	} catch {
		return { guilds: [], botOnline: false };
	}

	const botRes = await getGuilds();
	const byId = new Map<string, GuildDTO>((botRes.ok ? botRes.data : []).map((g) => [g.id, g]));

	const guilds: PublicGuild[] = settings.map((s) => {
		const g = byId.get(s.guild_id);
		return {
			id: s.guild_id,
			name: g?.name ?? null,
			icon: g?.icon ?? null,
			memberCount: g?.memberCount ?? null
		};
	});

	const value = { guilds, botOnline: botRes.ok };
	guildsCache = { at: Date.now(), value };
	return value;
}

/** Pick the guild to show: explicit ?g= choice if valid, else the first one. */
export async function pickGuild(
	urlGuild: string | null
): Promise<{ guild: PublicGuild | null; guilds: PublicGuild[]; botOnline: boolean }> {
	const { guilds, botOnline } = await publicGuilds();
	if (guilds.length === 0) return { guild: null, guilds, botOnline };
	const found = urlGuild ? guilds.find((g) => g.id === urlGuild) : undefined;
	return { guild: found ?? guilds[0], guilds, botOnline };
}

// ── Leveling reads ──────────────────────────────────────────────────────────

/** Is leveling publicly visible right now? (Admins pausing it hides the board.) */
async function levelingEnabled(pb: PocketBase, guildId: string): Promise<boolean> {
	const res = await pb
		.collection('level_settings')
		.getList(1, 1, { filter: pb.filter('guild_id = {:g}', { g: guildId }), fields: 'enabled' });
	return res.totalItems > 0 && res.items[0].enabled === true;
}

async function guildStats(pb: PocketBase, guildId: string): Promise<GuildStats> {
	const gf = pb.filter('guild_id = {:g}', { g: guildId });
	const [users, rewards, settings] = await Promise.all([
		pb.collection('user_levels').getList(1, 1, { filter: gf, fields: 'id' }).catch(() => null),
		pb.collection('level_rewards').getList(1, 1, { filter: gf, fields: 'id' }).catch(() => null),
		pb.collection('level_settings').getList(1, 1, { filter: gf, fields: 'enabled' }).catch(() => null)
	]);
	return {
		leveledMembers: users?.totalItems ?? 0,
		rewardRoles: rewards?.totalItems ?? 0,
		levelingEnabled: (settings?.items?.[0]?.enabled ?? false) === true
	};
}

const PUBLIC_USER_FIELDS = 'user_id,xp,level';

/** A leaderboard page with resolved identities where possible. */
async function leaderboardPage(
	pb: PocketBase,
	guildId: string,
	page: number,
	perPage: number
): Promise<{ entries: PublicEntry[]; total: number; totalPages: number; page: number }> {
	const list = await pb.collection('user_levels').getList(page, perPage, {
		filter: pb.filter('guild_id = {:g}', { g: guildId }),
		sort: '-xp',
		fields: PUBLIC_USER_FIELDS
	});

	const members = await resolveMembers(guildId, list.items.map((u) => u.user_id));

	const entries: PublicEntry[] = list.items.map((u, i) => {
		const m = members[u.user_id];
		return {
			userId: u.user_id,
			rank: (list.page - 1) * list.perPage + i + 1,
			level: calculateLevelFromXp(u.xp),
			xp: u.xp,
			name: m?.displayName ?? null,
			avatar: m?.avatar ?? null
		};
	});

	return {
		entries,
		total: list.totalItems,
		totalPages: Math.max(1, Math.ceil(list.totalItems / perPage)),
		page: list.page
	};
}

/** The public profile of one member — includes their own "last active" date. */
async function publicProfile(
	pb: PocketBase,
	guildId: string,
	userId: string
): Promise<{
	entry: PublicEntry;
	lastActiveDay: string | null; // YYYY-MM-DD, day precision on purpose
	cosmetics: PublicCosmetics;
} | null> {
	const res = await pb.collection('user_levels').getList(1, 1, {
		filter: pb.filter('guild_id = {:g} && user_id = {:u}', { g: guildId, u: userId }),
		fields: `${PUBLIC_USER_FIELDS},last_message_time`
	});
	if (res.totalItems === 0) return null;
	const rec = res.items[0];

	const ahead = await pb
		.collection('user_levels')
		.getList(1, 1, { filter: pb.filter('guild_id = {:g} && xp > {:xp}', { g: guildId, xp: rec.xp }) })
		.catch(() => null);

	const members = await resolveMembers(guildId, [userId]);
	const m = members[userId];

	let lastActiveDay: string | null = null;
	if (rec.last_message_time) {
		const d = new Date(rec.last_message_time);
		if (!Number.isNaN(d.getTime())) lastActiveDay = d.toISOString().slice(0, 10);
	}

	// Equipped cosmetics — the user_economy collection may not exist yet on old
	// deployments, so degrade gracefully to no cosmetics.
	let cosmetics: PublicCosmetics;
	try {
		const economy = await pb.collection('user_economy').getList(1, 1, {
			filter: pb.filter('guild_id = {:g} && user_id = {:u}', { g: guildId, u: userId }),
			fields: 'equipped'
		});
		cosmetics = resolveEquipped(
			economy.totalItems > 0 ? (economy.items[0].equipped as Record<string, string> | null) : null
		);
	} catch {
		cosmetics = resolveEquipped(null);
	}

	return {
		entry: {
			userId,
			rank: (ahead?.totalItems ?? 0) + 1,
			level: calculateLevelFromXp(rec.xp),
			xp: rec.xp,
			name: m?.displayName ?? null,
			avatar: m?.avatar ?? null
		},
		lastActiveDay,
		cosmetics
	};
}

// ── Page-level loaders (used by the (public) routes) ────────────────────────

export interface PublicHome {
	stats: GuildStats;
	top: PublicEntry[];
}

/** Home page: stats + top 3. Returns null when the DB is unreachable. */
export async function loadPublicHome(guildId: string): Promise<PublicHome | null> {
	const pb = await publicPb();
	if (!pb) return null;
	try {
		const stats = await guildStats(pb, guildId);
		const top = stats.levelingEnabled
			? (await leaderboardPage(pb, guildId, 1, 3)).entries
			: [];
		return { stats, top };
	} catch {
		return null;
	}
}

/**
 * Leaderboard page. `disabled` means an admin paused leveling — the board is
 * hidden then, on purpose. `null` = DB unreachable.
 */
export async function loadPublicLeaderboard(
	guildId: string,
	page: number,
	perPage = 25
): Promise<{
	entries: PublicEntry[];
	total: number;
	totalPages: number;
	page: number;
	disabled: boolean;
} | null> {
	const pb = await publicPb();
	if (!pb) return null;
	try {
		if (!(await levelingEnabled(pb, guildId))) {
			return { entries: [], total: 0, totalPages: 1, page: 1, disabled: true };
		}
		const data = await leaderboardPage(pb, guildId, page, perPage);
		return { ...data, disabled: false };
	} catch {
		return null;
	}
}

/** Personal page. `null` = unknown user or DB unreachable (both render 404/notice). */
export async function loadPublicProfile(
	guildId: string,
	userId: string
): Promise<(Awaited<ReturnType<typeof publicProfile>> & { levelingEnabled: boolean }) | null> {
	if (!/^\d{5,25}$/.test(userId)) return null;
	const pb = await publicPb();
	if (!pb) return null;
	try {
		const profile = await publicProfile(pb, guildId, userId);
		if (!profile) return null;
		return { ...profile, levelingEnabled: await levelingEnabled(pb, guildId) };
	} catch {
		return null;
	}
}
