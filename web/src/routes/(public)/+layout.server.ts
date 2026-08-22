import type { LayoutServerLoad } from './$types';
import { pickGuild } from '$lib/server/public';

/**
 * Shared context for the public pages: which guild to show, all public guilds
 * and whether the bot bridge (names/avatars) is online. Lives in the group
 * layout so every public page shares one resolution (cached ~30s server-side).
 */
export const load: LayoutServerLoad = async ({ url }) => {
	const { guild, guilds, botOnline } = await pickGuild(url.searchParams.get('g'));
	return { pub: { guild, guilds, botOnline, g: url.searchParams.get('g') ?? null } };
};
