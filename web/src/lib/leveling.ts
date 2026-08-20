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
