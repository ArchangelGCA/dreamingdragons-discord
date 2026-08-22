import type { PageServerLoad } from './$types';
import type { UserLevel } from '$lib/types';
import { resolveMembers, type MemberDTO } from '$lib/server/bot';

export const load: PageServerLoad = async ({ locals, parent }) => {
	const { guild } = await parent();
	const gid = guild?.currentGuildId ?? null;
	const pb = locals.pb;

	const countOf = async (col: string, filter?: string): Promise<number> => {
		try {
			return (await pb.collection(col).getList(1, 1, filter ? { filter } : {})).totalItems;
		} catch {
			return 0;
		}
	};

	const gf = gid ? pb.filter('guild_id = {:g}', { g: gid }) : undefined;

	try {
		const [reactionRoles, levelRewards, userLevels] = await Promise.all([
			countOf('reaction_roles', gf),
			countOf('level_rewards', gf),
			countOf('user_levels', gf)
		]);

		let topUsers: UserLevel[] = [];
		try {
			topUsers = (
				await pb
					.collection('user_levels')
					.getList<UserLevel>(1, 5, { sort: '-xp', ...(gf ? { filter: gf } : {}) })
			).items;
		} catch {
			topUsers = [];
		}

		let members: Record<string, MemberDTO> = {};
		if (gid && guild?.botOnline && topUsers.length > 0) {
			members = await resolveMembers(gid, topUsers.map((u) => u.user_id));
		}

		return {
			gid,
			counts: { reactionRoles, levelRewards, userLevels },
			topUsers,
			members,
			ok: true
		};
	} catch {
		return {
			gid,
			counts: { reactionRoles: 0, levelRewards: 0, userLevels: 0 },
			topUsers: [] as UserLevel[],
			members: {} as Record<string, MemberDTO>,
			ok: false
		};
	}
};
