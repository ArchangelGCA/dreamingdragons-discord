import { SlashCommandBuilder, PermissionsBitField, ChannelType, EmbedBuilder } from 'discord.js';
import {getPb} from "../../utils/pocketbase.js";

export default {
    data: new SlashCommandBuilder()
        .setName('deviantart')
        .setDescription('Manage DeviantArt deviation feeds')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a new DeviantArt feed to monitor')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The channel to post new deviations to')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('url')
                        .setDescription('The DeviantArt URL to monitor (e.g., group gallery URL)')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('interval')
                        .setDescription('How often to check for updates (in minutes, default: 30)')
                        .setMinValue(5)
                        .setMaxValue(1440)
                        .setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all DeviantArt feeds being monitored')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('edit')
                .setDescription('Edit an existing DeviantArt feed')
                .addStringOption(option =>
                    option.setName('feed_id')
                        .setDescription('The feed to edit')
                        .setAutocomplete(true)
                        .setRequired(true))
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The new channel to post deviations to')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('url')
                        .setDescription('The new DeviantArt URL to monitor')
                        .setRequired(false))
                .addIntegerOption(option =>
                    option.setName('interval')
                        .setDescription('New update check interval (in minutes)')
                        .setMinValue(5)
                        .setMaxValue(1440)
                        .setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a DeviantArt feed')
                .addStringOption(option =>
                    option.setName('feed_id')
                        .setDescription('The feed to remove')
                        .setAutocomplete(true)
                        .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('test')
                .setDescription('Test a feed by fetching the latest deviation')
                .addStringOption(option =>
                    option.setName('feed_id')
                        .setDescription('The feed to test')
                        .setAutocomplete(true)
                        .setRequired(true))
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        const pb = await getPb();

        switch (subcommand) {
            case 'add':
                await handleAdd(interaction, pb);
                break;
            case 'list':
                await handleList(interaction, pb);
                break;
            case 'edit':
                await handleEdit(interaction, pb);
                break;
            case 'remove':
                await handleRemove(interaction, pb);
                break;
            case 'test':
                await handleTest(interaction, pb);
                break;
            default:
                await interaction.reply({ content: 'Unknown subcommand', ephemeral: true });
        }
    }
};

async function validateDeviantArtUrl(url) {
    // Basic validation for DeviantArt URLs
    try {
        const parsedUrl = new URL(url);
        return parsedUrl.hostname === 'www.deviantart.com' || parsedUrl.hostname === 'deviantart.com';
    } catch (err) {
        return false;
    }
}

async function handleAdd(interaction, pb) {
    await interaction.deferReply({ ephemeral: true });

    const channel = interaction.options.getChannel('channel');
    const url = interaction.options.getString('url');
    const interval = interaction.options.getInteger('interval') || 30; // Default: 30 minutes

    // Validate URL
    if (!await validateDeviantArtUrl(url)) {
        await interaction.editReply('Please provide a valid DeviantArt URL (e.g., https://www.deviantart.com/groups/dreamingdragons/deviations)');
        return;
    }

    // Check permissions in target channel
    const permissions = channel.permissionsFor(interaction.client.user);
    if (!permissions?.has(PermissionsBitField.Flags.SendMessages) ||
        !permissions?.has(PermissionsBitField.Flags.EmbedLinks)) {
        await interaction.editReply(`I need Send Messages and Embed Links permissions in ${channel}`);
        return;
    }

    // Check for existing feed with the same URL
    const existingFilter = pb.filter(`guild_id = {:guild_id} && url = {:url}`,
        { guild_id: interaction.guildId, url: url });
    const existing = await pb.collection('deviantart_feeds').getList(1, 1, { filter: existingFilter });

    if (existing.totalItems > 0) {
        await interaction.editReply(`A feed for this URL already exists (posted to <#${existing.items[0].channel_id}>)`);
        return;
    }

    try {
        // Create the new feed
        const data = {
            guild_id: interaction.guildId,
            channel_id: channel.id,
            url: url,
            interval: interval,
            last_check: new Date().toISOString(),
            known_deviations: [] // Empty array to start
        };

        await pb.collection('deviantart_feeds').create(data);

        await interaction.editReply(`✅ DeviantArt feed added!\n**URL**: ${url}\n**Channel**: ${channel}\n**Check interval**: ${interval} minutes`);
    } catch (error) {
        console.error('Error adding DeviantArt feed:', error);
        await interaction.editReply('❌ Failed to add the DeviantArt feed. Check the console for details.');
    }
}

async function handleList(interaction, pb) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const filter = pb.filter(`guild_id = {:guild_id}`, { guild_id: interaction.guildId });
        const records = await pb.collection('deviantart_feeds').getList(1, 50, { filter });

        if (records.totalItems === 0) {
            await interaction.editReply('No DeviantArt feeds are currently set up in this server.');
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('DeviantArt Feeds')
            .setColor(0x00b5c9)
            .setDescription(`This server has ${records.totalItems} DeviantArt ${records.totalItems === 1 ? 'feed' : 'feeds'} configured.`);

        records.items.forEach((feed, index) => {
            embed.addFields({
                name: `Feed #${index + 1} (ID: ${feed.id})`,
                value: `**Channel:** <#${feed.channel_id}>\n**URL:** ${feed.url}\n**Interval:** ${feed.interval} minutes\n**Last Check:** ${new Date(feed.last_check).toLocaleString()}`
            });
        });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error listing DeviantArt feeds:', error);
        await interaction.editReply('❌ Failed to list DeviantArt feeds. Check the console for details.');
    }
}

