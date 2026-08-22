import { SlashCommandBuilder } from 'discord.js';
import { Colors, container, separator, text, thumbnailSection } from '../../utils/ui.js';
import { replyComponents } from '../../utils/replies.js';

/** Display order + styling for command categories (the folder names in /commands). */
const CATEGORY_META = {
    utility: { label: 'Utility', emoji: '⚙️' },
    fun: { label: 'Fun', emoji: '🎉' },
    admin: { label: 'Admin', emoji: '🛡️' }
};

/** Subcommand option type in the Discord API (SlashCommandSubcommand). */
const SUBCOMMAND_TYPE = 1;

function optionJson(option) {
    return typeof option.toJSON === 'function' ? option.toJSON() : option;
}

/** Render one command (+ its subcommands) as markdown lines. */
function renderCommand(cmd) {
    const data = cmd.data;
    const subs = (data.options || [])
        .map(optionJson)
        .filter((o) => o.type === SUBCOMMAND_TYPE);

    const lines = [`**/${data.name}** — ${data.description}`];
    for (const sub of subs) {
        lines.push(`↳ \`/${data.name} ${sub.name}\` — ${sub.description}`);
    }
    return lines;
}

function metaFor(category) {
    return CATEGORY_META[category] ?? { label: category.charAt(0).toUpperCase() + category.slice(1), emoji: '▫️' };
}

export default {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show the list of available commands.'),

    async execute(interaction) {
        const commands = [...interaction.client.commands.values()];

        // Group commands by their category (assigned from the folder name at load).
        const groups = new Map();
        for (const cmd of commands) {
            const category = cmd.category || 'utility';
            if (!groups.has(category)) groups.set(category, []);
            groups.get(category).push(cmd);
        }

        // Known categories first (in CATEGORY_META order), then any extras.
        const ordered = [...groups.keys()].sort((a, b) => {
            const orderOf = (c) => Object.keys(CATEGORY_META).indexOf(c);
            const [ia, ib] = [orderOf(a), orderOf(b)];
            if (ia === -1 && ib === -1) return a.localeCompare(b);
            if (ia === -1) return 1;
            if (ib === -1) return -1;
            return ia - ib;
        });

        const botName = interaction.client.user.username;
        const children = [
            thumbnailSection([
                `## 📖 ${botName} — Commands`,
                "Here's everything I can do for you."
            ], interaction.client.user.displayAvatarURL({ size: 128 })),
            separator()
        ];

        let subCount = 0;
        for (const category of ordered) {
            const { label, emoji } = metaFor(category);
            const cmds = groups.get(category).sort((a, b) => a.data.name.localeCompare(b.data.name));
            const lines = [];
            for (const cmd of cmds) {
                const rendered = renderCommand(cmd);
                subCount += rendered.length - 1;
                lines.push(...rendered);
            }
            children.push(text(`### ${emoji} ${label}`));
            children.push(text(lines.join('\n')));
        }

        children.push(
            separator(),
            text(`-# ${commands.length} commands · ${subCount} subcommands — admins can also manage me from the dashboard`)
        );

        // Ephemeral: only the requester sees this.
        await replyComponents(interaction, [container(Colors.BRAND, ...children)]);
    }
};
