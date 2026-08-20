import PocketBase from 'pocketbase';
import { redirect, type Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const PB_URL = env.POCKETBASE_URL || 'http://127.0.0.1:8090';

// Routes reachable without an authenticated session.
const PUBLIC_PATHS = ['/login'];

function isPublic(pathname: string): boolean {
	return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export const handle: Handle = async ({ event, resolve }) => {
	const pb = new PocketBase(PB_URL);
	pb.autoCancellation(false);

	// Restore auth from the request cookie.
	pb.authStore.loadFromCookie(event.request.headers.get('cookie') || '');

	try {
		if (pb.authStore.isValid) {
			await pb.collection('_superusers').authRefresh();
		}
	} catch {
		pb.authStore.clear();
	}

	event.locals.pb = pb;
	event.locals.admin =
		pb.authStore.isValid && pb.authStore.record
			? { id: pb.authStore.record.id, email: pb.authStore.record.email as string }
			: null;

	// Auth guard.
	if (!event.locals.admin && !isPublic(event.url.pathname)) {
		throw redirect(303, '/login');
	}
	if (event.locals.admin && event.url.pathname === '/login') {
		throw redirect(303, '/');
	}

	const response = await resolve(event);

	// Persist the (possibly refreshed/cleared) auth back to the cookie.
	// secure:false so it works over plain HTTP inside Docker / LAN; run behind
	// HTTPS (e.g. the Cloudflare Tunnel) in production.
	response.headers.append(
		'set-cookie',
		pb.authStore.exportToCookie({ httpOnly: true, secure: false, sameSite: 'Lax', path: '/' })
	);

	return response;
};
