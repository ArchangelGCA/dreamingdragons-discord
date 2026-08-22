import test from 'node:test';
import assert from 'node:assert/strict';
import { ComponentType } from 'discord.js';
import {
    LEADERBOARD_BUTTON_PREFIX,
    buildLeaderboardCard,
    buildLevelCard,
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
        viewer: { rank: 21, level: 3, xp: 999 }
    }).toJSON();

    const t = texts(json);
    assert.ok(t.some((c) => c.includes('## 🏆 DreamingDragons Leaderboard')));
    const listing = t.find((c) => c.includes('🥇'));
    assert.ok(listing.includes('<@u1>') && listing.includes('🥈') && listing.includes('🥉'));
    assert.ok(listing.includes('**4.**'));
    assert.ok(t.some((c) => c.includes('You: #21')), 'viewer footer');

    // Navigation row: prev enabled (page 2), next enabled (2 < 4).
    const row = json.components.find((c) => c.type === ComponentType.ActionRow);
    const [prev, pageBtn, next] = row.components;
    assert.equal(prev.custom_id, `${LEADERBOARD_BUTTON_PREFIX}:prev:2`);
    assert.equal(prev.disabled, false);
    assert.equal(pageBtn.disabled, true);
    assert.match(pageBtn.label, /Page 2 \/ 4/);
    assert.equal(next.custom_id, `${LEADERBOARD_BUTTON_PREFIX}:next:2`);
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

test('parseLeaderboardCustomId parses prev/next and rejects other ids', () => {
    assert.deepEqual(parseLeaderboardCustomId(`${LEADERBOARD_BUTTON_PREFIX}:prev:3`), { direction: 'prev', page: 3 });
    assert.deepEqual(parseLeaderboardCustomId(`${LEADERBOARD_BUTTON_PREFIX}:next:10`), { direction: 'next', page: 10 });
    assert.equal(parseLeaderboardCustomId(`${LEADERBOARD_BUTTON_PREFIX}:page:2:4`), null);
    assert.equal(parseLeaderboardCustomId('rr:abc123'), null);
    assert.equal(parseLeaderboardCustomId(`${LEADERBOARD_BUTTON_PREFIX}:prev:nope`), null);
});
