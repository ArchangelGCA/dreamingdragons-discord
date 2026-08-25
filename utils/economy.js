/**
 * Economy system: daily rewards, streak tracking, cosmetics shop, gold balance.
 * Every function is exported so both the bot and the test suite can use them.
 *
 * Balance tuned to the default leveling config (20 XP/msg, 60s cooldown,
 * 100·n^1.5 curve):
 *   – A daily claim ≈ 5 messages' worth of XP at base.
 *   – A 30-day streak yields ~5 500 XP (~level 6–7) and ~4 300 gold (with milestones).
 *   – Gold from one week of perfect claims buys a colour (~500 gold) — welcome gift accelerates first purchase.
 *   – Flair & banners: 1–7 days; colours/titles: 1–10 days; frames/badges/effects: 2–5 weeks.
 *   – A free 5% jackpot (2× gold) + 3-day grace keeps it exciting and forgiving.
 *   – The welcome gift gives new users their first flair/badge immediately.
 */

import {calculateLevelFromXp, invalidateUserCache, checkAndAwardRoles} from './leveling.js';
import {cumulativeXpForLevel} from './levelservice.js';

// ── Published constants (importable by tests & UI) ───────────────────────
export const DAILY_BASE_XP = 100;
export const DAILY_BASE_GOLD = 55;
export const STREAK_BONUS_PER_DAY = 0.10;
export const STREAK_BONUS_CAP = 1.0;
export const MILESTONE_EVERY = 7;
export const MILESTONE_GOLD = 120;
export const WELCOME_GOLD = 200;
export const JACKPOT_CHANCE = 0.05;
export const JACKPOT_MULTIPLIER = 2;
export const GRACE_DAYS = 3;
export const COLLECTION_NAME = 'user_economy';
export const XP_BUFFER = 10;

// ── Cosmetics catalog ────────────────────────────────────────────────────
//
// Single source of truth: shared/cosmetics.json (repo root)
// Edit that JSON to add/remove items — both the bot (this file) and the
// SvelteKit web (web/src/lib/cosmetics.ts) read from it. No duplication.
//
// +--------+--------+--------+--------+
//  Slot    | id prefix | owned per … | slot constraint
//  color   | color-…  | 1            | equipped overrides card accent + progress bar + banner tint
//  title   | title-…  | 1            | displayed under name on profile as pill
//  frame   | frame-…  | 1            | CSS class on the profile card border / avatar ring
//  flair   | flair-…  | 1            | emoji next to the name + leaderboard flair
//  banner  | banner-… | 1            | top banner gradient / pattern on profile card
//  badge   | badge-…  | 1            | small corner badge on card + leaderboard emblem
//  effect  | effect-… | 1            | animated name text effect (shimmer, neon...)
// +--------+--------+--------+--------+

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// Shared catalog — one JSON, both runtimes (bot + web). See shared/cosmetics.json
// eslint-disable-next-line @typescript-eslint/no-require-imports
const COSMETICS_DATA = require('../shared/cosmetics.json');

/**
 * @typedef {{id:string, slot:string, name:string, emoji:string, description:string, price:number, palette?:string[], accent?:number, cssClass?:string, rarity?:string}} CatalogItem
 */

/** @type {CatalogItem[]} */
export const COSMETICS = COSMETICS_DATA;

/** All unique slot names, in display order. */
export const SLOTS = ['color', 'title', 'banner', 'frame', 'flair', 'badge', 'effect'];

const SLOT_EMOJI = {color: '🎨', title: '🏷️', banner: '🏞️', frame: '🖼️', flair: '💫', badge: '🎖️', effect: '✨'};
const SLOT_LABEL = {color: 'Colours', title: 'Titles', banner: 'Banners', frame: 'Frames', flair: 'Flair', badge: 'Badges', effect: 'Effects'};

/** @type {Map<string, CatalogItem>} */
const byId = new Map(COSMETICS.map((i) => [i.id, i]));

/** Look up a catalog item by id. Returns undefined for unknown ids. */
export function findItem(id) {
    return byId.get(id);
}

