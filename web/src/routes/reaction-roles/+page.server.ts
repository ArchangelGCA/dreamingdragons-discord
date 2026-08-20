import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { ReactionRole } from '$lib/types';
import {
	getRoles,
	getChannels,
	createReactionMessage,
	updateReactionEmbed,
	addReactionEntry,
	editReactionEntry,
	removeReactionEntry,
	deleteReactionMessage,
	type RoleDTO,
	type ChannelDTO,
	type ReactionEntryInput
} from '$lib/server/bot';

const SNOWFLAKE = /^\d{5,25}$/;

interface Group {
	message_id: string;
	guild_id: string;
	channel_id: string;
	type: 'button' | 'reaction';
	entries: ReactionRole[];
}

export const load: PageServerLoad = async ({ locals, parent }) => {
	const { guild } = await parent();
	const gid = guild?.currentGuildId ?? null;

	let groups: Group[] = [];
	let total = 0;
	if (gid) {
		const records = await locals.pb
			.collection('reaction_roles')
			.getFullList<ReactionRole>({ filter: locals.pb.filter('guild_id = {:g}', { g: gid }), sort: 'created' });
		total = records.length;
		const map = new Map<string, Group>();
		for (const r of records) {
			if (!map.has(r.message_id)) {
				map.set(r.message_id, {
					message_id: r.message_id,
					guild_id: r.guild_id,
					channel_id: r.channel_id,
					type: r.component_type === 'button' ? 'button' : 'reaction',
					entries: []
				});
			}
			map.get(r.message_id)!.entries.push(r);
		}
		groups = [...map.values()];
	}

	let roles: RoleDTO[] = [];
	let channels: ChannelDTO[] = [];
	if (gid && guild?.botOnline) {
		const [r, c] = await Promise.all([getRoles(gid), getChannels(gid)]);
		if (r.ok) roles = r.data;
		if (c.ok) channels = c.data;
	}

	return { gid, groups, total, roles, channels };
};

// APPEND-ACTIONS

export const actions: Actions = {
	createMessage: async ({ request }) => {
		const f = await request.formData();
		const guild_id = String(f.get('guild_id') || '').trim();
		const channelId = String(f.get('channel_id') || '').trim();
		const mode = f.get('mode') === 'reaction' ? 'reaction' : 'button';
		if (!SNOWFLAKE.test(guild_id) || !SNOWFLAKE.test(channelId)) {
			return fail(400, { error: 'A valid channel is required.' });
		}

		const roleIds = f.getAll('role_id').map(String);
		const emojis = f.getAll('emoji').map(String);
		const labels = f.getAll('label').map(String);
		const styles = f.getAll('style').map(String);
		const entries: ReactionEntryInput[] = [];
		for (let i = 0; i < roleIds.length; i++) {
			if (!SNOWFLAKE.test(roleIds[i])) continue;
			entries.push({
				roleId: roleIds[i],
				mode,
				emoji: emojis[i]?.trim() || undefined,
				label: labels[i]?.trim() || undefined,
				style: styles[i] || 'secondary'
			});
		}
		if (entries.length === 0) return fail(400, { error: 'Add at least one valid role entry.' });

		const res = await createReactionMessage(guild_id, {
			channelId,
			embed: {
				title: String(f.get('title') || '').trim() || undefined,
				description: String(f.get('description') || ''),
				color: String(f.get('color') || '').trim() || undefined
			},
			entries
		});
		if (!res.ok) return fail(502, { error: res.error });
		return { success: `Created reaction-role message (${res.data.count} role(s)).` };
	},

	updateEmbed: async ({ request }) => {
		const f = await request.formData();
		const guild_id = String(f.get('guild_id') || '').trim();
		const message_id = String(f.get('message_id') || '').trim();
		if (!SNOWFLAKE.test(guild_id) || !SNOWFLAKE.test(message_id)) return fail(400, { error: 'Invalid target.' });
		// Only send non-empty fields — blanks mean "keep the current value".
		const embed: { title?: string; description?: string; color?: string } = {};
		const title = String(f.get('title') || '').trim();
		const description = String(f.get('description') || '').trim();
		const color = String(f.get('color') || '').trim();
		if (title) embed.title = title;
		if (description) embed.description = description;
		if (color) embed.color = color;
		if (Object.keys(embed).length === 0) return fail(400, { error: 'Enter at least one field to change.' });
		const res = await updateReactionEmbed(guild_id, message_id, embed);
		if (!res.ok) return fail(502, { error: res.error });
		return { success: 'Message embed updated.' };
	},

	addEntry: async ({ request }) => {
		const f = await request.formData();
		const guild_id = String(f.get('guild_id') || '').trim();
		const message_id = String(f.get('message_id') || '').trim();
		const roleId = String(f.get('role_id') || '').trim();
		if (!SNOWFLAKE.test(guild_id) || !SNOWFLAKE.test(message_id) || !SNOWFLAKE.test(roleId)) {
			return fail(400, { error: 'A valid role is required.' });
		}
		const res = await addReactionEntry(guild_id, message_id, {
			roleId,
			emoji: String(f.get('emoji') || '').trim() || undefined,
			label: String(f.get('label') || '').trim() || undefined,
			style: String(f.get('style') || 'secondary')
		});
		if (!res.ok) return fail(502, { error: res.error });
		return { success: 'Role added to message.' };
	},

	editEntry: async ({ request }) => {
		const f = await request.formData();
		const guild_id = String(f.get('guild_id') || '').trim();
		const recordId = String(f.get('record_id') || '').trim();
		if (!SNOWFLAKE.test(guild_id) || !recordId) return fail(400, { error: 'Invalid entry.' });
		const patch: { roleId?: string; emoji?: string; label?: string; style?: string } = {};
		const roleId = String(f.get('role_id') || '').trim();
		if (SNOWFLAKE.test(roleId)) patch.roleId = roleId;
		if (f.get('emoji') !== null) patch.emoji = String(f.get('emoji') || '').trim();
		if (f.get('label') !== null) patch.label = String(f.get('label') || '');
		if (f.get('style')) patch.style = String(f.get('style'));
		const res = await editReactionEntry(guild_id, recordId, patch);
		if (!res.ok) return fail(502, { error: res.error });
		return { success: 'Entry updated.' };
	},

	removeEntry: async ({ request }) => {
		const f = await request.formData();
		const guild_id = String(f.get('guild_id') || '').trim();
		const recordId = String(f.get('record_id') || '').trim();
		if (!SNOWFLAKE.test(guild_id) || !recordId) return fail(400, { error: 'Invalid entry.' });
		const res = await removeReactionEntry(guild_id, recordId);
		if (!res.ok) return fail(502, { error: res.error });
		return { success: 'Entry removed.' };
	},

	deleteMessage: async ({ request }) => {
		const f = await request.formData();
		const guild_id = String(f.get('guild_id') || '').trim();
		const message_id = String(f.get('message_id') || '').trim();
		if (!SNOWFLAKE.test(guild_id) || !SNOWFLAKE.test(message_id)) return fail(400, { error: 'Invalid target.' });
		const res = await deleteReactionMessage(guild_id, message_id, f.get('delete_discord') === 'on');
		if (!res.ok) return fail(502, { error: res.error });
		return { success: `Deleted message group (${res.data.removed} entr(ies)).` };
	}
};

