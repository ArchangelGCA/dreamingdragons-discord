import test from 'node:test';
import assert from 'node:assert/strict';
import {
    utcDayString,
    dayGap,
    nextUtcMidnight,
    evaluateClaim,
    computeReward,
    evaluatePurchase,
    evaluateEquip,
    findItem,
    COSMETICS,
    SLOTS,
    itemsBySlot,
    nextMilestoneInfo,
    DAILY_BASE_XP,
    DAILY_BASE_GOLD,
    MILESTONE_GOLD,
    WELCOME_GOLD,
    JACKPOT_CHANCE,
    GRACE_DAYS,
    MILESTONE_EVERY
} from '../utils/economy.js';

// ── Date helpers ─────────────────────────────────────────────────────────

test('utcDayString returns YYYY-MM-DD format', () => {
    const s = utcDayString(new Date('2026-08-23T12:34:56Z'));
    assert.equal(s, '2026-08-23');
});

test('utcDayString at midnight boundary', () => {
    const s = utcDayString(new Date('2026-08-23T23:59:59Z'));
    assert.equal(s, '2026-08-23');
    const s2 = utcDayString(new Date('2026-08-24T00:00:00Z'));
    assert.equal(s2, '2026-08-24');
});

test('dayGap is 0 for the same day', () => {
    assert.equal(dayGap('2026-08-23', '2026-08-23'), 0);
});

test('dayGap is 1 for consecutive days', () => {
    assert.equal(dayGap('2026-08-23', '2026-08-24'), 1);
});

test('dayGap is 3 for three days apart', () => {
    assert.equal(dayGap('2026-08-20', '2026-08-23'), 3);
});

test('dayGap returns negative for reversed order', () => {
    assert.equal(dayGap('2026-08-25', '2026-08-23'), -2);
});

test('nextUtcMidnight returns the next day at 00:00 UTC', () => {
    const now = new Date('2026-08-23T14:30:00Z');
    const nxt = nextUtcMidnight(now);
    assert.equal(nxt.toISOString(), '2026-08-24T00:00:00.000Z');
});

// ── evaluateClaim: streak state machine ──────────────────────────────────

test('evaluateClaim: first ever claim', () => {
    const result = evaluateClaim(null, '2026-08-23');
    assert.equal(result.outcome, 'new');
    assert.equal(result.newStreak, 1);
    assert.equal(result.isFirstEver, true);
    assert.equal(result.brokenFrom, null);
    assert.equal(result.rescued, false);
    assert.ok(result.reward);
});

test('evaluateClaim: already claimed today', () => {
    const record = {lastClaimDate: '2026-08-23', daily_streak: 5};
    const result = evaluateClaim(record, '2026-08-23');
    assert.equal(result.outcome, 'already');
});

test('evaluateClaim: perfect continuation (gap=1)', () => {
    const record = {lastClaimDate: '2026-08-22', daily_streak: 5, total_claims: 5};
    const result = evaluateClaim(record, '2026-08-23');
    assert.equal(result.outcome, 'new');
    assert.equal(result.newStreak, 6);
    assert.equal(result.rescued, false);
    assert.equal(result.isFirstEver, false);
});

test('evaluateClaim: rescued within grace period (gap=2)', () => {
    const record = {lastClaimDate: '2026-08-21', daily_streak: 3};
    const result = evaluateClaim(record, '2026-08-23');
    assert.equal(result.outcome, 'new');
    assert.equal(result.newStreak, 4);
    assert.equal(result.rescued, true);
});

test('evaluateClaim: rescued within grace period (gap=3, last chance)', () => {
    const record = {lastClaimDate: '2026-08-20', daily_streak: 7};
    const result = evaluateClaim(record, '2026-08-23');
    assert.equal(result.outcome, 'new');
    assert.equal(result.newStreak, 8);
    assert.equal(result.rescued, true);
});

test('evaluateClaim: streak broken (gap=4)', () => {
    const record = {lastClaimDate: '2026-08-19', daily_streak: 12, total_claims: 20};
    const result = evaluateClaim(record, '2026-08-23');
    assert.equal(result.outcome, 'broken');
    assert.equal(result.newStreak, 1);
    assert.equal(result.brokenFrom, 12);
    assert.equal(result.rescued, false);
    assert.equal(result.isFirstEver, false);
});

test('evaluateClaim: streak broken after missing a long time', () => {
    const record = {lastClaimDate: '2026-01-01', daily_streak: 30};
    const result = evaluateClaim(record, '2026-08-23');
    assert.equal(result.outcome, 'broken');
    assert.equal(result.newStreak, 1);
    assert.equal(result.brokenFrom, 30);
});

