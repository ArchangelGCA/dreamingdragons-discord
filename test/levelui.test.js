import test from 'node:test';
import assert from 'node:assert/strict';
import { ComponentType } from 'discord.js';
import {
    LEADERBOARD_BUTTON_PREFIX,
    buildLeaderboardCard,
    buildLevelCard,
    pageForRank,
    parseLeaderboardCustomId
} from '../utils/levelui.js';
import { Colors } from '../utils/ui.js';
import { cumulativeXpForLevel } from '../utils/levelservice.js';

function texts(json) {
    // Collect every text-display content in the container (top level + sections).
    const out = [];
    for (const child of json.components) {
        if (child.type === ComponentType.TextDisplay) out.push(child.content);
        if (child.type === ComponentType.Section) {
            for (const s of child.components) if (s.type === ComponentType.TextDisplay) out.push(s.content);
        }
    }
    return out;
}

test('buildLevelCard shows level heading, stats row and progress bar', () => {
    const level = 2;
    const xp = cumulativeXpForLevel(2) + 10;
    const json = buildLevelCard({
        displayName: 'Gabry',
        avatarUrl: 'https://cdn.discordapp.com/avatars/1/a.png',
        accentColor: 0xff00ff,
        level,
        xp,
        rank: 7,
        isSelf: true
    }).toJSON();

    assert.equal(json.type, ComponentType.Container);
    assert.equal(json.accent_color, 0xff00ff);

    const t = texts(json);
    assert.ok(t.some((c) => c.startsWith('## Level 2')));
    assert.ok(t.some((c) => c.includes('Rank **#7**')));
    assert.ok(t.some((c) => c.includes('▰') || c.includes('▱')), 'progress bar present');
    assert.ok(t.some((c) => c.includes('keep chatting')), 'self hint present');

    // Section thumbnail carries the avatar.
    const section = json.components.find((c) => c.type === ComponentType.Section);
    assert.ok(section.accessory.media.url.includes('avatars/1/a.png'));
});

test('buildLevelCard falls back to brand accent and plain text without an avatar', () => {
    const json = buildLevelCard({ displayName: 'X', level: 0, xp: 0 }).toJSON();
    assert.equal(json.accent_color, Colors.BRAND);
    // No avatar → no section component (a section requires an accessory).
    assert.ok(!json.components.some((c) => c.type === ComponentType.Section));
    assert.ok(texts(json).some((c) => c.startsWith('## Level 0')));
});

test('buildLeaderboardCard renders medals, pagination and the viewer line', () => {
    const entries = [
        { rank: 1, userId: 'u1', level: 12, xp: 9000 },
        { rank: 2, userId: 'u2', level: 8, xp: 5000 },
        { rank: 3, userId: 'u3', level: 5, xp: 2500 },
        { rank: 4, userId: 'u4', level: 4, xp: 1800 }
    ];
    const json = buildLeaderboardCard({
        guildName: 'DreamingDragons',
        guildIcon: 'https://cdn.discordapp.com/icons/1/i.png',
        entries,
        page: 2,
        maxPages: 4,
        total: 40,
        viewer: { rank: 21, level: 3, xp: 999 },
        viewerOnPage: false
    }).toJSON();

    const t = texts(json);
    assert.ok(t.some((c) => c.includes('## 🏆 DreamingDragons Leaderboard')));
    const listing = t.find((c) => c.includes('🥇'));
    assert.ok(listing.includes('<@u1>') && listing.includes('🥈') && listing.includes('🥉'));
    assert.ok(listing.includes('**4.**'));
    assert.ok(t.some((c) => c.includes('You: #21')), 'viewer footer when off-page');
    assert.ok(t.some((c) => c.includes('Page 2 / 4')), 'page summary in footer text');

    // Navigation row: [prev][me][next].
    const row = json.components.find((c) => c.type === ComponentType.ActionRow);
    const [prev, me, next] = row.components;
    assert.equal(row.components.length, 3);
    assert.equal(prev.custom_id, `${LEADERBOARD_BUTTON_PREFIX}:prev:2`);
    assert.equal(prev.disabled, false);
    assert.equal(me.custom_id, `${LEADERBOARD_BUTTON_PREFIX}:me:2`);
    assert.equal(me.disabled, false);
    assert.equal(next.custom_id, `${LEADERBOARD_BUTTON_PREFIX}:next:2`);
});

