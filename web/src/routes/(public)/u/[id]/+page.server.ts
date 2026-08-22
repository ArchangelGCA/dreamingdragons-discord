import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadPublicProfile } from '$lib/server/public';

export const load: PageServerLoad = async ({ params, parent, url }) => {
	const { pub } = await parent();
	const userId = params.id;

	if (!pub.guild) throw error(503, 'Stats are temporarily unavailable.');
	const profile = /^\d{5,25}$/.test(userId)
		? await loadPublicProfile(pub.guild.id, userId)
		: null;

	return {
		profile, // null → friendly "no stats yet" page (not a hard 404)
		userId,
		shareUrl: `${url.origin}/u/${userId}${pub.guilds.length > 1 ? `?g=${pub.guild.id}` : ''}`
	};
};
