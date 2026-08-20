import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { UserLevel } from '$lib/types';
import { calculateLevelFromXp } from '$lib/leveling';

export const load: PageServerLoad = async ({ locals, url }) => {
	const page = Math.max(1, Number(url.searchParams.get('page') || 1));
	const result = await locals.pb
		.collection('user_levels')
		.getList<UserLevel>(page, 25, { sort: '-xp' });

	return {
		users: result.items,
		page: result.page,
		totalPages: result.totalPages,
		totalItems: result.totalItems
	};
};

export const actions: Actions = {
	updateUser: async ({ request, locals }) => {
		const f = await request.formData();
		const id = String(f.get('id') || '');
		const xp = Math.max(0, Number(f.get('xp') || 0));
		try {
			await locals.pb.collection('user_levels').update(id, {
				xp,
				level: calculateLevelFromXp(xp)
			});
			return { success: 'User updated.' };
		} catch {
			return fail(400, { error: 'Failed to update user.' });
		}
	},

	deleteUser: async ({ request, locals }) => {
		const f = await request.formData();
		try {
			await locals.pb.collection('user_levels').delete(String(f.get('id') || ''));
			return { success: 'User level data reset.' };
		} catch {
			return fail(400, { error: 'Failed to reset user.' });
		}
	}
};
