import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { ReactionRole } from '$lib/types';

export const load: PageServerLoad = async ({ locals }) => {
	const records = await locals.pb
		.collection('reaction_roles')
		.getFullList<ReactionRole>({ sort: 'created' });

	// Group entries by their Discord message.
	const groupsMap = new Map<string, { message_id: string; guild_id: string; channel_id: string; type: string; entries: ReactionRole[] }>();
	for (const r of records) {
		if (!groupsMap.has(r.message_id)) {
			groupsMap.set(r.message_id, {
				message_id: r.message_id,
				guild_id: r.guild_id,
				channel_id: r.channel_id,
				type: r.component_type === 'button' ? 'button' : 'reaction',
				entries: []
			});
		}
		groupsMap.get(r.message_id)!.entries.push(r);
	}

	return { groups: [...groupsMap.values()], total: records.length };
};

export const actions: Actions = {
	deleteEntry: async ({ request, locals }) => {
		const f = await request.formData();
		try {
			await locals.pb.collection('reaction_roles').delete(String(f.get('id') || ''));
			return { success: 'Entry deleted. (Remember to clean up the Discord message via /reactionrole if needed.)' };
		} catch {
			return fail(400, { error: 'Failed to delete entry.' });
		}
	},

	deleteMessage: async ({ request, locals }) => {
		const f = await request.formData();
		const messageId = String(f.get('message_id') || '');
		try {
			const records = await locals.pb
				.collection('reaction_roles')
				.getFullList({ filter: locals.pb.filter('message_id = {:m}', { m: messageId }) });
			for (const r of records) {
				await locals.pb.collection('reaction_roles').delete(r.id);
			}
			return { success: `Deleted ${records.length} entr(ies) for message ${messageId}.` };
		} catch {
			return fail(400, { error: 'Failed to delete message group.' });
		}
	}
};
