import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

// Brute-force guard for the superuser login. The hooks rate limiter only
// covers anonymous GETs on public pages, so login POSTs get their own small
// fixed-window limiter keyed by client IP (same precedence as hooks.server.ts:
// Cloudflare header when behind the tunnel, else the socket address).
const LOGIN_WINDOW_MS = 5 * 60_000;
const LOGIN_MAX_ATTEMPTS = 10;
const loginHits = new Map<string, { start: number; count: number }>();

function loginRateLimited(key: string): boolean {
	const now = Date.now();
	const entry = loginHits.get(key);
	if (!entry || now - entry.start > LOGIN_WINDOW_MS) {
		loginHits.set(key, { start: now, count: 1 });
	} else {
		entry.count += 1;
		if (entry.count > LOGIN_MAX_ATTEMPTS) return true;
	}
	if (loginHits.size > 5000) {
		for (const [k, v] of loginHits) if (now - v.start > LOGIN_WINDOW_MS) loginHits.delete(k);
	}
	return false;
}

function loginKey(request: Request, getClientAddress: () => string): string {
	return (
		request.headers.get('cf-connecting-ip') ??
		request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
		getClientAddress()
	);
}

// Small tarpit on failure: slows online password guessing without locking
// the real admin out (no hard account lockout by design).
const slowDown = () => new Promise<void>((r) => setTimeout(r, 400));

export const actions: Actions = {
	default: async ({ request, locals, getClientAddress }) => {
		const form = await request.formData();
		const email = String(form.get('email') || '').trim();
		const password = String(form.get('password') || '');

		if (loginRateLimited(loginKey(request, getClientAddress))) {
			return fail(429, {
				error: 'Too many sign-in attempts — wait a few minutes and try again.',
				email
			});
		}

		if (!email || !password) {
			return fail(400, { error: 'Email and password are required.', email });
		}

		try {
			await locals.pb.collection('_superusers').authWithPassword(email, password);
		} catch {
			await slowDown();
			return fail(401, { error: 'Invalid credentials.', email });
		}

		// The auth cookie is written by the server hook after this response.
		throw redirect(303, '/dashboard');
	}
};
