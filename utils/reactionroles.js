import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    EmbedBuilder,
    MessageFlags
} from 'discord.js';
import { parseColorHex } from './utils.js';
import { CV2, Colors, container, separator, text } from './ui.js';

/**
 * Custom-id prefix used to identify reaction-role buttons.
 * Format: rr:<pocketbaseRecordId>
 */
export const BUTTON_ID_PREFIX = 'rr';

/** Maps a stored style string to a discord.js ButtonStyle. */
const BUTTON_STYLE_MAP = {
    primary: ButtonStyle.Primary,
    secondary: ButtonStyle.Secondary,
    success: ButtonStyle.Success,
    danger: ButtonStyle.Danger
};

/** Valid style choices exposed to the slash command. */
export const BUTTON_STYLE_CHOICES = Object.keys(BUTTON_STYLE_MAP);

/**
 * Validate and normalize an emoji string into a stored identifier.
 * Returns a unicode emoji, a full custom-emoji token (<:name:id>), or null.
 */
export function getEmojiIdentifier(emojiString) {
    if (!emojiString) return null;

    const customEmojiRegex = /<a?:.+?:(\d+)>/;
    const customMatch = emojiString.match(customEmojiRegex);
    if (customMatch) {
        return customMatch[0];
    }

    const unicodeEmojiRegex = /\p{Emoji}/u;
    if (unicodeEmojiRegex.test(emojiString)) {
        return emojiString;
    }

    return null;
}

/**
 * Convert a stored emoji identifier into a value accepted by ButtonBuilder#setEmoji.
 * @returns {string|{id:string,name:string,animated:boolean}|null}
 */
export function parseEmojiForComponent(emojiIdentifier) {
    if (!emojiIdentifier) return null;

    const customMatch = emojiIdentifier.match(/<(a?):(.+?):(\d+)>/);
    if (customMatch) {
        return {
            animated: customMatch[1] === 'a',
            name: customMatch[2],
            id: customMatch[3]
        };
    }
    return emojiIdentifier;
}

/**
 * Build one or more ActionRows of buttons from button-type reaction-role records.
 * Discord allows up to 5 buttons per row and 5 rows (25 buttons total).
 * @param {Array<object>} records button-type reaction_roles records
 * @param {import('discord.js').Guild} [guild] used to resolve default labels from role names
 */
export function buildButtonRows(records, guild) {
    const rows = [];
    const buttonRecords = records.filter((r) => r.component_type === 'button').slice(0, 25);

    for (let i = 0; i < buttonRecords.length; i += 5) {
        const row = new ActionRowBuilder();
        for (const record of buttonRecords.slice(i, i + 5)) {
            const button = new ButtonBuilder()
                .setCustomId(`${BUTTON_ID_PREFIX}:${record.id}`)
                .setStyle(BUTTON_STYLE_MAP[record.button_style] || ButtonStyle.Secondary);

            const roleName = guild?.roles?.cache?.get(record.role_id)?.name;
            const label = record.label || roleName || 'Role';
            button.setLabel(label.slice(0, 80));

            const emoji = parseEmojiForComponent(record.emoji_identifier);
            if (emoji) {
                try {
                    button.setEmoji(emoji);
                } catch {
                    // Ignore invalid emoji; the label still identifies the button.
                }
            }
            row.addComponents(button);
        }
        rows.push(row);
    }

    return rows;
}

/**
 * Build the embed for a LEGACY (pre-Components-V2) reaction-role message.
 * Kept so messages posted before the CV2 upgrade can still be edited in place —
 * you cannot take the IsComponentsV2 flag off a message, but you also can't
 * force-upgrade a message an admin intentionally re-styled as an embed.
 */
export function buildReactionRoleEmbed({ description, title, color, roleColor }) {
    const embed = new EmbedBuilder()
        .setColor(parseColorHex(color) ?? roleColor ?? Colors.BRAND)
        .setDescription((description || '').replace(/\\n/g, '\n\n') || null);
    if (title) embed.setTitle(title);
    return embed;
}

