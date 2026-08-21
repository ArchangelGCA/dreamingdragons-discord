/**
 * Theme state (light / dark / system), persisted to localStorage and applied
 * as `data-theme` on <html>. The pre-paint script in app.html sets the initial
 * attribute; this store keeps it in sync with the UI toggle.
 */
import { browser } from '$app/environment';

export type Theme = 'light' | 'dark' | 'system';

function read(): Theme {
	if (!browser) return 'system';
	try {
		const t = localStorage.getItem('dd-theme');
		if (t === 'light' || t === 'dark') return t;
	} catch {
		/* ignore */
	}
	return 'system';
}

export const theme = $state<{ value: Theme }>({ value: read() });

export function setTheme(t: Theme): void {
	theme.value = t;
	if (!browser) return;
	try {
		if (t === 'system') localStorage.removeItem('dd-theme');
		else localStorage.setItem('dd-theme', t);
	} catch {
		/* ignore */
	}
	const root = document.documentElement;
	if (t === 'system') root.removeAttribute('data-theme');
	else root.setAttribute('data-theme', t);
}