test('leaderboard "Me" button disables when the viewer is on the page or unranked', () => {
    const entries = [{ rank: 1, userId: 'u1', level: 5, xp: 2500 }];
    const onPage = buildLeaderboardCard({
        entries, page: 1, maxPages: 1, total: 1,
        viewer: { rank: 1, level: 5, xp: 2500 }, viewerOnPage: true
    }).toJSON();
    const onPageRow = onPage.components.find((c) => c.type === ComponentType.ActionRow);
    assert.equal(onPageRow.components[1].disabled, true, 'Me disabled while already on my page');
    // No redundant footer line either.
    assert.ok(!texts(onPage).some((c) => c.includes('You: #1')));

    const unranked = buildLeaderboardCard({
        entries, page: 1, maxPages: 1, total: 1, viewer: null, viewerOnPage: false
    }).toJSON();
    const unrankedRow = unranked.components.find((c) => c.type === ComponentType.ActionRow);
    assert.equal(unrankedRow.components[1].disabled, true, 'Me disabled when unranked');
});

test('leaderboard pagination disables the right buttons at the bounds', () => {
    const base = { entries: [{ rank: 1, userId: 'u', level: 1, xp: 10 }], total: 1 };
    const first = buildLeaderboardCard({ ...base, page: 1, maxPages: 3 }).toJSON();
    const firstRow = first.components.find((c) => c.type === ComponentType.ActionRow);
    assert.equal(firstRow.components[0].disabled, true, 'prev disabled on page 1');
    assert.equal(firstRow.components[2].disabled, false, 'next enabled on page 1');

    const last = buildLeaderboardCard({ ...base, page: 3, maxPages: 3 }).toJSON();
    const lastRow = last.components.find((c) => c.type === ComponentType.ActionRow);
    assert.equal(lastRow.components[0].disabled, false);
    assert.equal(lastRow.components[2].disabled, true, 'next disabled on last page');
});

test('parseLeaderboardCustomId parses prev/next/me and rejects other ids', () => {
    assert.deepEqual(parseLeaderboardCustomId(`${LEADERBOARD_BUTTON_PREFIX}:prev:3`), { kind: 'turn', direction: 'prev', page: 3 });
    assert.deepEqual(parseLeaderboardCustomId(`${LEADERBOARD_BUTTON_PREFIX}:next:10`), { kind: 'turn', direction: 'next', page: 10 });
    assert.deepEqual(parseLeaderboardCustomId(`${LEADERBOARD_BUTTON_PREFIX}:me:2`), { kind: 'me', page: 2 });
    assert.equal(parseLeaderboardCustomId(`${LEADERBOARD_BUTTON_PREFIX}:page:2`), null);
    assert.equal(parseLeaderboardCustomId('rr:abc123'), null);
    assert.equal(parseLeaderboardCustomId(`${LEADERBOARD_BUTTON_PREFIX}:prev:nope`), null);
});

test('pageForRank maps ranks to their 1-based page', () => {
    assert.equal(pageForRank(1), 1);
    assert.equal(pageForRank(10), 1);
    assert.equal(pageForRank(11), 2);
    assert.equal(pageForRank(101), 11);
    assert.equal(pageForRank(0), 1);
    assert.equal(pageForRank(-5), 1);
    assert.equal(pageForRank(1.5), 1);
});

test('buildLevelCard adds an optional "view stats online" link button', () => {
    const json = buildLevelCard({
        displayName: 'Gabry',
        avatarUrl: 'https://cdn.discordapp.com/avatars/1/a.png',
        level: 2,
        xp: 400,
        rank: 1,
        profileUrl: 'https://example.com/u/123?g=456'
    }).toJSON();
    const row = json.components.find((c) => c.type === ComponentType.ActionRow);
    assert.ok(row, 'action row present');
    assert.equal(row.components[0].style, 5, 'link button style');
    assert.equal(row.components[0].url, 'https://example.com/u/123?g=456');

    const without = buildLevelCard({ displayName: 'Gabry', level: 2, xp: 400 }).toJSON();
    assert.ok(!without.components.some((c) => c.type === ComponentType.ActionRow), 'no row without URL');
});
