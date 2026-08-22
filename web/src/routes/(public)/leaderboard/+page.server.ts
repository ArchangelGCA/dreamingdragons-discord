import type { PageServerLoad } from './$types';
import { loadPublicLeaderboard } from '$lib/server/public';

const PER_PAGE = 25;

export const load: PageServerLoad = async ({ parent, url }) => {
	const { pub } = await parent();
	if (!pub.guild) return { board: null };
	const page = Math.max(1, Math.floor(Number(url.searchParams.get('page') || 1)) || 1);
	const board = await loadPublicLeaderboard(pub.guild.id, page, PER_PAGE);
	return { board };
};
