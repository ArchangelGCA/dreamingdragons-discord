import { MessageFlags } from 'discord.js';
import { CV2, CV2_EPHEMERAL, Colors, container, statusCard, text } from './ui.js';

/**
 * Shorthand for the ephemeral message flag, so callers don't repeat the bitfield.
 */
export const EPHEMERAL = MessageFlags.Ephemeral;

/**
 * Reply (or edit an already-deferred/replied interaction) with CV2 components.
 * Handles the replied/deferred state transparently: an edit can only flip the
 * IsComponentsV2 flag, so ephemeral-ness is inherited from the original defer.
 * @param {import('discord.js').RepliableInteraction} interaction
 * @param {Array<import('discord.js').ContainerBuilder>} components
 * @param {{ephemeral?: boolean}} [options]
 */
export async function replyComponents(interaction, components, { ephemeral = true } = {}) {
    try {
        if (interaction.deferred || interaction.replied) {
            return await interaction.editReply({ components, flags: CV2 });
        }
        return await interaction.reply({ components, flags: ephemeral ? CV2_EPHEMERAL : CV2 });
    } catch (error) {
        console.error('Failed to send component reply:', error);
        return null;
    }
}

/**
 * Reply with an ephemeral message. String payloads are rendered inside a
 * branded container so even plain informational replies match the bot's look.
 * @param {import('discord.js').RepliableInteraction} interaction
 * @param {string|import('discord.js').InteractionReplyOptions} payload
 */
export async function replyEphemeral(interaction, payload) {
    if (typeof payload === 'string') {
        return replyComponents(interaction, [container(Colors.BRAND, text(payload))]);
    }
    // Object payloads (embeds/content/components) are sent as provided.
    try {
        if (interaction.deferred || interaction.replied) {
            return await interaction.editReply(payload);
        }
        return await interaction.reply({ ...payload, flags: EPHEMERAL });
    } catch (error) {
        console.error('Failed to send ephemeral reply:', error);
        return null;
    }
}

/**
 * Send a standardized error reply as an ephemeral status card.
 */
export async function replyError(interaction, message) {
    return replyComponents(interaction, [statusCard('error', message)]);
}

/**
 * Send a standardized success reply as an ephemeral status card.
 */
export async function replySuccess(interaction, message) {
    return replyComponents(interaction, [statusCard('success', message)]);
}

/**
 * Send a standardized informational reply as an ephemeral status card.
 */
export async function replyInfo(interaction, message) {
    return replyComponents(interaction, [statusCard('info', message)]);
}
