import { redirect } from '@sveltejs/kit';
import { setGuildCookie } from '$lib/server/guild';
import type { RequestHandler } from './$types';

/** Only allow redirecting back to a local path (no open redirects). */
function safeLocal(path: string): string {
	return path.startsWith('/') && !path.startsWith('//') ? path : '/';
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	const form = await request.formData();
	const guildId = String(form.get('guild_id') || '').trim();
	const redirectTo = safeLocal(String(form.get('redirectTo') || '/'));
	if (/^\d{5,25}$/.test(guildId)) {
		setGuildCookie(cookies, guildId);
	}
	throw redirect(303, redirectTo);
};