/** Group items by slot. */
export function itemsBySlot() {
    const groups = {};
    for (const slot of SLOTS) groups[slot] = [];
    for (const item of COSMETICS) groups[item.slot].push(item);
    return groups;
}

export function slotEmoji(slot) {
    return SLOT_EMOJI[slot] ?? '▫️';
}

export function slotLabel(slot) {
    return SLOT_LABEL[slot] ?? slot;
}

// ── Pure date helpers (UTC calendar days) ────────────────────────────────

/** @param {Date} [d] */
export function utcDayString(d = new Date()) {
    return d.toISOString().slice(0, 10);
}

/** @param {Date} [d] */
export function nextUtcMidnight(d = new Date()) {
    const n = new Date(d);
    n.setUTCDate(n.getUTCDate() + 1);
    n.setUTCHours(0, 0, 0, 0);
    return n;
}

/** Integer days between two 'YYYY-MM-DD' strings (a < b). */
export function dayGap(from, to) {
    const a = new Date(from + 'T00:00:00Z');
    const b = new Date(to + 'T00:00:00Z');
    return Math.round((b - a) / 86400000);
}

// ── Pure streak / reward logic ───────────────────────────────────────────

/**
 * Evaluate the outcome of a claim attempt.
 * @param {{lastClaimDate?:string|null, daily_streak?:number, total_claims?:number}|null} record
 * @param {string} today YYYY-MM-DD
 * @param {() => number} [rng] 0–1 (default Math.random)
 * @returns {{
 *   outcome: 'already'|'new'|'resumed'|'broken',
 *   newStreak: number,
 *   brokenFrom: number|null,
 *   rescued: boolean,
 *   reward: {xp:number, gold:number, milestoneGold:number, jackpot:boolean, welcomeGold:number, multiplier:number},
 *   isFirstEver: boolean
 * }}
 */
export function evaluateClaim(record, today, rng = Math.random) {
    // PocketBase stores snake_case (last_claim_date) while tests/mock records may use camelCase;
    // support both to avoid the "multiple claims per day" bug when the wrong key is read as undefined.
    const last = record?.lastClaimDate ?? record?.last_claim_date ?? null;

    if (last === today) {
        return {outcome: 'already', newStreak: 0, brokenFrom: null, rescued: false, reward: null, isFirstEver: false};
    }

    if (!last) {
        // First ever claim (no previous date or empty string)
        const newStreak = 1;
        const isFirstEver = true;
        return {
            outcome: 'new',
            newStreak,
            brokenFrom: null,
            rescued: false,
            reward: computeReward(newStreak, isFirstEver, rng),
            isFirstEver
        };
    }

    const gap = dayGap(last, today);

    if (gap <= 0) {
        return {outcome: 'already', newStreak: 0, brokenFrom: null, rescued: false, reward: null, isFirstEver: false};
    }

    const oldStreak = record.daily_streak ?? record.dailyStreak ?? 1;

    if (gap <= GRACE_DAYS) {
        // Streak continues (perfect or rescued)
        const newStreak = oldStreak + 1;
        return {
            outcome: 'new',
            newStreak,
            brokenFrom: null,
            rescued: gap > 1,
            reward: computeReward(newStreak, false, rng),
            isFirstEver: false
        };
    }

    // Streak broken: gap > GRACE_DAYS
    return {
        outcome: 'broken',
        newStreak: 1,
        brokenFrom: oldStreak,
        rescued: false,
        reward: computeReward(1, false, rng),
        isFirstEver: false
    };
}

/**
 * Pure reward computation. Does NOT use the record — only parameters.
 * @param {number} newStreak
 * @param {boolean} isFirstEver
 * @param {() => number} rng
 * @returns {{xp:number, gold:number, milestoneGold:number, jackpot:boolean, welcomeGold:number, multiplier:number}}
 */
