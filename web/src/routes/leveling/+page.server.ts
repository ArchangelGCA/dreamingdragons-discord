import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { LevelSettings, LevelReward } from '$lib/types';
import {
	getRoles,
	getChannels,
	saveLevelSettings,
	syncRoles,
	recoverXp,
	type RoleDTO,
	type ChannelDTO
} from '$lib/server/bot';

const SNOWFLAKE = /^\d{5,25}$/;

export const load: PageServerLoad = async ({ locals, parent }) => {
	const { guild } = await parent();
	const gid = guild?.currentGuildId ?? null;
	const pb = locals.pb;

	let settings: LevelSettings | null = null;
	let rewards: LevelReward[] = [];
	if (gid) {
		const s = await pb
			.collection('level_settings')
			.getList<LevelSettings>(1, 1, { filter: pb.filter('guild_id = {:g}', { g: gid }) });
		settings = s.items[0] ?? null;
		rewards = await pb
			.collection('level_rewards')
			.getFullList<LevelReward>({ filter: pb.filter('guild_id = {:g}', { g: gid }), sort: 'level' });
	}

	let roles: RoleDTO[] = [];
	let channels: ChannelDTO[] = [];
	if (gid && guild?.botOnline) {
		const [r, c] = await Promise.all([getRoles(gid), getChannels(gid)]);
		if (r.ok) roles = r.data;
		if (c.ok) channels = c.data;
	}

	return { gid, settings, rewards, roles, channels };
};

// APPEND-ACTIONS

export const actions: Actions = {
	saveSettings: async ({ request, locals }) => {
		const f = await request.formData();
		const guild_id = String(f.get('guild_id') || '').trim();
		if (!SNOWFLAKE.test(guild_id)) return fail(400, { error: 'Invalid guild.' });

		const data = {
			notification_channel_id: String(f.get('notification_channel_id') || '').trim(),
			xp_per_message: Math.min(1000, Math.max(1, Number(f.get('xp_per_message') || 20))),
			xp_cooldown: Math.min(86400, Math.max(1, Number(f.get('xp_cooldown') || 60))),
			enabled: f.get('enabled') === 'on'
		};

		// Prefer the bot (writes + invalidates its live cache); fall back to direct PB.
		const viaBot = await saveLevelSettings(guild_id, data);
		if (viaBot.ok) return { success: 'Leveling settings saved.' };

		try {
			const existing = await locals.pb
				.collection('level_settings')
				.getList(1, 1, { filter: locals.pb.filter('guild_id = {:g}', { g: guild_id }) });
			if (existing.totalItems > 0) await locals.pb.collection('level_settings').update(existing.items[0].id, data);
			else await locals.pb.collection('level_settings').create({ guild_id, ...data });
			return { success: 'Settings saved directly (bot offline — changes apply within 15 min or on restart).' };
		} catch {
			return fail(400, { error: 'Failed to save settings.' });
		}
	},

	addReward: async ({ request, locals }) => {
		const f = await request.formData();
		const guild_id = String(f.get('guild_id') || '').trim();
		const role_id = String(f.get('role_id') || '').trim();
		const level = Number(f.get('level') || 0);
		if (!SNOWFLAKE.test(guild_id) || !SNOWFLAKE.test(role_id) || level < 1) {
			return fail(400, { error: 'A valid role and a level ≥ 1 are required.' });
		}
		try {
			// Upsert by (guild, level): one reward role per level.
			const existing = await locals.pb.collection('level_rewards').getList(1, 1, {
				filter: locals.pb.filter('guild_id = {:g} && level = {:l}', { g: guild_id, l: level })
			});
			if (existing.totalItems > 0) {
				await locals.pb.collection('level_rewards').update(existing.items[0].id, { role_id });
				return { success: `Reward for level ${level} updated.` };
			}
			await locals.pb.collection('level_rewards').create({ guild_id, level, role_id });
			return { success: `Reward added for level ${level}.` };
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
	},

	syncRoles: async ({ request }) => {
		const f = await request.formData();
		const guild_id = String(f.get('guild_id') || '').trim();
		if (!SNOWFLAKE.test(guild_id)) return fail(400, { error: 'Invalid guild.' });
		const res = await syncRoles(guild_id);
		if (!res.ok) return fail(502, { error: res.error });
		return { success: `Synced roles: ${res.data.success} ok, ${res.data.failed} failed (of ${res.data.total}).` };
	},

	previewRecover: async ({ request }) => {
		const f = await request.formData();
		const guild_id = String(f.get('guild_id') || '').trim();
		if (!SNOWFLAKE.test(guild_id)) return fail(400, { error: 'Invalid guild.' });
		const res = await recoverXp(guild_id, true);
		if (!res.ok) return fail(502, { error: res.error });
		return { recover: { ...res.data, applied: false } };
	},

	applyRecover: async ({ request }) => {
		const f = await request.formData();
		const guild_id = String(f.get('guild_id') || '').trim();
		if (!SNOWFLAKE.test(guild_id)) return fail(400, { error: 'Invalid guild.' });
		const res = await recoverXp(guild_id, false);
		if (!res.ok) return fail(502, { error: res.error });
		return {
			recover: { ...res.data, applied: true },
			success: `Recovery applied: ${res.data.updated} updated, ${res.data.skipped} skipped, ${res.data.errors} errors.`
		};
	}
};

