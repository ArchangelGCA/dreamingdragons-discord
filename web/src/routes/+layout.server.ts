import type { LayoutServerLoad } from './$types';
import { loadGuildContext } from '$lib/server/guild';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	if (!locals.admin) {
		return { admin: null, guild: null };
	}
	const guild = await loadGuildContext(cookies);
	return { admin: locals.admin, guild };
};
