import type { PageServerLoad } from './$types';
import type { UserLevel } from '$lib/types';

export const load: PageServerLoad = async ({ locals }) => {
	const pb = locals.pb;

	const countOf = async (col: string): Promise<number> => {
		try {
			return (await pb.collection(col).getList(1, 1)).totalItems;
		} catch {
			return 0;
		}
	};

	try {
		const [reactionRoles, levelSettings, levelRewards, userLevels] = await Promise.all([
			countOf('reaction_roles'),
			countOf('level_settings'),
			countOf('level_rewards'),
			countOf('user_levels')
		]);

		let topUsers: UserLevel[] = [];
		try {
			topUsers = (await pb.collection('user_levels').getList<UserLevel>(1, 5, { sort: '-xp' })).items;
		} catch {
			topUsers = [];
		}

		return {
			counts: { reactionRoles, levelSettings, levelRewards, userLevels },
			topUsers,
			ok: true
		};
	} catch {
		return {
			counts: { reactionRoles: 0, levelSettings: 0, levelRewards: 0, userLevels: 0 },
			topUsers: [] as UserLevel[],
			ok: false
		};
	}
};
