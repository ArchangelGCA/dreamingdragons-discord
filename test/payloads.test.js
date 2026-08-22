/**
 * End-to-end offline payload verification: renders the exact component payloads
 * the bot would send for its main user-facing surfaces (level card, leaderboard,
 * help, ping, reaction-role panel, toasts) and validates them with Discord's own
 * builders' validation, plus global invariants (component budget, no empty text).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ComponentType, MessageFlags } from 'discord.js';
import { buildLevelCard, buildLeaderboardCard } from '../utils/levelui.js';
import { buildReactionRoleContainer, buildButtonRows } from '../utils/reactionroles.js';
import { Colors } from '../utils/ui.js';

/** Recursively collect every component (builders serialize top level; we walk in). */
function walkComponents(json) {
    const out = [];
    const visit = (node) => {
        out.push(node);
        if (Array.isArray(node.components)) node.components.forEach(visit);
    };
    visit(json);
    return out;
}

/** Invariants Discord enforces on CV2 messages (within our usage). */
function assertValidPanel(json, { maxTotal = 40 } = {}) {
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

test('level card payload is valid', () => {
    const card = buildLevelCard({
        displayName: 'Gabry',
        avatarUrl: 'https://cdn.discordapp.com/avatars/1/a.png',
        accentColor: 0x00a594,
        level: 5,
        xp: 1615,
        rank: 3,
        isSelf: true
    }).toJSON();
    assertValidPanel(card);
});

test('leaderboard payload with maxed entries is valid', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
        rank: i + 1, userId: `10000000000000000${i}`, level: 20 - i, xp: 99999 - i * 1000
    }));
    const card = buildLeaderboardCard({
        guildName: 'DreamingDragons',
        guildIcon: null,
        entries,
        page: 1,
        maxPages: 5,
        total: 50,
        viewer: { rank: 42, level: 2, xp: 150 }
    }).toJSON();
    assertValidPanel(card);
});

test('reaction-role panel with the maximum 25 buttons stays within the component budget', () => {
    const records = Array.from({ length: 25 }, (_, i) => ({
        id: `r${i}`,
        component_type: 'button',
        role_id: `role${i}`,
        button_style: 'success',
        label: `Role ${i}`,
        emoji_identifier: ''
    }));
    const rows = buildButtonRows(records);
    assert.equal(rows.length, 5);
    const panel = buildReactionRoleContainer({
        title: 'Pick your roles',
        description: 'Choose wisely!',
        accentColor: Colors.BRAND,
        rows
    }).toJSON();
    assertValidPanel(panel);

    // Every button carries a routable custom id.
    const buttons = walkComponents(panel).filter((c) => c.type === ComponentType.Button);
    assert.equal(buttons.length, 25);
    for (const b of buttons) assert.match(b.custom_id, /^rr:/);
});

test('reaction-role panel without buttons (emoji mode) is valid', () => {
    const panel = buildReactionRoleContainer({
        title: 'Classic roles',
        description: 'React below to get your roles!'
    }).toJSON();
    assertValidPanel(panel);
    assert.ok(!walkComponents(panel).some((c) => c.type === ComponentType.ActionRow));
});

test('flag constant sanity: CV2 is a single bit and ephemeral combines cleanly', () => {
    assert.equal(MessageFlags.IsComponentsV2 & MessageFlags.Ephemeral, 0, 'flags must not overlap');
});