export function computeReward(newStreak, isFirstEver, rng = Math.random) {
    const mult = Math.min(1 + STREAK_BONUS_PER_DAY * (newStreak - 1), 1 + STREAK_BONUS_CAP);
    const xp = Math.round(DAILY_BASE_XP * mult);
    let gold = Math.round(DAILY_BASE_GOLD * mult);

    let milestoneGold = 0;
    if (newStreak > 0 && newStreak % MILESTONE_EVERY === 0) {
        milestoneGold = MILESTONE_GOLD * (newStreak / MILESTONE_EVERY);
        gold += milestoneGold;
    }

    const jackpot = rng() < JACKPOT_CHANCE;
    if (jackpot) {
        gold *= JACKPOT_MULTIPLIER;
    }

    let welcomeGold = 0;
    if (isFirstEver) {
        welcomeGold = WELCOME_GOLD;
        gold += welcomeGold;
    }

    return {xp, gold: Math.round(gold), milestoneGold, jackpot, welcomeGold, multiplier: mult};
}

/** Return the next upcoming milestone (always strictly ahead of `streak`), or null. */
export function nextMilestoneInfo(streak) {
    if (streak < 1) return null;
    const nextHigher = Math.floor((streak + MILESTONE_EVERY - 1) / MILESTONE_EVERY) * MILESTONE_EVERY;
    const next = nextHigher === streak ? nextHigher + MILESTONE_EVERY : nextHigher;
    return {next, inDays: next - streak};
}

/** Seconds until the next UTC midnight. */
export function secondsUntilMidnight(now = new Date()) {
    const nxt = nextUtcMidnight(now);
    return Math.round((nxt - now) / 1000);
}

// ── Purchase / equip pure logic ──────────────────────────────────────────

/**
 * Check whether a purchase is valid.
 * @param {{gold:number, cosmetics?:string[]}} wallet
 * @param {string} itemId
 * @returns {{ok:true}|{ok:false, error:string}}
 */
export function evaluatePurchase(wallet, itemId) {
    const item = byId.get(itemId);
    if (!item) return {ok: false, error: 'Unknown item.'};
    const owned = wallet.cosmetics || [];
    if (owned.includes(itemId)) return {ok: false, error: `You already own **${item.name}**.`};
    if ((wallet.gold || 0) < item.price) return {ok: false, error: `**${item.name}** costs ${item.price} 🪙 but you only have ${wallet.gold || 0} 🪙.`};
    return {ok: true};
}

/**
 * Evaluate an equip/unequip request.
 * @param {{cosmetics?:string[], equipped?:object}} wallet
 * @param {string} candidate item id or "none:<slot>"
 * @returns {{ok:true, action:'equip'|'unequip', item?:CatalogItem, slot:string}|{ok:false, error:string}}
 */
export function evaluateEquip(wallet, candidate) {
    const owned = wallet.cosmetics || [];
    const equipped = wallet.equipped || {};

    // Unequip request
    if (candidate.startsWith('none:')) {
        const slot = candidate.slice(5);
        if (!SLOTS.includes(slot)) return {ok: false, error: 'Invalid slot.'};
        if (!equipped[slot]) return {ok: false, error: `You don't have anything equipped in the **${slotLabel(slot)}** slot.`};
        return {ok: true, action: 'unequip', slot};
    }

    const item = byId.get(candidate);
    if (!item) return {ok: false, error: 'Unknown item.'};
    if (!owned.includes(candidate)) return {ok: false, error: `You don't own **${item.name}**. Buy it first with \`/buy\`.`};
    return {ok: true, action: 'equip', item, slot: item.slot};
}

// ── In-memory claim lock (per (guild, user)) ─────────────────────────────
const claimLocks = new Map();

async function withLock(key, fn) {
    while (claimLocks.has(key)) {
        await claimLocks.get(key);
    }
    const promise = fn();
    claimLocks.set(key, promise);
    try {
        return await promise;
    } finally {
        if (claimLocks.get(key) === promise) claimLocks.delete(key);
    }
}

// ── Persistence helpers ──────────────────────────────────────────────────

const COLL = COLLECTION_NAME;

