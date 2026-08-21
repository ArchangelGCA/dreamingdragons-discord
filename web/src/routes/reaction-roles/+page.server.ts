import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { ReactionRole } from '$lib/types';
import {
	getRoles,
	getChannels,
	getBotMessages,
	getMessagesStatus,
	createReactionMessage,
	updateReactionEmbed,
	addReactionEntry,
	editReactionEntry,
	removeReactionEntry,
	deleteReactionMessage,
	adoptReactionMessage,
	resendReactionMessage,
	type RoleDTO,
	type ChannelDTO,
	type BotMessageDTO,
	type ReactionEntryInput
} from '$lib/server/bot';

const SNOWFLAKE = /^\d{5,25}$/;

interface Group {
	message_id: string;
	guild_id: string;
	channel_id: string;
	type: 'button' | 'reaction';
	entries: ReactionRole[];
	exists?: boolean;
	// Current embed content on Discord, so the "edit message text" form can be
	// pre-filled instead of forcing the admin to retype the whole message.
	title?: string;
	description?: string;
	color?: string;
}

export const load: PageServerLoad = async ({ locals, parent, url }) => {
	const { guild } = await parent();
	const gid = guild?.currentGuildId ?? null;
	const adoptChannel = url.searchParams.get('adoptChannel') ?? '';

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
	let botMessages: BotMessageDTO[] = [];
	if (gid && guild?.botOnline) {
		const [r, c] = await Promise.all([getRoles(gid), getChannels(gid)]);
		if (r.ok) roles = r.data;
		if (c.ok) channels = c.data;

		// Flag which stored messages still exist on Discord (so we can offer "resend"),
		// and carry their current embed content so the edit form can be pre-filled.
		if (groups.length > 0) {
			const statuses = await getMessagesStatus(gid, groups.map((g) => g.message_id));
			for (const g of groups) {
				const st = statuses[g.message_id];
				g.exists = st?.exists ?? true;
				g.title = st?.title ?? '';
				g.description = st?.description ?? '';
				g.color = st?.color ?? '';
			}
		}
		// If a channel is selected for adoption, list the bot's messages there.
		if (SNOWFLAKE.test(adoptChannel)) {
			const bm = await getBotMessages(gid, adoptChannel);
			if (bm.ok) botMessages = bm.data;
		}
	}

	return { gid, groups, total, roles, channels, adoptChannel, botMessages };
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
		// The form is pre-filled with the message's current content, so this is a
		// full replace: send every field as-is (empty title/color clear them). A
		// blank description is rejected because a message needs body text.
		const title = String(f.get('title') || '').trim();
		const description = String(f.get('description') || '').trim();
		const color = String(f.get('color') || '').trim();
		if (!description) return fail(400, { error: 'Description cannot be empty.' });
		const res = await updateReactionEmbed(guild_id, message_id, { title, description, color });
		if (!res.ok) return fail(502, { error: res.error });
		return { success: 'Message updated.' };
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
	},

	adoptMessage: async ({ request }) => {
		const f = await request.formData();
		const guild_id = String(f.get('guild_id') || '').trim();
		const channelId = String(f.get('channel_id') || '').trim();
		const messageId = String(f.get('message_id') || '').trim();
		const mode = f.get('mode') === 'reaction' ? 'reaction' : 'button';
		if (!SNOWFLAKE.test(guild_id) || !SNOWFLAKE.test(channelId) || !SNOWFLAKE.test(messageId)) {
			return fail(400, { error: 'A valid channel and message are required.' });
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

		const res = await adoptReactionMessage(guild_id, { channelId, messageId, mode, entries });
		if (!res.ok) return fail(502, { error: res.error });
		return { success: `Reused existing message (${res.data.count} role(s) attached).` };
	},

	resendMessage: async ({ request }) => {
		const f = await request.formData();
		const guild_id = String(f.get('guild_id') || '').trim();
		const message_id = String(f.get('message_id') || '').trim();
		if (!SNOWFLAKE.test(guild_id) || !SNOWFLAKE.test(message_id)) return fail(400, { error: 'Invalid target.' });
		const channelId = String(f.get('channel_id') || '').trim();
		const embed = {
			title: String(f.get('title') || '').trim() || undefined,
			description: String(f.get('description') || '').trim() || undefined,
			color: String(f.get('color') || '').trim() || undefined
		};
		const res = await resendReactionMessage(guild_id, message_id, {
			channelId: SNOWFLAKE.test(channelId) ? channelId : undefined,
			embed
		});
		if (!res.ok) return fail(502, { error: res.error });
		return { success: `Message re-posted (${res.data.count} role(s) restored).` };
	}
};

