/**
 * Shared UI kit for the bot's Discord messages.
 *
 * Built on Discord's Components V2 (layouts made of containers, sections, text
 * displays and separators instead of classic embeds). Every public bot surface
 * (rank cards, leaderboards, help, pings, reaction-role panels, notifications)
 * goes through here so the whole bot shares one look: the DreamingDragons
 * teal/cyan identity, matching the admin dashboard.
 */
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    MessageFlags,
    SectionBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    TextDisplayBuilder,
    ThumbnailBuilder
} from 'discord.js';

/** Message flag enabling the component-based (V2) layout. */
export const CV2 = MessageFlags.IsComponentsV2;

/** Combined flags for ephemeral replies that use the V2 layout. */
export const CV2_EPHEMERAL = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;

/**
 * Brand accents, aligned with the dashboard palette (see web/src/app.css).
 * Numbers are used directly as container accent colors.
 */
export const Colors = {
    /** DreamingDragons teal — the bot's identity color. */
    BRAND: 0x00A594,
    /** Bright cyan, for secondary highlights. */
    CYAN: 0x20DDE0,
    /** Success / confirmations / role granted. */
    SUCCESS: 0x22C55E,
    /** Errors and destructive confirmations. */
    ERROR: 0xEF4444,
    /** Warnings / neutral emphasis / role removed. */
    GOLD: 0xF5A623
};

/** Formats a number with thousands separators (e.g. 12,340). */
export function formatInt(value) {
    return Math.round(Number(value) || 0).toLocaleString('en-US');
}

/**
 * Builds a unicode progress bar like ▰▰▰▰▱▱▱▱▱▱ for progress within [0, 1].
 * @param {number} ratio 0..1 (clamped)
 * @param {number} [size] number of segments
 */
export function progressBar(ratio, size = 12) {
    const clamped = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0));
    const filled = Math.round(clamped * size);
    return '▰'.repeat(filled) + '▱'.repeat(size - filled);
}

/** Shorthand for a markdown TextDisplay component. */
export function text(content) {
    return new TextDisplayBuilder().setContent(content);
}

/** Shorthand for a separator (divider visible by default, small spacing). */
export function separator({ divider = true, spacing = SeparatorSpacingSize.Small } = {}) {
    return new SeparatorBuilder().setDivider(divider).setSpacing(spacing);
}

/**
 * A section with a round thumbnail accessory on the right (user/guild avatar).
 * Without a thumbnail URL it degrades to plain text lines (a Discord section
 * always requires an accessory, and silently producing an invalid one throws
 * at send time).
 * @param {string[]} lines markdown lines stacked inside the section
 * @param {string|null} [thumbnailUrl] image shown on the right; omit for plain text
 */
export function thumbnailSection(lines, thumbnailUrl) {
    if (!thumbnailUrl) {
        return text(lines.join('\n'));
    }
    const section = new SectionBuilder();
    for (const line of lines) section.addTextDisplayComponents(text(line));
    section.setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnailUrl));
    return section;
}

/**
 * Wrap components in a container with the given accent color bar.
 * Accepts TextDisplay/Section/Separator/ActionRow builders (or arrays of them).
 * @param {number} accentColor
 * @param {...any} children
 */
export function container(accentColor, ...children) {
    const c = new ContainerBuilder().setAccentColor(accentColor);
    for (const child of children.flat().filter(Boolean)) {
        if (child instanceof TextDisplayBuilder) c.addTextDisplayComponents(child);
        else if (child instanceof SectionBuilder) c.addSectionComponents(child);
        else if (child instanceof SeparatorBuilder) c.addSeparatorComponents(child);
        else if (child instanceof ActionRowBuilder) c.addActionRowComponents(child);
        else throw new Error(`Unsupported container child: ${child?.constructor?.name}`);
    }
    return c;
}

/** A standard "card" reply: heading line + optional body, accent by kind. */
export function statusCard(kind, title, body) {
    const color = { success: Colors.SUCCESS, error: Colors.ERROR, info: Colors.BRAND }[kind] ?? Colors.BRAND;
    const glyph = { success: '✅', error: '❌', info: 'ℹ️' }[kind] ?? 'ℹ️';
    const children = [text(`### ${glyph} ${title}`)];
    if (body && String(body).trim().length > 0) {
        children.push(text(String(body)));
    }
    return container(color, ...children);
}
