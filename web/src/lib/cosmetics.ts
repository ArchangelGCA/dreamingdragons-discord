/**
 * Single source of truth for cosmetic catalog items on the web side.
 * Mirror of the bot's catalog in utils/economy.js — keep both in sync.
 *
 * Exports types, the full catalog array, lookup helpers, and a resolved
 * shape that the public profile page can render directly.
 */
export interface CosmeticDef {
	id: string;
	slot: 'color' | 'title' | 'frame' | 'flair' | 'banner' | 'badge' | 'effect';
	name: string;
	emoji: string;
	description: string;
	price: number;
	palette?: [string, string];
	accent?: number;
	cssClass?: string;
	rarity?: string;
}

export const COSMETICS: CosmeticDef[] = [
	// ── Colors ──
	{ id: 'color-crimson', slot: 'color', name: 'Crimson', emoji: '🟥', description: 'A fierce red gradient for your profile card.', price: 500, palette: ['#ef4444', '#b91c1c'], accent: 0xef4444, rarity: 'common' },
	{ id: 'color-amethyst', slot: 'color', name: 'Amethyst', emoji: '🟪', description: 'Royal purple tones.', price: 500, palette: ['#8b5cf6', '#6d28d9'], accent: 0x8b5cf6, rarity: 'common' },
	{ id: 'color-azure', slot: 'color', name: 'Azure', emoji: '🟦', description: 'Bright ocean blues.', price: 500, palette: ['#38bdf8', '#0284c7'], accent: 0x38bdf8, rarity: 'common' },
	{ id: 'color-rose', slot: 'color', name: 'Rose', emoji: '🩷', description: 'Warm pink tones.', price: 500, palette: ['#fb7185', '#be123c'], accent: 0xfb7185, rarity: 'common' },
	{ id: 'color-obsidian', slot: 'color', name: 'Obsidian', emoji: '⬛', description: 'Sleek graphite to slate — stealth mode.', price: 600, palette: ['#334155', '#0f172a'], accent: 0x334155, rarity: 'uncommon' },
	{ id: 'color-sunset', slot: 'color', name: 'Sunset', emoji: '🌅', description: 'Warm orange to rose — golden hour.', price: 650, palette: ['#f59e0b', '#ef4444'], accent: 0xf59e0b, rarity: 'uncommon' },
	{ id: 'color-mint', slot: 'color', name: 'Mint', emoji: '🌿', description: 'Fresh mint to teal.', price: 600, palette: ['#6ee7b7', '#0ea5e9'], accent: 0x6ee7b7, rarity: 'uncommon' },
	{ id: 'color-gold', slot: 'color', name: 'Gold Shimmer', emoji: '🌟', description: 'Premium golden gradient.', price: 750, palette: ['#fbbf24', '#d97706'], accent: 0xfbbf24, rarity: 'rare' },
	{ id: 'color-aurora', slot: 'color', name: 'Aurora', emoji: '🌈', description: 'Teal-to-cyan — the rarest hue.', price: 900, palette: ['#34d399', '#22d3ee'], accent: 0x34d399, rarity: 'epic' },

	// ── Titles ──
	{ id: 'title-dreamer', slot: 'title', name: 'Dreamer', emoji: '💭', description: 'You dream of dragons.', price: 400, rarity: 'common' },
	{ id: 'title-nightowl', slot: 'title', name: 'Night Owl', emoji: '🦉', description: 'Active when the moon is high.', price: 450, rarity: 'common' },
	{ id: 'title-hero', slot: 'title', name: 'Hatched Hero', emoji: '🐣', description: 'It all began with an egg.', price: 500, rarity: 'common' },
	{ id: 'title-tamer', slot: 'title', name: 'Dragon Tamer', emoji: '🐉', description: 'You have earned your scales.', price: 600, rarity: 'uncommon' },
	{ id: 'title-voidwalker', slot: 'title', name: 'Voidwalker', emoji: '🌌', description: 'Steps between worlds.', price: 750, rarity: 'uncommon' },
	{ id: 'title-starbound', slot: 'title', name: 'Starbound', emoji: '☄️', description: 'Chasing constellations.', price: 850, rarity: 'rare' },
	{ id: 'title-streakmaster', slot: 'title', name: 'Streak Master', emoji: '🔥', description: 'Unbroken dedication.', price: 1200, rarity: 'rare' },
	{ id: 'title-eternal', slot: 'title', name: 'Eternal', emoji: '♾️', description: 'Beyond time itself.', price: 1500, rarity: 'epic' },
	{ id: 'title-goldbaron', slot: 'title', name: 'Gold Baron', emoji: '👑', description: 'A fortune in gold.', price: 1500, rarity: 'epic' },

	// ── Frames ──
	{ id: 'frame-glow', slot: 'frame', name: 'Soft Glow', emoji: '✨', description: 'A gentle white glow around your card.', price: 1200, cssClass: 'frame-glow', rarity: 'rare' },
	{ id: 'frame-ember', slot: 'frame', name: 'Ember Glow', emoji: '🔥', description: 'Warm amber radiance.', price: 1500, cssClass: 'frame-ember', rarity: 'rare' },
	{ id: 'frame-frost', slot: 'frame', name: 'Frost Pulse', emoji: '❄️', description: 'Icy blue pulse — winter bound.', price: 1800, cssClass: 'frame-frost', rarity: 'epic' },
	{ id: 'frame-neon', slot: 'frame', name: 'Neon Edge', emoji: '💡', description: 'Sharp cyan-magenta neon border.', price: 2000, cssClass: 'frame-neon', rarity: 'epic' },
	{ id: 'frame-void', slot: 'frame', name: 'Void Rim', emoji: '🌑', description: 'Dark pulsating void energy.', price: 2500, cssClass: 'frame-void', rarity: 'legendary' },
	{ id: 'frame-rainbow', slot: 'frame', name: 'Rainbow', emoji: '🌈', description: 'An animated rainbow border.', price: 3000, cssClass: 'frame-rainbow', rarity: 'legendary' },

	// ── Flair ──
	{ id: 'flair-dragon', slot: 'flair', name: 'Dragon', emoji: '🐉', description: 'Show your dragon spirit.', price: 150, rarity: 'common' },
	{ id: 'flair-star', slot: 'flair', name: 'Star', emoji: '⭐', description: 'Shine on.', price: 180, rarity: 'common' },
	{ id: 'flair-fire', slot: 'flair', name: 'Fire', emoji: '🔥', description: 'Burning bright.', price: 220, rarity: 'common' },
	{ id: 'flair-moon', slot: 'flair', name: 'Moon', emoji: '🌙', description: 'Graceful and calm.', price: 280, rarity: 'common' },
	{ id: 'flair-heart', slot: 'flair', name: 'Heart', emoji: '💖', description: 'Lead with heart.', price: 320, rarity: 'uncommon' },
	{ id: 'flair-sparkles', slot: 'flair', name: 'Sparkles', emoji: '💫', description: 'Pure sparkle energy.', price: 350, rarity: 'uncommon' },
	{ id: 'flair-ghost', slot: 'flair', name: 'Ghost', emoji: '👻', description: 'Ethereal and playful.', price: 400, rarity: 'uncommon' },
	{ id: 'flair-diamond', slot: 'flair', name: 'Diamond', emoji: '💎', description: 'Rare and precious.', price: 650, rarity: 'rare' },

	// ── Banners ──
	{ id: 'banner-midnight', slot: 'banner', name: 'Midnight Veil', emoji: '🌌', description: 'Starry midnight navy with subtle sparkle.', price: 400, palette: ['#0f172a', '#1e293b'], cssClass: 'banner-midnight', rarity: 'common' },
	{ id: 'banner-ocean', slot: 'banner', name: 'Ocean Depths', emoji: '🌊', description: 'Deep teal to ocean blue.', price: 500, palette: ['#0e7490', '#0f766e'], cssClass: 'banner-ocean', rarity: 'common' },
	{ id: 'banner-sunset', slot: 'banner', name: 'Sunset Blaze', emoji: '🌇', description: 'Warm sunset orange to pink.', price: 600, palette: ['#f59e0b', '#ec4899'], cssClass: 'banner-sunset', rarity: 'uncommon' },
	{ id: 'banner-forest', slot: 'banner', name: 'Forest Canopy', emoji: '🌲', description: 'Emerald to forest green.', price: 600, palette: ['#059669', '#065f46'], cssClass: 'banner-forest', rarity: 'uncommon' },
	{ id: 'banner-nebula', slot: 'banner', name: 'Nebula', emoji: '☄️', description: 'Violet-cyan cosmic swirl.', price: 800, palette: ['#7c3aed', '#06b6d4'], cssClass: 'banner-nebula', rarity: 'rare' },
	{ id: 'banner-dragonfire', slot: 'banner', name: 'Dragonfire', emoji: '🐉', description: 'Crimson to molten gold — dragon forged.', price: 1000, palette: ['#dc2626', '#f59e0b'], cssClass: 'banner-dragonfire', rarity: 'epic' },

	// ── Badges ──
	{ id: 'badge-shield', slot: 'badge', name: 'Guardian Shield', emoji: '🛡️', description: 'Steadfast protector.', price: 300, rarity: 'common' },
	{ id: 'badge-wings', slot: 'badge', name: 'Wings', emoji: '🪽', description: 'Take flight.', price: 450, rarity: 'uncommon' },
	{ id: 'badge-crown', slot: 'badge', name: 'Crown', emoji: '👑', description: 'Regal authority.', price: 600, rarity: 'uncommon' },
	{ id: 'badge-gem', slot: 'badge', name: 'Gem Crest', emoji: '💎', description: 'Flawless rarity.', price: 800, rarity: 'rare' },
	{ id: 'badge-starcrest', slot: 'badge', name: 'Star Crest', emoji: '🌟', description: 'Celestial excellence.', price: 1000, rarity: 'epic' },

	// ── Effects ──
	{ id: 'effect-shimmer', slot: 'effect', name: 'Shimmer', emoji: '✨', description: 'Subtle gliding shine across your name.', price: 1000, cssClass: 'effect-shimmer', rarity: 'rare' },
	{ id: 'effect-neon', slot: 'effect', name: 'Neon Pulse', emoji: '💡', description: 'Soft pulsing neon glow.', price: 1500, cssClass: 'effect-neon', rarity: 'epic' },
	{ id: 'effect-holo', slot: 'effect', name: 'Holographic', emoji: '🌈', description: 'Animated rainbow gradient text.', price: 2000, cssClass: 'effect-holo', rarity: 'legendary' }
];