// ── computeReward ────────────────────────────────────────────────────────

test('computeReward: base reward for brand new streak', () => {
    const r = computeReward(1, false, () => 0.5);
    assert.equal(r.xp, DAILY_BASE_XP);
    assert.equal(r.gold, DAILY_BASE_GOLD);
    assert.equal(r.multiplier, 1);
    assert.equal(r.milestoneGold, 0);
    assert.equal(r.jackpot, false);
    assert.equal(r.welcomeGold, 0);
});

test('computeReward: welcome gold on first ever claim', () => {
    const r = computeReward(1, true, () => 0.5);
    assert.equal(r.gold, DAILY_BASE_GOLD + WELCOME_GOLD);
    assert.equal(r.welcomeGold, WELCOME_GOLD);
});

test('computeReward: streak multiplier applies at day 5', () => {
    // streak = 5 → mult = 1 + 0.10*4 = 1.40
    const r = computeReward(5, false, () => 0.5);
    assert.equal(r.xp, Math.round(DAILY_BASE_XP * 1.40));
    assert.equal(r.gold, Math.round(DAILY_BASE_GOLD * 1.40));
    assert.equal(r.multiplier, 1.40);
});

test('computeReward: streak multiplier caps at 2.0 (day 10+)', () => {
    const r = computeReward(15, false, () => 0.5);
    assert.equal(r.multiplier, 2.0);
    assert.equal(r.xp, DAILY_BASE_XP * 2);
    assert.equal(r.gold, DAILY_BASE_GOLD * 2);
});

test('computeReward: milestone bonus on day 7', () => {
    const r = computeReward(7, false, () => 0.5);
    assert.equal(r.milestoneGold, MILESTONE_GOLD * 1);
    const expected = Math.round(DAILY_BASE_GOLD * (1 + 0.10 * 6)) + MILESTONE_GOLD * 1;
    assert.equal(r.gold, expected);
});

test('computeReward: milestone bonus on day 14', () => {
    const r = computeReward(14, false, () => 0.5);
    assert.equal(r.milestoneGold, MILESTONE_GOLD * 2);
});

test('computeReward: jackpot triggers and doubles gold', () => {
    const r = computeReward(1, false, () => 0.01); // below JACKPOT_CHANCE
    assert.equal(r.jackpot, true);
    assert.equal(r.gold, DAILY_BASE_GOLD * 2);
});

test('computeReward: no jackpot when rng is above threshold', () => {
    const r = computeReward(1, false, () => 0.99);
    assert.equal(r.jackpot, false);
    assert.equal(r.gold, DAILY_BASE_GOLD);
});

// ── nextMilestoneInfo ────────────────────────────────────────────────────

test('nextMilestoneInfo: for streak 1, next is day 7', () => {
    const info = nextMilestoneInfo(1);
    assert.equal(info.next, 7);
    assert.equal(info.inDays, 6);
});

test('nextMilestoneInfo: for streak 6, next is day 7', () => {
    const info = nextMilestoneInfo(6);
    assert.equal(info.next, 7);
    assert.equal(info.inDays, 1);
});

test('nextMilestoneInfo: for streak 7 (on milestone), next is day 14', () => {
    const info = nextMilestoneInfo(7);
    assert.equal(info.next, 14);
    assert.equal(info.inDays, 7);
});

test('nextMilestoneInfo: null for invalid streak', () => {
    assert.equal(nextMilestoneInfo(0), null);
    assert.equal(nextMilestoneInfo(-1), null);
});

// ── Catalog integrity ────────────────────────────────────────────────────

test('COSMETICS: every item has required fields', () => {
    for (const item of COSMETICS) {
        assert.ok(item.id, `item missing id: ${JSON.stringify(item)}`);
        assert.ok(SLOTS.includes(item.slot), `item ${item.id} has invalid slot: ${item.slot}`);
        assert.ok(item.name, `item ${item.id} missing name`);
        assert.ok(item.emoji, `item ${item.id} missing emoji`);
        assert.ok(Number.isFinite(item.price) && item.price > 0, `item ${item.id} has invalid price`);
    }
});

test('COSMETICS: all ids are unique', () => {
    const ids = COSMETICS.map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length);
});

test('COSMETICS: color items have palette and accent', () => {
    for (const item of COSMETICS) {
        if (item.slot === 'color') {
            assert.ok(Array.isArray(item.palette) && item.palette.length === 2, `color ${item.id} missing palette`);
            assert.ok(Number.isFinite(item.accent), `color ${item.id} missing accent`);
        }
    }
});

