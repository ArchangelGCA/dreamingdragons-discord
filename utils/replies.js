import { EmbedBuilder, MessageFlags } from 'discord.js';

/**
 * Shorthand for the ephemeral message flag, so callers don't repeat the bitfield.
 */
export const EPHEMERAL = MessageFlags.Ephemeral;

/**
 * Reply (or edit an already-deferred/replied interaction) with an ephemeral message.
 * Handles the replied/deferred state transparently.
 * @param {import('discord.js').RepliableInteraction} interaction
 * @param {string|import('discord.js').InteractionReplyOptions} payload
 */
export async function replyEphemeral(interaction, payload) {
    const options = typeof payload === 'string' ? { content: payload } : payload;

    try {
        if (interaction.deferred || interaction.replied) {
            // editReply cannot change ephemeral state, but a deferred-ephemeral reply stays ephemeral.
            return await interaction.editReply(options);
        }
        return await interaction.reply({ ...options, flags: EPHEMERAL });
    } catch (error) {
        console.error('Failed to send ephemeral reply:', error);
        return null;
    }
}

/**
 * Send a standardized error reply (❌ prefixed) as an ephemeral message.
 */
export async function replyError(interaction, message) {
    return replyEphemeral(interaction, `❌ ${message}`);
}

/**
 * Send a standardized success reply (✅ prefixed) as an ephemeral message.
 */
export async function replySuccess(interaction, message) {
    return replyEphemeral(interaction, `✅ ${message}`);
}

/**
 * Build a simple branded embed used for consistent bot messaging.
 */
export function brandEmbed({ title, description, color = 0x5865f2 } = {}) {
    const embed = new EmbedBuilder().setColor(color);
    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);
    return embed;
}
