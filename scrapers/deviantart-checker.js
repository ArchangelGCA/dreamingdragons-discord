import { EmbedBuilder } from 'discord.js';
import { getLatestDeviation, getRecentDeviations } from './deviantart-scraper.js';

// Map to track feed check intervals by ID
const feedCheckIntervals = new Map();

export async function startDeviantArtCheckers(client, pb) {
    try {
        console.log('Setting up DeviantArt feed checkers...');

        // Clear any existing intervals
        for (const interval of feedCheckIntervals.values()) {
            clearInterval(interval);
        }
        feedCheckIntervals.clear();

        // Get all feeds
        const records = await pb.collection('deviantart_feeds').getFullList();

        console.log(`Found ${records.length} DeviantArt feeds to monitor`);

        // Set up interval for each feed
        for (const feed of records) {
            setupFeedChecker(feed, client, pb);
        }

        console.log('DeviantArt feed checkers initialized');
    } catch (error) {
        console.error('Error setting up DeviantArt feed checkers:', error);
    }
}

function setupFeedChecker(feed, client, pb) {
    console.log(`Setting up checker for feed ${feed.id}, URL: ${feed.url}, interval: ${feed.interval}min`);

    // Run an initial check soon after startup (around 30 seconds after startup)
    setTimeout(() => checkFeed(feed, client, pb), 30000);

    // Set up the regular interval
    const intervalId = setInterval(() => checkFeed(feed, client, pb), feed.interval * 60 * 1000);
    feedCheckIntervals.set(feed.id, intervalId);
}

async function checkFeed(feed, client, pb) {
    try {
        console.log(`Checking DeviantArt feed: ${feed.id} - ${feed.url}`);

        // Fetch the latest feed data from the database
        feed = await pb.collection('deviantart_feeds').getOne(feed.id);

        // Get recent deviations
        const recentDeviations = await getRecentDeviations(feed.url, 5, true);

        if (!recentDeviations || recentDeviations.length === 0) {
            console.log(`No deviations found for feed ${feed.id}`);
            return;
        }

        // Get the set of known deviation IDs
        const knownDeviationIds = new Set(feed.known_deviations || []);
        const newDeviations = [];

        // Check each deviation to see if it's new
        for (const deviation of recentDeviations) {
            if (!knownDeviationIds.has(deviation.id)) {
                newDeviations.push(deviation);
                knownDeviationIds.add(deviation.id);
            }
        }

        // Keep the known deviations list from growing too large (keep last 100)
        const updatedKnownDeviations = [...knownDeviationIds].slice(-100);

        // Update the database with the latest known deviations
        await pb.collection('deviantart_feeds').update(feed.id, {
            known_deviations: updatedKnownDeviations,
            last_check: new Date().toISOString()
        });

        // Process new deviations
        if (newDeviations.length > 0) {
            console.log(`Found ${newDeviations.length} new deviations for feed ${feed.id}`);

            // Get the channel
            const channel = await client.channels.fetch(feed.channel_id).catch(err => {
                console.error(`Error fetching channel ${feed.channel_id}:`, err);
                return null;
            });

            if (!channel) {
                console.error(`Channel not found for DeviantArt feed ${feed.id}`);
                return;
            }

            // Post the new deviations (newest first)
            for (let i = newDeviations.length - 1; i >= 0; i--) {
                try {
                    // Get full deviation details for each new deviation
                    const fullDeviation = await getLatestDeviation(newDeviations[i].url);

                    // Experimental de-duplication of author names
                    const authorName = fullDeviation.author.name;
                    const halfLength = Math.floor(authorName.length / 2);
                    const firstHalf = authorName.substring(0, halfLength);
                    const secondHalf = authorName.substring(halfLength);
                    if (firstHalf === secondHalf) {
                        fullDeviation.author.name = firstHalf;
                    }

                    if (fullDeviation) {
                        const embed = new EmbedBuilder()
                            .setTitle(fullDeviation.title)
                            .setURL(fullDeviation.url)
                            .setAuthor({
                                name: fullDeviation.author.name,
                                url: fullDeviation.author.url,
                                iconURL: fullDeviation.author.avatar
                            })
                            .setColor(0x00b5c9)
                            .setDescription(fullDeviation.description?.substring(0, 4000) || null)
                            .setImage(fullDeviation.imageUrl)
                            .setTimestamp(fullDeviation.published)
                            .setFooter({ text: 'DeviantArt' });

                        await channel.send({ embeds: [embed] });
                    }
                } catch (postError) {
                    console.error(`Error posting deviation for feed ${feed.id}:`, postError);
                }

                // Add small delay between posts (rate limits are a thing)
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } else {
            console.log(`No new deviations for feed ${feed.id}`);
        }
    } catch (error) {
        console.error(`Error checking DeviantArt feed ${feed.id}:`, error);
    }
}

export function stopFeedChecker(feedId) {
    const interval = feedCheckIntervals.get(feedId);
    if (interval) {
        clearInterval(interval);
        feedCheckIntervals.delete(feedId);
        return true;
    }
    return false;
}

export function updateFeedChecker(feed, client, pb) {
    stopFeedChecker(feed.id);
    setupFeedChecker(feed, client, pb);
}