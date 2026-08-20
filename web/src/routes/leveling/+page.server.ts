import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { LevelSettings, LevelReward } from '$lib/types';

export const load: PageServerLoad = async ({ locals }) => {
	const pb = locals.pb;
	const [settings, rewards] = await Promise.all([
		pb.collection('level_settings').getFullList<LevelSettings>({ sort: 'guild_id' }),
		pb.collection('level_rewards').getFullList<LevelReward>({ sort: 'level' })
	]);
	return { settings, rewards };
};

export const actions: Actions = {
	updateSettings: async ({ request, locals }) => {
		const f = await request.formData();
		const id = String(f.get('id') || '');
		try {
			await locals.pb.collection('level_settings').update(id, {
				notification_channel_id: String(f.get('notification_channel_id') || ''),
				xp_per_message: Number(f.get('xp_per_message') || 20),
				xp_cooldown: Number(f.get('xp_cooldown') || 60),
				enabled: f.get('enabled') === 'on'
			});
			return { success: 'Settings updated.' };
		} catch {
			return fail(400, { error: 'Failed to update settings.' });
		}
	},

	addReward: async ({ request, locals }) => {
		const f = await request.formData();
		const guild_id = String(f.get('guild_id') || '').trim();
		const role_id = String(f.get('role_id') || '').trim();
		const level = Number(f.get('level') || 0);
		if (!guild_id || !role_id || level < 1) {
			return fail(400, { error: 'Guild ID, role ID and a level ≥ 1 are required.' });
		}
		try {
			await locals.pb.collection('level_rewards').create({ guild_id, level, role_id });
			return { success: 'Reward added.' };
		} catch {
			return fail(400, { error: 'Failed to add reward.' });
		}
	},

	deleteReward: async ({ request, locals }) => {
		const f = await request.formData();
		try {
			await locals.pb.collection('level_rewards').delete(String(f.get('id') || ''));
			return { success: 'Reward removed.' };
		} catch {
			return fail(400, { error: 'Failed to remove reward.' });
		}
	}
};