/** Helper to build a filter string for (guild_id, user_id). */
function gidFilter(pb, guildId, userId) {
    return pb.filter('guild_id = {:g} && user_id = {:u}', {g: guildId, u: userId});
}

/** Get the wallet record or null. */
export async function getEconomyRecord(pb, guildId, userId) {
    const res = await pb.collection(COLL).getList(1, 1, {filter: gidFilter(pb, guildId, userId)});
    return res.totalItems > 0 ? res.items[0] : null;
}

/** Get or create a wallet — returns the record. */
export async function getOrCreateEconomyRecord(pb, guildId, userId) {
    const existing = await getEconomyRecord(pb, guildId, userId);
    if (existing) return existing;
    try {
        return await pb.collection(COLL).create({
            guild_id: guildId,
            user_id: userId,
            gold: 0,
            daily_streak: 0,
            best_streak: 0,
            total_claims: 0,
            last_claim_date: '',
            last_reminder_date: '',
            dm_reminders: false,
            cosmetics: [],
            equipped: {}
        });
    } catch {
        // Race: another goroutine created it first. Re-fetch.
        return await getEconomyRecord(pb, guildId, userId);
    }
}

// ── High-level actions ───────────────────────────────────────────────────

/**
 * Claim the daily reward. Idempotent per day. Grants XP, gold, checks roles
 * on level-up. Returns the full result for the UI builder.
 */
export async function claimDailyReward(pb, client, guildId, userId) {
    const key = `${guildId}:${userId}`;
    return withLock(key, async () => {
        const record = await getOrCreateEconomyRecord(pb, guildId, userId);
        const today = utcDayString();
        const rng = () => Math.random();
        const evalResult = evaluateClaim(record, today, rng);

        if (evalResult.outcome === 'already') {
            return {already: true, secondsUntilMidnight: secondsUntilMidnight()};
        }

        const {xp, gold, milestoneGold, jackpot, welcomeGold, multiplier} = evalResult.reward;
        const newStreak = evalResult.newStreak;
        const oldStreak = record.daily_streak || 0;
        const newGold = (record.gold || 0) + gold;
        const newBest = Math.max(record.best_streak || 0, newStreak);
        const newTotalClaims = (record.total_claims || 0) + 1;

        // Persist economy
        await pb.collection(COLL).update(record.id, {
            gold: newGold,
            daily_streak: newStreak,
            best_streak: newBest,
            total_claims: newTotalClaims,
            last_claim_date: today,
            last_reminder_date: today // reset reminder timer
        });

        // Grant XP
        let leveledUp = false;
        let oldLevel = 0;
        let newLevel = 0;
        try {
            const userLevelRes = await pb.collection('user_levels').getList(1, 1, {
                filter: gidFilter(pb, guildId, userId)
            });
            if (userLevelRes.totalItems > 0) {
                const rec = userLevelRes.items[0];
                oldLevel = calculateLevelFromXp(rec.xp);
                const newXp = rec.xp + xp;
                newLevel = calculateLevelFromXp(newXp);
                await pb.collection('user_levels').update(rec.id, {
                    xp: newXp,
                    level: newLevel,
                    last_message_time: new Date().toISOString()
                });
            } else {
                oldLevel = 0;
                newLevel = calculateLevelFromXp(xp);
                await pb.collection('user_levels').create({
                    guild_id: guildId,
                    user_id: userId,
                    xp,
                    level: newLevel,
                    last_message_time: new Date().toISOString()
                });
            }
            invalidateUserCache(guildId, userId);
            leveledUp = newLevel > oldLevel;
            if (leveledUp) {
                await checkAndAwardRoles(userId, guildId, newLevel, client, pb).catch(() => {});
            }
        } catch (err) {
            console.error(`[economy] XP grant failed for ${userId} in ${guildId}:`, err);
        }

        return {
            already: false,
            reward: evalResult.reward,
            newStreak,
            oldStreak,
            bestStreak: newBest,
            totalClaims: newTotalClaims,
            newGold,
            rescued: evalResult.rescued,
            brokenFrom: evalResult.brokenFrom,
            leveledUp,
            oldLevel,
            newLevel,
            multiplier,
            secondsUntilMidnight: secondsUntilMidnight()
        };
    });
}

