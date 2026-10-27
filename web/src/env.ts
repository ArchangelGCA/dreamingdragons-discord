import { defineEnvVars } from '@sveltejs/kit/env';

/**
 * Explicit environment variables (SvelteKit 3).
 *
 * Everything the dashboard needs is declared here once, so it is validated and
 * typed instead of read ad-hoc from `$env/dynamic/private`. All variables below
 * are private (server-only) — they are never shipped to the browser.
 *
 * Defaults match the values used when running the app outside Docker.
 */

/** Absolute http(s) URL, trailing slashes stripped (they break URL joins). */
function httpUrl(name: string, fallback: string) {
	return (value: string | undefined): string => {
		const raw = (value ?? '').trim() || fallback;
		let parsed: URL;
		try {
			parsed = new URL(raw);
		} catch {
			throw new Error(`${name} must be an absolute URL, got ${JSON.stringify(value)}`);
		}
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
			throw new Error(`${name} must use http or https, got ${JSON.stringify(value)}`);
		}
		return raw.replace(/\/+$/, '');
	};
}

/**
 * Bare public origin (scheme + host + optional port, no path). It must match the
 * URL the dashboard is opened from, otherwise form submissions fail the CSRF
 * check — so an empty value is allowed (the origin is then derived from the
 * request) but a malformed one is rejected at startup.
 */
function origin(name: string) {
	return (value: string | undefined): string => {
		const raw = (value ?? '').trim().replace(/\/+$/, '');
		if (!raw) return '';
		let parsed: URL;
		try {
			parsed = new URL(raw);
		} catch {
			throw new Error(`${name} must be an absolute URL, got ${JSON.stringify(value)}`);
		}
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
			throw new Error(`${name} must use http or https, got ${JSON.stringify(value)}`);
		}
		if (parsed.origin !== raw) {
			throw new Error(
				`${name} must be a bare origin like https://example.com (no path, query or trailing slash), got ${JSON.stringify(value)}`
			);
		}
		return raw;
	};
}

export const variables = defineEnvVars({
	POCKETBASE_URL: {
		description: 'PocketBase base URL (http://pocketbase:8090 inside docker compose).',
		schema: httpUrl('POCKETBASE_URL', 'http://127.0.0.1:8090')
	},
	POCKETBASE_ADMIN_EMAIL: {
		description: 'Superuser email used for server-side PocketBase reads.',
		schema: (value) => (value ?? '').trim()
	},
	POCKETBASE_ADMIN_PASSWORD: {
		description: 'Superuser password used for server-side PocketBase reads.',
		schema: (value) => value ?? ''
	},
	ORIGIN: {
		description: 'Public URL the dashboard is opened from (e.g. https://admin.example.com).',
		schema: origin('ORIGIN')
	},
	BOT_API_URL: {
		description: "Base URL of the bot's internal API (http://bot:8787 inside docker compose).",
		schema: httpUrl('BOT_API_URL', 'http://bot:8787')
	},
	INTERNAL_API_SECRET: {
		description: 'Shared bearer secret for the internal bot API. Blank disables the bridge.',
		schema: (value) => (value ?? '').trim()
	}
});
