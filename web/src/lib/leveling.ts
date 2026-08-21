/** Mirror of the bot's XP curve (utils/leveling.js) so the dashboard stays consistent. */

export function calculateXpForLevel(level: number): number {
	return Math.round(100 * Math.pow(level, 1.5));
}

export function calculateLevelFromXp(xp: number): number {
	let level = 0;
	let xpForNextLevel = calculateXpForLevel(level + 1);
	while (xp >= xpForNextLevel) {
		level++;
		xpForNextLevel += calculateXpForLevel(level + 1);
	}
	return level;
}

/** Total XP required to *reach* the given level (cumulative from level 0). */
export function cumulativeXpForLevel(level: number): number {
	let total = 0;
	for (let k = 1; k <= level; k++) total += calculateXpForLevel(k);
	return total;
}

export interface LevelProgress {
	level: number;
	/** XP earned into the current level. */
	into: number;
	/** XP span of the current level (into → next). */
	span: number;
	/** 0–100 percentage toward the next level. */
	pct: number;
}

/** Break a raw XP total into level + progress toward the next level. */
export function levelProgress(xp: number): LevelProgress {
	const level = calculateLevelFromXp(xp);
	const base = cumulativeXpForLevel(level);
	const span = calculateXpForLevel(level + 1);
	const into = Math.max(0, xp - base);
	const pct = span > 0 ? Math.min(100, Math.round((into / span) * 100)) : 0;
	return { level, into, span, pct };
}

/** Compact number formatting: 1234 → "1.2k". */
export function formatNumber(n: number): string {
	if (n < 1000) return String(n);
	if (n < 1_000_000) return (n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, '') + 'k';
	return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
}
