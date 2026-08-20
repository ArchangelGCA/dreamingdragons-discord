import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} from 'discord.js';
import { parseColorHex } from './utils.js';

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
 * Build the embed for a reaction-role message from stored content.
 */
export function buildReactionRoleEmbed({ description, title, color, roleColor }) {
    const embed = new EmbedBuilder()
        .setColor(parseColorHex(color) ?? roleColor ?? 0x5865f2)
        .setDescription((description || '').replace(/\\n/g, '\n\n') || null);
    if (title) embed.setTitle(title);
    return embed;
}

/**
 * Re-render the components of a button-type reaction-role message so they match
 * the current set of records in the database.
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
    await message.edit({ components: rows });
    return records.length;
}
