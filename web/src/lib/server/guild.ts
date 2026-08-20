/**
 * Guild selection context for the dashboard.
 *
 * The bot can be in several guilds; the dashboard scopes everything to one
 * selected guild, remembered in the `dd_guild` cookie. When the bot bridge is
 * online we validate the selection against the real guild list; when it's
 * offline we still honour the cookie so PocketBase-only pages keep working.
 */
import type { Cookies } from '@sveltejs/kit';
import { getGuilds, botConfigured, type GuildDTO } from './bot';

export const GUILD_COOKIE = 'dd_guild';

export interface GuildContext {
	guilds: GuildDTO[];
	currentGuildId: string | null;
	currentGuild: GuildDTO | null;
	botOnline: boolean;
	botConfigured: boolean;
	error?: string;
}

export async function loadGuildContext(cookies: Cookies): Promise<GuildContext> {
	const cookieGuild = cookies.get(GUILD_COOKIE) ?? null;
	const res = await getGuilds();

	if (!res.ok) {
		return {
			guilds: [],
			currentGuildId: cookieGuild,
			currentGuild: null,
			botOnline: false,
			botConfigured: botConfigured(),
			error: res.error
		};
	}

	const guilds = res.data;
	let currentGuildId = cookieGuild;
	if (!currentGuildId || !guilds.some((g) => g.id === currentGuildId)) {
		currentGuildId = guilds[0]?.id ?? null;
	}
	const currentGuild = guilds.find((g) => g.id === currentGuildId) ?? null;

	return { guilds, currentGuildId, currentGuild, botOnline: true, botConfigured: true };
}

export function setGuildCookie(cookies: Cookies, guildId: string): void {
	cookies.set(GUILD_COOKIE, guildId, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 365
	});
}

/** Read just the selected guild id (used by page loads that scope PB queries). */
export function currentGuildId(cookies: Cookies): string | null {
	return cookies.get(GUILD_COOKIE) ?? null;
}
