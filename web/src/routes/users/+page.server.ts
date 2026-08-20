import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { UserLevel } from '$lib/types';
import { calculateLevelFromXp } from '$lib/leveling';
import {
	resolveMembers,
	searchMembers,
	setUserXp,
	setUserLevel,
	resetUser,
	type MemberDTO
} from '$lib/server/bot';

const SNOWFLAKE = /^\d{5,25}$/;
const PER_PAGE = 25;

export const load: PageServerLoad = async ({ locals, parent, url }) => {
	const { guild } = await parent();
	const gid = guild?.currentGuildId ?? null;
	const pageNum = Math.max(1, Number(url.searchParams.get('page') || 1));
	const q = (url.searchParams.get('q') || '').trim();

	if (!gid) {
		return {
			gid,
			users: [] as UserLevel[],
			page: 1,
			totalPages: 0,
			totalItems: 0,
			members: {} as Record<string, MemberDTO>,
			search: [] as MemberDTO[],
			q
		};
	}

	const result = await locals.pb
		.collection('user_levels')
		.getList<UserLevel>(pageNum, PER_PAGE, {
			filter: locals.pb.filter('guild_id = {:g}', { g: gid }),
			sort: '-xp'
		});

	let members: Record<string, MemberDTO> = {};
	let search: MemberDTO[] = [];
	if (guild?.botOnline) {
		members = await resolveMembers(gid, result.items.map((u) => u.user_id));
		if (q) {
			const r = await searchMembers(gid, q, 15);
			if (r.ok) search = r.data;
		}
	}

	return {
		gid,
		users: result.items,
		page: result.page,
		totalPages: result.totalPages,
		totalItems: result.totalItems,
		members,
		search,
		q
	};
};

// APPEND-ACTIONS

export const actions: Actions = {
	setXp: async ({ request, locals }) => {
		const f = await request.formData();
		const guild_id = String(f.get('guild_id') || '').trim();
		const user_id = String(f.get('user_id') || '').trim();
		const xp = Math.max(0, Number(f.get('xp') || 0));
		if (!SNOWFLAKE.test(guild_id) || !SNOWFLAKE.test(user_id)) return fail(400, { error: 'Invalid guild/user.' });

		// Prefer the bot so reward roles re-sync; fall back to a plain DB write.
		const viaBot = await setUserXp(guild_id, user_id, xp);
		if (viaBot.ok) return { success: `Set XP to ${xp} (level ${viaBot.data.level}); roles re-synced.` };

		try {
			const existing = await locals.pb.collection('user_levels').getList(1, 1, {
				filter: locals.pb.filter('guild_id = {:g} && user_id = {:u}', { g: guild_id, u: user_id })
			});
			const patch = { xp, level: calculateLevelFromXp(xp), last_message_time: new Date().toISOString() };
			if (existing.totalItems > 0) await locals.pb.collection('user_levels').update(existing.items[0].id, patch);
			else await locals.pb.collection('user_levels').create({ guild_id, user_id, ...patch });
			return { success: `Set XP to ${xp} (bot offline — roles not re-synced).` };
		} catch {
			return fail(400, { error: 'Failed to update user.' });
		}
	},

	setLevel: async ({ request }) => {
		const f = await request.formData();
		const guild_id = String(f.get('guild_id') || '').trim();
		const user_id = String(f.get('user_id') || '').trim();
		const level = Math.max(0, Number(f.get('level') || 0));
		if (!SNOWFLAKE.test(guild_id) || !SNOWFLAKE.test(user_id)) return fail(400, { error: 'Invalid guild/user.' });
		const res = await setUserLevel(guild_id, user_id, level);
		if (!res.ok) return fail(502, { error: res.error });
		return { success: `Set to level ${res.data.level} (${res.data.xp} XP); roles re-synced.` };
	},

	resetUser: async ({ request, locals }) => {
		const f = await request.formData();
		const guild_id = String(f.get('guild_id') || '').trim();
		const user_id = String(f.get('user_id') || '').trim();
		if (!SNOWFLAKE.test(guild_id) || !SNOWFLAKE.test(user_id)) return fail(400, { error: 'Invalid guild/user.' });

		const viaBot = await resetUser(guild_id, user_id);
		if (viaBot.ok) return { success: 'User level data reset.' };

		try {
			const existing = await locals.pb.collection('user_levels').getList(1, 1, {
				filter: locals.pb.filter('guild_id = {:g} && user_id = {:u}', { g: guild_id, u: user_id })
			});
			if (existing.totalItems > 0) await locals.pb.collection('user_levels').delete(existing.items[0].id);
			return { success: 'User level data reset (bot offline).' };
		} catch {
			return fail(400, { error: 'Failed to reset user.' });
		}
	}
};

