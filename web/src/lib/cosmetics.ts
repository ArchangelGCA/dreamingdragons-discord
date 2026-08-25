/**
 * Web helpers on top of the shared catalog at shared/cosmetics.json (repo root).
 * The catalog itself is NOT duplicated here — edit shared/cosmetics.json once
 * and both the Discord bot (utils/economy.js) and this SvelteKit app pick it up.
 *
 * This module keeps web-specific types and the PublicCosmetics resolver.
 */
import cosmeticsData from '../../../shared/cosmetics.json';

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

export const COSMETICS: CosmeticDef[] = cosmeticsData as CosmeticDef[];

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