test('COSMETICS: frame items have cssClass', () => {
    for (const item of COSMETICS) {
        if (item.slot === 'frame') {
            assert.ok(item.cssClass, `frame ${item.id} missing cssClass`);
        }
    }
});

test('findItem returns item by id', () => {
    const item = findItem('color-crimson');
    assert.ok(item);
    assert.equal(item.name, 'Crimson');
});

test('findItem returns undefined for unknown id', () => {
    assert.equal(findItem('nonexistent'), undefined);
});

test('itemsBySlot returns all slots', () => {
    const groups = itemsBySlot();
    for (const slot of SLOTS) {
        assert.ok(Array.isArray(groups[slot]), `slot ${slot} missing`);
        assert.ok(groups[slot].length > 0, `slot ${slot} is empty`);
    }
});

// ── evaluatePurchase ─────────────────────────────────────────────────────

test('evaluatePurchase: ok for affordable, unowned item', () => {
    const wallet = {gold: 1000, cosmetics: []};
    const result = evaluatePurchase(wallet, 'color-crimson');
    assert.equal(result.ok, true);
});

test('evaluatePurchase: fails for unknown item', () => {
    const result = evaluatePurchase({gold: 999}, 'unknown');
    assert.equal(result.ok, false);
    assert.ok(result.error.includes('Unknown'));
});

test('evaluatePurchase: fails for already owned item', () => {
    const wallet = {gold: 999, cosmetics: ['color-crimson']};
    const result = evaluatePurchase(wallet, 'color-crimson');
    assert.equal(result.ok, false);
    assert.ok(result.error.includes('already own'));
});

test('evaluatePurchase: fails for insufficient funds', () => {
    const wallet = {gold: 100, cosmetics: []};
    const result = evaluatePurchase(wallet, 'color-crimson');
    assert.equal(result.ok, false);
    assert.ok(result.error.includes('costs'));
});

// ── evaluateEquip ────────────────────────────────────────────────────────

test('evaluateEquip: equips an owned item', () => {
    const wallet = {cosmetics: ['color-crimson'], equipped: {}};
    const result = evaluateEquip(wallet, 'color-crimson');
    assert.equal(result.ok, true);
    assert.equal(result.action, 'equip');
    assert.equal(result.slot, 'color');
});

test('evaluateEquip: fails for unowned item', () => {
    const wallet = {cosmetics: [], equipped: {}};
    const result = evaluateEquip(wallet, 'color-crimson');
    assert.equal(result.ok, false);
    assert.ok(result.error.includes("don't own"));
});

test('evaluateEquip: unequips a filled slot', () => {
    const wallet = {cosmetics: ['color-crimson'], equipped: {color: 'color-crimson'}};
    const result = evaluateEquip(wallet, 'none:color');
    assert.equal(result.ok, true);
    assert.equal(result.action, 'unequip');
    assert.equal(result.slot, 'color');
});

test('evaluateEquip: fails unequip on empty slot', () => {
    const wallet = {cosmetics: [], equipped: {}};
    const result = evaluateEquip(wallet, 'none:color');
    assert.equal(result.ok, false);
    assert.ok(result.error.includes("don't have anything"));
});

test('evaluateEquip: fails for invalid slot in unequip', () => {
    const result = evaluateEquip({cosmetics: [], equipped: {}}, 'none:invalid');
    assert.equal(result.ok, false);
    assert.ok(result.error.includes('Invalid'));
});

// ── Economy balance sanity ───────────────────────────────────────────────

test('30-day perfect streak totals are within expected ranges', () => {
    let xp = 0;
    let gold = 0;
    for (let day = 1; day <= 30; day++) {
        const r = computeReward(day, false, () => 0.5);
        xp += r.xp;
        gold += r.gold;
    }
    // 30-day streak: ~4k-5k XP, ~2k-3k gold (milestones at 7,14,21,28)
    assert.ok(xp > 3000 && xp < 7000, `XP ${xp} out of expected range`);
    assert.ok(gold > 1500 && gold < 4000, `gold ${gold} out of expected range`);
});

test('first 7-day streak: welcome + base + milestone covers a colour', () => {
    let gold = 0;
    for (let day = 1; day <= 7; day++) {
        const r = computeReward(day, day === 1, () => 0.5);
        gold += r.gold;
    }
    // Should be enough to afford at least one 500g colour.
    assert.ok(gold >= 500, `first week gold ${gold} < 500`);
});