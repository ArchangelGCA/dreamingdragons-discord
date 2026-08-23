/**
 * Single source of truth for cosmetic catalog items on the web side.
 * Mirror of the bot's catalog in utils/economy.js — keep both in sync.
 *
 * Exports types, the full catalog array, lookup helpers, and a resolved
 * shape that the public profile page can render directly.
 */
export interface CosmeticDef {
	id: string;
	slot: 'color' | 'title' | 'frame' | 'flair';
	name: string;
	emoji: string;
	description: string;
	price: number;
	palette?: [string, string]; // color slot only
	accent?: number; // color slot only (hex int for Discord)
	cssClass?: string; // frame slot only
}

export const COSMETICS: CosmeticDef[] = [
	// ── Colors ──
	{ id: 'color-crimson', slot: 'color', name: 'Crimson', emoji: '🟥', description: 'A fierce red gradient for your profile card.', price: 500, palette: ['#ef4444', '#b91c1c'], accent: 0xef4444 },
	{ id: 'color-amethyst', slot: 'color', name: 'Amethyst', emoji: '🟪', description: 'Royal purple tones.', price: 500, palette: ['#8b5cf6', '#6d28d9'], accent: 0x8b5cf6 },
	{ id: 'color-azure', slot: 'color', name: 'Azure', emoji: '🟦', description: 'Bright ocean blues.', price: 500, palette: ['#38bdf8', '#0284c7'], accent: 0x38bdf8 },
	{ id: 'color-rose', slot: 'color', name: 'Rose', emoji: '🩷', description: 'Warm pink tones.', price: 500, palette: ['#fb7185', '#be123c'], accent: 0xfb7185 },
	{ id: 'color-gold', slot: 'color', name: 'Gold Shimmer', emoji: '🌟', description: 'Premium golden gradient.', price: 750, palette: ['#fbbf24', '#d97706'], accent: 0xfbbf24 },
	{ id: 'color-aurora', slot: 'color', name: 'Aurora', emoji: '🌈', description: 'Teal-to-cyan — the rarest hue.', price: 900, palette: ['#34d399', '#22d3ee'], accent: 0x34d399 },

	// ── Titles ──
	{ id: 'title-dreamer', slot: 'title', name: 'Dreamer', emoji: '💭', description: 'You dream of dragons.', price: 400 },
	{ id: 'title-tamer', slot: 'title', name: 'Dragon Tamer', emoji: '🐉', description: 'You have earned your scales.', price: 600 },
	{ id: 'title-nightowl', slot: 'title', name: 'Night Owl', emoji: '🦉', description: 'Active when the moon is high.', price: 450 },
	{ id: 'title-streakmaster', slot: 'title', name: 'Streak Master', emoji: '🔥', description: 'Unbroken dedication.', price: 1200 },
	{ id: 'title-goldbaron', slot: 'title', name: 'Gold Baron', emoji: '👑', description: 'A fortune in gold.', price: 1500 },
	{ id: 'title-hero', slot: 'title', name: 'Hatched Hero', emoji: '🐣', description: 'It all began with an egg.', price: 500 },

	// ── Frames ──
	{ id: 'frame-glow', slot: 'frame', name: 'Soft Glow', emoji: '✨', description: 'A gentle white glow around your card.', price: 1500, cssClass: 'frame-glow' },
	{ id: 'frame-ember', slot: 'frame', name: 'Ember Glow', emoji: '🔥', description: 'Warm amber radiance.', price: 1800, cssClass: 'frame-ember' },
	{ id: 'frame-rainbow', slot: 'frame', name: 'Rainbow', emoji: '🌈', description: 'An animated rainbow border.', price: 3000, cssClass: 'frame-rainbow' },

	// ── Flair ──
	{ id: 'flair-dragon', slot: 'flair', name: 'Dragon', emoji: '🐉', description: 'Show your dragon spirit.', price: 200 },
	{ id: 'flair-fire', slot: 'flair', name: 'Fire', emoji: '🔥', description: 'Burning bright.', price: 300 },
	{ id: 'flair-star', slot: 'flair', name: 'Star', emoji: '⭐', description: 'Shine on.', price: 250 },
	{ id: 'flair-diamond', slot: 'flair', name: 'Diamond', emoji: '💎', description: 'Rare and precious.', price: 800 },
	{ id: 'flair-moon', slot: 'flair', name: 'Moon', emoji: '🌙', description: 'Graceful and calm.', price: 350 }
];

export const SLOTS = ['color', 'title', 'frame', 'flair'] as const;
export type CosmeticSlot = (typeof SLOTS)[number];

const byId = new Map<string, CosmeticDef>(COSMETICS.map((c) => [c.id, c]));

/** Look up a cosmetic by id. Returns undefined for unknown ids. */
export function getCosmetic(id: string | null | undefined): CosmeticDef | undefined {
	if (!id) return undefined;
	return byId.get(id);
}

/**
 * Resolved shape ready for rendering on the public profile card.
 * Server resolves equipped item ids into this shape.
 */
export interface PublicCosmetics {
	color: { from: string; to: string; accent: number } | null;
	title: string | null; // cosmetic name
	frame: string | null; // cssClass
	flair: string | null; // emoji
}

/**
 * Map a raw `equipped` JSON object (from PocketBase) into a
 * PublicCosmetics shape. Unknown ids are silently ignored → null.
 */
export function resolveEquipped(
	equipped: Record<string, string> | null | undefined
): PublicCosmetics {
	const out: PublicCosmetics = { color: null, title: null, frame: null, flair: null };
	if (!equipped) return out;

	for (const slot of SLOTS) {
		const id = equipped[slot];
		if (!id) continue;
		const item = getCosmetic(id);
		if (!item) continue;

		switch (slot) {
			case 'color': {
				if (item.palette && item.accent != null) {
					out.color = { from: item.palette[0], to: item.palette[1], accent: item.accent };
				}
				break;
			}
			case 'title':
				out.title = item.name;
				break;
			case 'frame':
				out.frame = item.cssClass ?? null;
				break;
			case 'flair':
				out.flair = item.emoji;
				break;
		}
	}

	return out;
}