/** Convert admin input to the multi-line text shown in the panel. */
export function panelDescription(description) {
    return (description || '').replace(/\\n/g, '\n');
}

/**
 * Build the Components V2 panel for a reaction-role message: a single accent
 * container holding the (optional) title heading, the description text and —
 * for button mode — the role buttons themselves, so everything sits inside the
 * same colored card.
 *
 * @param {object} p
 * @param {string} [p.title]
 * @param {string} [p.description]
 * @param {number} [p.accentColor] resolved integer color (defaults to brand)
 * @param {import('discord.js').ActionRowBuilder[]} [p.rows] button rows (button mode)
 */
export function buildReactionRoleContainer({ title, description, accentColor, rows = [] }) {
    const children = [];

    const trimmedTitle = (title || '').trim();
    if (trimmedTitle) children.push(text(`## ${trimmedTitle}`));

    const desc = panelDescription(description).trim();
    if (desc) children.push(text(desc));

    if (rows.length > 0) {
        if (children.length > 0) children.push(separator());
        children.push(...rows);
    }

    // A container always needs at least one child; if everything is empty this
    // is a text-less button panel — rows were already appended, or we fall back
    // to a minimal placeholder so the message is never invalid.
    if (children.length === 0) children.push(text('Select your roles below:'));

    return container(accentColor ?? Colors.BRAND, ...children);
}

/**
 * Read the title/description/accent color back out of a CV2 reaction-role
 * message (inverse of buildReactionRoleContainer). Returns null for legacy
 * embed-based (or non-CV2) messages.
 *
 * Texts written by buildReactionRoleContainer always put the title first as a
 * `## ` heading, so the first text display starting with "## " is the title and
 * every remaining text display is part of the description.
 *
 * @param {import('discord.js').Message} message
 * @returns {{title: string, description: string, accentColor: number|null}|null}
 */
export function extractReactionPanelTexts(message) {
    if (!message?.flags?.has?.(MessageFlags.IsComponentsV2)) return null;

    const containerJson = (message.components ?? [])
        .map((c) => (typeof c?.toJSON === 'function' ? c.toJSON() : c))
        .find((j) => j?.type === ComponentType.Container);
    if (!containerJson) return { title: '', description: '', accentColor: null };

    const texts = (containerJson.components ?? [])
        .filter((ch) => ch?.type === ComponentType.TextDisplay)
        .map((ch) => ch.content ?? '');

    let title = '';
    let body = texts;
    if (texts[0]?.startsWith('## ')) {
        title = texts[0].slice(3);
        body = texts.slice(1);
    }

    return {
        title,
        description: body.join('\n'),
        accentColor: containerJson.accent_color ?? null
    };
}

/**
 * Re-render the components of a button-type reaction-role message so they match
 * the current set of records in the database.
 *
 * CV2 messages get their container rebuilt (text preserved, rows replaced);
 * legacy embed messages have their top-level action rows swapped like before.
 *
 * @param {import('discord.js').Client} client
 * @param {import('pocketbase').default} pb
 * @param {string} guildId
 * @param {string} channelId
 * @param {string} messageId
 */
export async function refreshButtonMessage(client, pb, guildId, channelId, messageId) {
    const filter = pb.filter(
        `guild_id = {:guild_id} && message_id = {:message_id} && component_type = {:type}`,
        { guild_id: guildId, message_id: messageId, type: 'button' }
    );
    const records = await pb.collection('reaction_roles').getFullList({ filter, sort: 'created' });

    const channel = await client.channels.fetch(channelId);
    const message = await channel.messages.fetch(messageId);
    const guild = message.guild;

    const rows = buildButtonRows(records, guild);

    const panel = extractReactionPanelTexts(message);
    if (panel) {
        const next = buildReactionRoleContainer({
            title: panel.title,
            description: panel.description,
            accentColor: panel.accentColor ?? Colors.BRAND,
            rows
        });
        await message.edit({ components: [next], flags: CV2 });
    } else {
        await message.edit({ components: rows });
    }
    return records.length;
}
