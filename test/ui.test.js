import test from 'node:test';
import assert from 'node:assert/strict';
import { ComponentType, MessageFlags, SeparatorSpacingSize } from 'discord.js';
import { CV2, CV2_EPHEMERAL, Colors, container, formatInt, progressBar, statusCard, text } from '../utils/ui.js';

test('CV2 flags map to Discord bitfield values', () => {
    assert.equal(CV2, MessageFlags.IsComponentsV2);
    assert.equal(CV2_EPHEMERAL, MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral);
});

test('formatInt adds thousands separators', () => {
    assert.equal(formatInt(1234567), '1,234,567');
    assert.equal(formatInt(0), '0');
    assert.equal(formatInt(999), '999');
});

test('progressBar renders the requested ratio with ▰/▱ and clamps input', () => {
    assert.equal(progressBar(0, 10), '▱'.repeat(10));
    assert.equal(progressBar(1, 10), '▰'.repeat(10));
    assert.equal(progressBar(0.5, 10), '▰'.repeat(5) + '▱'.repeat(5));
    assert.equal(progressBar(2, 10), '▰'.repeat(10));   // clamped above 1
    assert.equal(progressBar(-5, 10), '▱'.repeat(10)); // clamped below 0
    assert.equal(progressBar(NaN, 4), '▱'.repeat(4));  // garbage safety
});

test('container wraps children with the brand accent color', () => {
    const c = container(Colors.BRAND, text('hello'));
    const json = c.toJSON();
    assert.equal(json.type, ComponentType.Container);
    assert.equal(json.accent_color, Colors.BRAND);
    assert.equal(json.components[0].type, ComponentType.TextDisplay);
    assert.equal(json.components[0].content, 'hello');
});

test('statusCard renders a heading with the kind glyph and tinted accent', () => {
    const ok = statusCard('success', 'All good', 'Details here').toJSON();
    assert.equal(ok.accent_color, Colors.SUCCESS);
    assert.ok(ok.components[0].content.startsWith('### ✅ All good'));
    assert.equal(ok.components[1].content, 'Details here');

    const err = statusCard('error', 'Nope').toJSON();
    assert.equal(err.accent_color, Colors.ERROR);
    assert.ok(err.components[0].content.startsWith('### ❌ Nope'));
    // No body → only the heading text display.
    assert.equal(err.components.length, 1);

    const info = statusCard('info', 'FYI').toJSON();
    assert.equal(info.accent_color, Colors.BRAND);
});

test('separator respects options', async () => {
    const { separator } = await import('../utils/ui.js');
    const json = separator().toJSON();
    assert.equal(json.type, ComponentType.Separator);
    assert.equal(json.divider, true);
    assert.equal(json.spacing, SeparatorSpacingSize.Small);
    assert.equal(separator({ divider: false }).toJSON().divider, false);
});
