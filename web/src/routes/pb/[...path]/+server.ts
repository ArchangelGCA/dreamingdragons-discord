import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const TARGET = (env.POCKETBASE_URL || 'http://127.0.0.1:8090').replace(/\/+$/, '');
const PREFIX = '/pb';

// Defer to PocketBase's own trailing-slash handling — without this SvelteKit
// would 308 "/pb/_/" -> "/pb/_" and PocketBase would bounce it straight back.
export const trailingSlash = 'ignore';

const INBOUND_BLOCKLIST = new Set([
	'host',
	'connection',
	'content-length',
	'content-encoding',
	'accept-encoding',
	'transfer-encoding',
	'upgrade',
	'te',
	'trailer',
	'keep-alive',
	'proxy-authorization',
	'proxy-authenticate',
	'cookie'
]);

const OUTBOUND_BLOCKLIST = new Set([
	'host',
	'connection',
	'content-length',
	'content-encoding',
	'transfer-encoding',
	'upgrade',
	'te',
	'trailer',
	'keep-alive',
	'proxy-authorization',
	'proxy-authenticate',
	'server',
	'date',
	'via',
	'x-forwarded-for',
	'x-forwarded-host',
	'x-forwarded-proto',
	'set-cookie'
]);

function rewriteLocation(loc: string | null): string | null {
	if (!loc) return null;
	if (loc.startsWith('/')) {
		const hasPrefix = loc === PREFIX || loc.startsWith(PREFIX + '/');
		return hasPrefix ? loc : PREFIX + loc;
	}
	try {
		const parsed = new URL(loc);
		const origin = new URL(TARGET).origin;
		if (parsed.origin === origin) return PREFIX + parsed.pathname + parsed.search;
	} catch {
		return PREFIX + '/' + loc;
	}
	return loc;
}

async function proxy(event: Parameters<RequestHandler>[0]): Promise<Response> {
	const path = event.url.pathname.slice(PREFIX.length);
	if (path === '') return redirect(307, `${PREFIX}/_/`);

	const target = TARGET + path + event.url.search;

	const headers = new Headers(event.request.headers);
	for (const name of INBOUND_BLOCKLIST) headers.delete(name);
	headers.set('accept-encoding', 'identity');

	const options: RequestInit & { duplex?: 'half' } = {
		method: event.request.method,
		headers,
		redirect: 'manual'
	};
	if (event.request.method !== 'GET' && event.request.method !== 'HEAD' && event.request.body) {
		options.body = event.request.body;
		options.duplex = 'half';
	}

	let upstream: Response;
	try {
		upstream = await fetch(target, options);
	} catch {
		return new Response('PocketBase is unreachable.', {
			status: 502,
			headers: { 'cache-control': 'no-store' }
		});
	}

	const responseHeaders = new Headers();
	for (const [name, value] of upstream.headers) {
		if (!OUTBOUND_BLOCKLIST.has(name.toLowerCase())) responseHeaders.append(name, value);
	}
	const location = rewriteLocation(upstream.headers.get('location'));
	if (location) responseHeaders.set('location', location);

	return new Response(upstream.body, {
		status: upstream.status,
		statusText: upstream.statusText,
		headers: responseHeaders
	});
}

export const GET: RequestHandler = (event) => proxy(event);
export const HEAD: RequestHandler = (event) => proxy(event);
export const POST: RequestHandler = (event) => proxy(event);
export const PUT: RequestHandler = (event) => proxy(event);
export const PATCH: RequestHandler = (event) => proxy(event);
export const DELETE: RequestHandler = (event) => proxy(event);
export const OPTIONS: RequestHandler = (event) => proxy(event);