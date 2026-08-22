import test from 'node:test';
import assert from 'node:assert/strict';
import { ComponentType, MessageFlags } from 'discord.js';
import {
    BUTTON_ID_PREFIX,
    buildButtonRows,
    buildReactionRoleContainer,
    extractReactionPanelTexts,
    getEmojiIdentifier,
    parseEmojiForComponent
} from '../utils/reactionroles.js';
import { Colors } from '../utils/ui.js';

const cv2Flags = { has: (flag) => flag === MessageFlags.IsComponentsV2 };

function fakeCv2Message(containerJson) {
    return {
        flags: cv2Flags,
        components: [{ toJSON: () => containerJson }]
    };
}

test('getEmojiIdentifier validates unicode and custom emojis', () => {
    assert.equal(getEmojiIdentifier('🎮'), '🎮');
    assert.equal(getEmojiIdentifier('<:blob:123456>'), '<:blob:123456>');
    assert.equal(getEmojiIdentifier('<a:wave:987654>'), '<a:wave:987654>');
    assert.equal(getEmojiIdentifier('not-an-emoji'), null);
    assert.equal(getEmojiIdentifier(''), null);
});

test('parseEmojiForComponent parses custom token into an object', () => {
    assert.deepEqual(parseEmojiForComponent('<a:wave:42>'), { animated: true, name: 'wave', id: '42' });
    assert.deepEqual(parseEmojiForComponent('<:blob:43>'), { animated: false, name: 'blob', id: '43' });
    assert.equal(parseEmojiForComponent('🎮'), '🎮');
    assert.equal(parseEmojiForComponent(''), null);
});

test('buildButtonRows chunks buttons 5 per row and prefixes custom ids', () => {
    const records = Array.from({ length: 7 }, (_, i) => ({
        id: `rec${i}`,
        component_type: 'button',
        role_id: `role${i}`,
        button_style: 'success',
        label: `Role ${i}`,
        emoji_identifier: ''
    }));
    const rows = buildButtonRows(records);
    assert.equal(rows.length, 2);
    const first = rows[0].toJSON();
    assert.equal(first.components.length, 5);
    assert.equal(first.components[0].custom_id, `${BUTTON_ID_PREFIX}:rec0`);
    assert.equal(first.components[0].label, 'Role 0');
    assert.equal(rows[1].toJSON().components.length, 2);
});

test('buildReactionRoleContainer renders title heading, description, separator and rows', () => {
    const records = [{
        id: 'abc', component_type: 'button', role_id: 'r1',
        button_style: 'primary', label: 'Gamer', emoji_identifier: ''
    }];
    const rows = buildButtonRows(records);
    const json = buildReactionRoleContainer({
        title: 'Pick your roles',
        description: 'Click a button!',
        accentColor: 0xff0000,
        rows
    }).toJSON();

    assert.equal(json.type, ComponentType.Container);
    assert.equal(json.accent_color, 0xff0000);
    assert.equal(json.components[0].type, ComponentType.TextDisplay);
    assert.equal(json.components[0].content, '## Pick your roles');
    assert.equal(json.components[1].content, 'Click a button!');
    assert.equal(json.components[2].type, ComponentType.Separator);
    assert.equal(json.components[3].type, ComponentType.ActionRow);
});

test('buildReactionRoleContainer defaults to the brand accent and converts \\n escapes', () => {
    const json = buildReactionRoleContainer({ description: 'line1\\nline2' }).toJSON();
    assert.equal(json.accent_color, Colors.BRAND);
    assert.equal(json.components[0].content, 'line1\nline2');
});

test('buildReactionRoleContainer never produces an empty container', () => {
    const json = buildReactionRoleContainer({}).toJSON();
    assert.ok(json.components.length >= 1);
});

test('extractReactionPanelTexts returns null for legacy (non-CV2) messages', () => {
    const legacy = { flags: { has: () => false }, components: [] };
    assert.equal(extractReactionPanelTexts(legacy), null);
});

test('extractReactionPanelTexts reads title, description and accent back out', () => {
    const message = fakeCv2Message({
        type: ComponentType.Container,
        accent_color: 5793266,
        components: [
            { type: ComponentType.TextDisplay, content: '## My Title' },
            { type: ComponentType.TextDisplay, content: 'Some description' },
            { type: ComponentType.Separator },
            { type: ComponentType.ActionRow, components: [] }
        ]
    });
    assert.deepEqual(extractReactionPanelTexts(message), {
        title: 'My Title',
        description: 'Some description',
        accentColor: 5793266
    });
});

test('extractReactionPanelTexts keeps everything as description when there is no heading', () => {
    const message = fakeCv2Message({
        type: ComponentType.Container,
        accent_color: 0,
        components: [
            { type: ComponentType.TextDisplay, content: 'just text' },
            { type: ComponentType.TextDisplay, content: '## not a title, not first' }
        ]
    });
    const result = extractReactionPanelTexts(message);
    assert.equal(result.title, '');
    assert.equal(result.description, 'just text\n## not a title, not first');
});