async function handleEdit(interaction, pb) {
    await interaction.deferReply({ ephemeral: true });

    const feedId = interaction.options.getString('feed_id');
    const newChannel = interaction.options.getChannel('channel');
    const newUrl = interaction.options.getString('url');
    const newInterval = interaction.options.getInteger('interval');

    // Check if any updates were provided
    if (!newChannel && !newUrl && !newInterval) {
        await interaction.editReply('Please provide at least one value to update.');
        return;
    }

    try {
        // Check if feed exists
        try {
            await pb.collection('deviantart_feeds').getOne(feedId);
        } catch (err) {
            await interaction.editReply(`Feed with ID ${feedId} not found.`);
            return;
        }

        // Validate URL if provided
        if (newUrl && !await validateDeviantArtUrl(newUrl)) {
            await interaction.editReply('Please provide a valid DeviantArt URL.');
            return;
        }

        // Check channel permissions if changing channel
        if (newChannel) {
            const permissions = newChannel.permissionsFor(interaction.client.user);
            if (!permissions?.has(PermissionsBitField.Flags.SendMessages) ||
                !permissions?.has(PermissionsBitField.Flags.EmbedLinks)) {
                await interaction.editReply(`I need Send Messages and Embed Links permissions in ${newChannel}`);
                return;
            }
        }

        // Prepare update data
        const data = {};
        if (newChannel) data.channel_id = newChannel.id;
        if (newUrl) data.url = newUrl;
        if (newInterval) data.interval = newInterval;

        // Update the feed
        await pb.collection('deviantart_feeds').update(feedId, data);

        // Build response message
        let responseMsg = '✅ DeviantArt feed updated:';
        if (newChannel) responseMsg += `\n• Channel: <#${newChannel.id}>`;
        if (newUrl) responseMsg += `\n• URL: ${newUrl}`;
        if (newInterval) responseMsg += `\n• Check interval: ${newInterval} minutes`;

        await interaction.editReply(responseMsg);
    } catch (error) {
        console.error('Error editing DeviantArt feed:', error);
        await interaction.editReply('❌ Failed to edit the DeviantArt feed. Check the console for details.');
    }
}

async function handleRemove(interaction, pb) {
    await interaction.deferReply({ ephemeral: true });

    const feedId = interaction.options.getString('feed_id');

    try {
        // Check if feed exists
        try {
            await pb.collection('deviantart_feeds').getOne(feedId);
        } catch (err) {
            await interaction.editReply(`Feed with ID ${feedId} not found.`);
            return;
        }

        // Remove the feed
        await pb.collection('deviantart_feeds').delete(feedId);

        await interaction.editReply(`✅ DeviantArt feed removed successfully.`);
    } catch (error) {
        console.error('Error removing DeviantArt feed:', error);
        await interaction.editReply('❌ Failed to remove the DeviantArt feed. Check the console for details.');
    }
}

async function handleTest(interaction, pb) {
    await interaction.deferReply({ ephemeral: true });

    const feedId = interaction.options.getString('feed_id');

    try {
        // Check if feed exists
        let feed;
        try {
            feed = await pb.collection('deviantart_feeds').getOne(feedId);
        } catch (err) {
            await interaction.editReply(`Feed with ID ${feedId} not found.`);
            return;
        }

        await interaction.editReply('🔄 Testing feed... Fetching latest deviation. This may take a moment.');

        // Import and use the scraping function - this will be defined in the scraper module
        const { getLatestDeviation } = await import('../../scrapers/deviantart-scraper.js');

        try {
            const latestDeviation = await getLatestDeviation(feed.url);

            if (!latestDeviation) {
                await interaction.editReply('❌ No deviations found at the specified URL. Please verify the URL is correct.');
                return;
            }

            const embed = createDeviationEmbed(latestDeviation);

            await interaction.editReply({
                content: `✅ Successfully fetched the latest deviation from ${feed.url}. Here's what will be posted to <#${feed.channel_id}>:`,
                embeds: [embed]
            });
        } catch (scrapingError) {
            console.error('Error scraping DeviantArt:', scrapingError);
            await interaction.editReply('❌ Failed to scrape the DeviantArt page. Check the console for details.');
        }
    } catch (error) {
        console.error('Error testing DeviantArt feed:', error);
        await interaction.editReply('❌ An unexpected error occurred. Check the console for details.');
    }
}

// Helper function to create embeds for deviations
function createDeviationEmbed(deviation) {
    return new EmbedBuilder()
        .setTitle(deviation.title)
        .setURL(deviation.url)
        .setAuthor({
            name: deviation.author.name,
            url: deviation.author.url,
            iconURL: deviation.author.avatar
        })
        .setColor(0x00b5c9)
        .setDescription(deviation.description?.substring(0, 4000) || '')
        .setImage(deviation.imageUrl)
        .setTimestamp(deviation.published)
        .setFooter({ text: 'DeviantArt' });
}