export const SLOTS = ['color', 'title', 'banner', 'frame', 'flair', 'badge', 'effect'] as const;
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
	title: string | null;
	titleEmoji?: string | null;
	frame: string | null;
	flair: string | null;
	banner: { from: string; to: string; cssClass: string | null } | null;
	badge: string | null;
	effect: string | null;
}

/**
 * Map a raw `equipped` JSON object (from PocketBase) into a
 * PublicCosmetics shape. Unknown ids are silently ignored → null.
 */
export function resolveEquipped(
	equipped: Record<string, string> | null | undefined
): PublicCosmetics {
	const out: PublicCosmetics = { color: null, title: null, frame: null, flair: null, banner: null, badge: null, effect: null };
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
				(out as any).titleEmoji = item.emoji;
				break;
			case 'frame':
				out.frame = item.cssClass ?? null;
				break;
			case 'flair':
				out.flair = item.emoji;
				break;
			case 'banner': {
				if (item.palette) out.banner = { from: item.palette[0], to: item.palette[1], cssClass: item.cssClass ?? null };
				else out.banner = { from: 'var(--accent-strong)', to: 'var(--accent-soft)', cssClass: item.cssClass ?? null };
				break;
			}
			case 'badge':
				out.badge = item.emoji;
				break;
			case 'effect':
				out.effect = item.cssClass ?? null;
				break;
		}
	}

	return out;
}

export function rarityFor(price: number): { label: string; color: string } {
	if (price >= 2500) return { label: 'Legendary', color: '#f59e0b' };
	if (price >= 1500) return { label: 'Epic', color: '#a855f7' };
	if (price >= 800) return { label: 'Rare', color: '#38bdf8' };
	if (price >= 400) return { label: 'Uncommon', color: '#22c55e' };
	return { label: 'Common', color: '#94a3b8' };
}
