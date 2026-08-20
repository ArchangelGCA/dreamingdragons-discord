import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show the list of available commands.'),

    async execute(interaction) {
        const commands = [...interaction.client.commands.values()];

        const lines = commands
            .map(cmd => {
                const data = cmd.data;
                const subs = (data.options || [])
                    .filter(o => typeof o.toJSON === 'function' ? o.toJSON().type === 1 : o.type === 1);
                if (subs.length > 0) {
                    const subList = subs
                        .map(s => (typeof s.toJSON === 'function' ? s.toJSON() : s))
                        .map(s => `\`/${data.name} ${s.name}\` — ${s.description}`)
                        .join('\n');
                    return `**/${data.name}** — ${data.description}\n${subList}`;
                }
                return `**/${data.name}** — ${data.description}`;
            })
            .sort();

        const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('📖 Command Help')
            .setDescription(lines.join('\n\n') || 'No commands are currently registered.')
            .setFooter({ text: `${commands.length} command(s) available` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
};
