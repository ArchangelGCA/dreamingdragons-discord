import {getPb} from "../utils/pocketbase.js";

export async function loadReactionRoleMessages(client) {
    try {
        console.log('Loading existing reaction role messages...');

        const pb = await getPb();

        // Get all reaction role configurations from PocketBase
        const records = await pb.collection('reaction_roles').getFullList();

        if (records.length === 0) {
            console.log('No reaction role messages found in database.');
            return;
        }

        console.log(`Found ${records.length} reaction role configurations.`);

        // Grouped by channel to minimize API calls
        const channelMessages = {};
        for (const record of records) {
            if (!channelMessages[record.channel_id]) {
                channelMessages[record.channel_id] = new Set();
            }
            channelMessages[record.channel_id].add(record.message_id);
        }

        // Fetch and cache messages
        for (const [channelId, messageIds] of Object.entries(channelMessages)) {
            try {
                const channel = await client.channels.fetch(channelId);
                if (!channel) {
                    console.warn(`Channel ${channelId} not found. Skipping associated reaction roles.`);
                    continue;
                }

                for (const messageId of messageIds) {
                    try {
                        await channel.messages.fetch(messageId);
                        console.log(`Cached reaction role message ${messageId} in channel ${channelId}`);
                    } catch (msgError) {
                        console.warn(`Failed to fetch message ${messageId} in channel ${channelId}: ${msgError.message}`);
                    }
                }
            } catch (channelError) {
                console.warn(`Failed to fetch channel ${channelId}: ${channelError.message}`);
            }
        }

        console.log('Reaction role messages loaded successfully.');
    } catch (error) {
        console.error('Error loading reaction role messages:', error);
    }
}