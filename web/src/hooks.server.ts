import PocketBase from 'pocketbase';
import { redirect, type Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const PB_URL = env.POCKETBASE_URL || 'http://127.0.0.1:8090';

// Harden the auth cookie when the dashboard is served over HTTPS (e.g. behind the
// Cloudflare Tunnel). Stays non-secure for local plain-HTTP dev so login still works.
const SECURE_COOKIES = (env.ORIGIN || '').startsWith('https://');

// Pages reachable without an authenticated session (the public site + login).
const PUBLIC_PAGE_PATTERNS: RegExp[] = [
	/^\/$/, // public home
	/^\/leaderboard$/,
	/^\/u\/[^/]+$/, // personal public stats card
	/^\/privacy$/,
	/^\/login$/
];

// Truly anonymous pages: no auth cookie work at all (visitors stay cookie-less).
// /login is intentionally EXCLUDED — logged-in admins landing on it should still
// be detected (from their cookie) and bounced to the dashboard.
const ANON_FAST_PATH_PATTERNS: RegExp[] = PUBLIC_PAGE_PATTERNS.slice(0, -1);

function isPublic(pathname: string): boolean {
	return PUBLIC_PAGE_PATTERNS.some((p) => p.test(pathname));
}

function isAnonFastPath(pathname: string): boolean {
	return ANON_FAST_PATH_PATTERNS.some((p) => p.test(pathname));
}

/**
 * Very light fixed-window rate limiter for the PUBLIC pages only. It exists so
 * anonymous traffic (crawlers, scrapers) can't hammer PocketBase through page
 * loads; the authenticated dashboard is unaffected. Keyed by client IP — the
 * Cloudflare-provided header when behind the tunnel, else the socket address.
 */
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 120; // requests per window per IP for public pages
const hits = new Map<string, { start: number; count: number }>();

function rateLimitExceeded(key: string): boolean {
	const now = Date.now();
	const entry = hits.get(key);
	if (!entry || now - entry.start > RATE_WINDOW_MS) {
		hits.set(key, { start: now, count: 1 });
	} else {
		entry.count += 1;
		if (entry.count > RATE_LIMIT) return true;
	}
	// Opportunistic cleanup so the map stays small.
	if (hits.size > 5000) {
		for (const [k, v] of hits) if (now - v.start > RATE_WINDOW_MS) hits.delete(k);
	}
	return false;
}

function clientIp(event: Parameters<Handle>[0]['event']): string {
	return (
		event.request.headers.get('cf-connecting-ip') ??
		event.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
		event.getClientAddress()
	);
}

export const handle: Handle = async ({ event, resolve }) => {
	const pb = new PocketBase(PB_URL);
	pb.autoCancellation(false);

	// Public site: no auth work at all (no cookie read, no token refresh, no
	// cookie written) — visitors never carry credentials.
	if (isAnonFastPath(event.url.pathname) && event.request.method === 'GET') {
		if (rateLimitExceeded(clientIp(event))) {
			return new Response('Too many requests — slow down a little.', { status: 429 });
		}
		event.locals.pb = pb; // unauthenticated; public reads use lib/server/public.ts
		event.locals.admin = null;
		return resolve(event);
	}

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

	// Auth guard: the /pb/* proxy requires admin auth. HTML navigations bounce
	// to login; XHR / API traffic gets a clean 401 instead of a redirect.
	if (!event.locals.admin) {
		const isPb = event.url.pathname === '/pb' || event.url.pathname.startsWith('/pb/');
		if (isPb && !event.request.headers.get('accept')?.includes('text/html')) {
			return new Response('Unauthorized', { status: 401 });
		}
		if (!isPublic(event.url.pathname)) throw redirect(303, '/login');
	}
	if (event.locals.admin && event.url.pathname === '/login') {
		throw redirect(303, '/dashboard');
	}

	const response = await resolve(event);

	// Persist the (possibly refreshed/cleared) auth back to the cookie.
	// secure is enabled automatically when ORIGIN is https (production/tunnel).
	response.headers.append(
		'set-cookie',
		pb.authStore.exportToCookie({ httpOnly: true, secure: SECURE_COOKIES, sameSite: 'Lax', path: '/' })
	);

	return response;
};
