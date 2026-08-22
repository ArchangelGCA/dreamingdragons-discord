/** Small presentational helpers shared across the dashboard UI. */

/** Initials for a name: up to two letters, uppercased. */
export function monogram(name: string): string {
	const parts = name
		.replace(/[^\p{L}\p{N}\s]/gu, ' ')
		.trim()
		.split(/\s+/)
		.filter(Boolean);
	if (parts.length === 0) return '?';
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Deterministic, pleasant gradient for an id/name — used for fallback avatars
 * and guild icons so each entity gets a stable, recognisable colour.
 */
export function gradientFor(seed: string): string {
	let h = 0;
	for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
	const a = h % 360;
	const b = (a + 40 + (h % 60)) % 360;
	return `linear-gradient(135deg, hsl(${a} 62% 52%), hsl(${b} 66% 46%))`;
}

/** Ensure a hex/color string is safe to drop into a style attribute. */
export function safeColor(color: string | null | undefined, fallback = 'var(--text-muted)'): string {
	if (!color) return fallback;
	return /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : fallback;
}

/**
 * Deterministic pseudonym for a Discord user id (`Member #4821`). Used on the
 * public pages when the bot can't resolve the real display name (bot offline),
 * so we never fall back to exposing raw IDs or stale data.
 */
export function anonymize(userId: string): string {
	let h = 0;
	for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
	return `Member #${String(h % 10000).padStart(4, '0')}`;
}
