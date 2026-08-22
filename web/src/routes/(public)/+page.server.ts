import type { PageServerLoad } from './$types';
import { loadPublicHome } from '$lib/server/public';

export const load: PageServerLoad = async ({ parent }) => {
	const { pub } = await parent();
	if (!pub.guild) return { home: null };
	const home = await loadPublicHome(pub.guild.id);
	return { home };
};