/**
 * Purchase a cosmetic item. Deducts gold, adds to owned array.
 * @returns {{ok:true}|{ok:false, error:string}}
 */
export async function purchaseCosmetic(pb, guildId, userId, itemId) {
    const record = await getOrCreateEconomyRecord(pb, guildId, userId);
    const check = evaluatePurchase(record, itemId);
    if (!check.ok) return check;

    const item = byId.get(itemId);
    const oldCosmetics = record.cosmetics || [];
    const newGold = (record.gold || 0) - item.price;

    await pb.collection(COLL).update(record.id, {
        gold: newGold,
        cosmetics: [...oldCosmetics, itemId]
    });

    return {ok: true, item, newGold};
}

/**
 * Equip or unequip an item. Supports "none:<slot>" for unequip.
 * @returns {{ok:true, action:'equip'|'unequip', slot:string, item?:CatalogItem}|{ok:false, error:string}}
 */
export async function equipCosmetic(pb, guildId, userId, candidate) {
    const record = await getOrCreateEconomyRecord(pb, guildId, userId);
    const check = evaluateEquip(record, candidate);
    if (!check.ok) return check;

    const equipped = {...(record.equipped || {})};

    if (check.action === 'unequip') {
        delete equipped[check.slot];
    } else {
        equipped[check.slot] = check.item.id;
    }

    await pb.collection(COLL).update(record.id, {equipped});
    return {ok: true, ...check, equipped};
}

/** Toggle DM streak reminders. */
export async function setReminderOptIn(pb, guildId, userId, enabled) {
    const record = await getOrCreateEconomyRecord(pb, guildId, userId);
    await pb.collection(COLL).update(record.id, {dm_reminders: enabled});
    return {enabled};
}

/**
 * Resolve equipped cosmetics for a user into catalog items by slot.
 * Returns {color, title, frame, flair} — each either a CatalogItem or null.
 */
export async function getEquippedCosmetics(pb, guildId, userId) {
    const record = await getEconomyRecord(pb, guildId, userId);
    if (!record?.equipped) return null;
    const eq = record.equipped;
    const out = {};
    for (const slot of SLOTS) {
        const id = eq[slot];
        out[slot] = id ? (byId.get(id) || null) : null;
    }
    return out;
}

/** Autocomplete choices for the buy command. */
export function autocompleteBuyChoices(query) {
    const q = query.toLowerCase();
    return COSMETICS
        .filter((i) => i.name.toLowerCase().includes(q) || i.id.includes(q) || i.slot.includes(q))
        .slice(0, 25)
        .map((i) => ({name: `${i.emoji} ${i.name} — ${i.price}🪙  (${slotLabel(i.slot)})`.slice(0, 100), value: i.id}));
}

/**
 * Autocomplete choices for the equip command:
 *   – owned items (filtered by query),
 *   – "remove current X" for each equipped slot.
 */
export async function autocompleteEquippedChoices(pb, guildId, userId, query) {
    const record = await getEconomyRecord(pb, guildId, userId);
    const q = query.toLowerCase();
    const choices = [];

    if (record) {
        const owned = record.cosmetics || [];
        const equipped = record.equipped || {};

        for (const id of owned) {
            const item = byId.get(id);
            if (!item) continue;
            const tag = equipped[item.slot] === id ? '✅' : '';
            const label = `${tag} ${item.emoji} ${item.name}  (${slotLabel(item.slot)})`.slice(0, 100);
            if (label.toLowerCase().includes(q)) choices.push({name: label, value: id});
        }

        // Unequip entries for slots that are filled
        for (const slot of SLOTS) {
            if (equipped[slot]) {
                const label = `🚫 Remove current ${slotLabel(slot)}`.slice(0, 100);
                if (label.toLowerCase().includes(q)) choices.push({name: label, value: `none:${slot}`});
            }
        }
    }

    return choices.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 25);
}