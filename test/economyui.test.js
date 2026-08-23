import test from 'node:test';
import assert from 'node:assert/strict';
import {ComponentType} from 'discord.js';
import {buildDailyCard, buildBalanceCard, buildShopCard, buildInventoryCard} from '../utils/economyui.js';
import {COSMETICS, SLOTS, itemsBySlot} from '../utils/economy.js';

function walkComponents(json) {
    const out = [];
    const visit = (node) => {
        out.push(node);
        if (Array.isArray(node.components)) node.components.forEach(visit);
    };
    visit(json);
    return out;
}

function assertValidPanel(json, {maxTotal = 40} = {}) {
    assert.equal(json.type, ComponentType.Container, 'top-level must be a container');
    const all = walkComponents(json);
    assert.ok(all.length <= maxTotal, `component budget exceeded: ${all.length}`);
    for (const c of all) {
        if (c.type === ComponentType.TextDisplay) {
            assert.ok(typeof c.content === 'string' && c.content.trim().length > 0, 'empty text display');
            assert.ok(c.content.length <= 4000, 'text display too long');
        }
        if (c.type === ComponentType.ActionRow) {
            assert.ok(c.components.length >= 1 && c.components.length <= 5, 'action row arity');
        }
    }
}

test('buildDailyCard already-claimed payload is valid', () => {
    const card = buildDailyCard({
        already: true,
        secondsUntilMidnight: 36000,
        avatarUrl: null
    }).toJSON();
    assertValidPanel(card);
    const t = JSON.stringify(card);
    assert.ok(t.includes('Already claimed'), 'already-claimed text present');
});

test('buildDailyCard success payload is valid (first claim, welcome, no milestone)', () => {
    const card = buildDailyCard({
        already: false,
        reward: {xp: 100, gold: 200, milestoneGold: 0, jackpot: false, welcomeGold: 150, multiplier: 1},
        newStreak: 1,
        oldStreak: 0,
        bestStreak: 1,
        totalClaims: 1,
        newGold: 200,
        rescued: false,
        brokenFrom: null,
        leveledUp: false,
        secondsUntilMidnight: 36000,
        avatarUrl: null
    }).toJSON();
    assertValidPanel(card);
    const t = JSON.stringify(card);
    assert.ok(t.includes('Daily reward claimed'), 'heading');
    assert.ok(t.includes('welcome gift'), 'welcome bonus');
});

test('buildDailyCard success with milestone and jackpot', () => {
    const card = buildDailyCard({
        already: false,
        reward: {xp: 160, gold: 280, milestoneGold: 100, jackpot: true, welcomeGold: 0, multiplier: 1.6},
        newStreak: 7,
        oldStreak: 6,
        bestStreak: 7,
        totalClaims: 7,
        newGold: 780,
        rescued: false,
        brokenFrom: null,
        leveledUp: true,
        newLevel: 3,
        secondsUntilMidnight: 10000,
        avatarUrl: 'https://cdn.discordapp.com/avatars/1/a.png'
    }).toJSON();
    assertValidPanel(card);
    const t = JSON.stringify(card);
    assert.ok(t.includes('milestone'), 'milestone text');
    assert.ok(t.includes('JACKPOT'), 'jackpot text');
    assert.ok(t.includes('Level up'), 'level-up text');
});

test('buildDailyCard broken streak card', () => {
    const card = buildDailyCard({
        already: false,
        reward: {xp: 100, gold: 50, milestoneGold: 0, jackpot: false, welcomeGold: 0, multiplier: 1},
        newStreak: 1,
        oldStreak: 0,
        bestStreak: 15,
        totalClaims: 16,
        newGold: 50,
        rescued: false,
        brokenFrom: 15,
        leveledUp: false,
        secondsUntilMidnight: 36000,
        avatarUrl: null
    }).toJSON();
    assertValidPanel(card);
    const t = JSON.stringify(card);
    assert.ok(t.includes('streak broke'), 'broken streak text');
});

test('buildBalanceCard payload is valid', () => {
    const card = buildBalanceCard({
        displayName: 'Gabry',
        avatarUrl: 'https://cdn.discordapp.com/avatars/1/a.png',
        accentColor: null,
        gold: 2350,
        streak: 5,
        bestStreak: 9,
        claims: 12,
        equipped: {color: {emoji: '🟥', name: 'Crimson'}, flair: {emoji: '🔥', name: 'Fire'}}
    }).toJSON();
    assertValidPanel(card);
    const t = JSON.stringify(card);
    assert.ok(t.includes('Gold Balance'));
    assert.ok(t.includes('2,350'));
    assert.ok(t.includes('Crimson'));
});

test('buildShopCard payload is valid', () => {
    const groups = itemsBySlot();
    const groupsArr = SLOTS.map((slot) => ({slot, items: groups[slot]}));
    const card = buildShopCard({
        balance: 1500,
        owned: new Set(['color-crimson', 'flair-dragon']),
        groups: groupsArr
    }).toJSON();
    assertValidPanel(card);
    const t = JSON.stringify(card);
    assert.ok(t.includes('DreamingDragons Shop'));
    assert.ok(t.includes('1,500'));
});

test('buildInventoryCard payload is valid', () => {
    const card = buildInventoryCard({
        balance: 1200,
        equipped: {color: {id: 'color-crimson', emoji: '🟥', name: 'Crimson', slot: 'color'}},
        ownedItems: [
            {id: 'color-crimson', emoji: '🟥', name: 'Crimson', slot: 'color'},
            {id: 'flair-dragon', emoji: '🐉', name: 'Dragon', slot: 'flair'}
        ]
    }).toJSON();
    assertValidPanel(card);
    const t = JSON.stringify(card);
    assert.ok(t.includes('Inventory'));
    assert.ok(t.includes('Equipped'));
    assert.ok(t.includes('Owned'));
});