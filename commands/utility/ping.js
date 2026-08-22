import { SlashCommandBuilder } from 'discord.js';
import { Colors, container, separator, text } from '../../utils/ui.js';
import { replyComponents } from '../../utils/replies.js';

/** Friendly latency rating shown under the stats. */
function latencyVerdict(ms) {
    if (ms < 150) return '🟢 Excellent';
    if (ms < 350) return '🟡 Good';
    return '🔴 A bit slow — hold tight';
}

function buildPingCard({ roundtrip, heartbeat }) {
    const effective = Number.isFinite(heartbeat) ? heartbeat : roundtrip;
    const accent = effective < 150 ? Colors.SUCCESS : effective < 350 ? Colors.BRAND : Colors.GOLD;

    const stats = [
        `**Roundtrip** — ${roundtrip} ms`,
        Number.isFinite(heartbeat) ? `**Heartbeat** — ${heartbeat} ms` : '**Heartbeat** — warming up…'
    ].join('\n');

    return container(
        accent,
        text('## 🏓 Pong!'),
        separator({ divider: false }),
        text(stats),
        text(`-# ${latencyVerdict(effective)}`)
    );
}

export default {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription("Check the bot's responsiveness and latency."),

    async execute(interaction) {
        const card = buildPingCard({
            roundtrip: Date.now() - interaction.createdTimestamp,
            heartbeat: Math.round(interaction.client.ws.ping)
        });

        await replyComponents(interaction, [card], { ephemeral: false });
    },
};
