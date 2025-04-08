import axios from 'axios';
import * as cheerio from 'cheerio';

// Get the latest deviation from a group page
export async function getLatestDeviation(url) {
    try {
        // If the URL is already a specific deviation page
        if (url.includes('/art/')) {
            return await scrapeDeviationPage(url);
        }

        // Otherwise get the first deviation from a gallery/group page
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const html = response.data;
        const $ = cheerio.load(html);

        // Find the first deviation link using the new structure
        const deviationLink = $('a[href*="/art/"]').first().attr('href');

        if (!deviationLink) {
            console.log('No deviations found on the page');
            return null;
        }

        // Now fetch the individual deviation page
        return await scrapeDeviationPage(deviationLink);
    } catch (error) {
        console.error('Error scraping DeviantArt:', error);
        throw error;
    }
}

// Get more informations from a specific deviation page
async function scrapeDeviationPage(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const html = response.data;
        const $ = cheerio.load(html);

        // Extract deviation ID from URL
        const deviationId = extractDeviationId(url);

        // Extract title
        const title = $('h1').first().text().trim() ||
            $('[property="og:title"]').attr('content') ||
            url.split('/art/')[1].replace(/-/g, ' ');

        // Find main image
        const imageUrl = $('img[data-hook="deviation_img"]').attr('src') ||
            $('img.dev-content-full').attr('src') ||
            $('img[property="contentUrl"]').attr('src') ||
            $('[property="og:image"]').attr('content');

        // Author information
        const authorElement = $('a[data-username]');
        const authorName = authorElement.find('span').text().trim() ||
            authorElement.attr('data-username') ||
            $('[property="og:site_name"]').attr('content')?.replace('DeviantArt', '').trim();

        const authorUrl = authorElement.attr('href') || `https://www.deviantart.com/${authorName.toLowerCase()}`;
        const authorAvatar = $('img[alt$="\'s avatar"]').attr('src') || authorElement.find('img').attr('src');

        // Description
        const description = $('div[data-hook="description"]').text().trim() ||
            $('div[class*="legacy-journal"]').text().trim();

        // Published date
        const publishedStr = $('time').attr('datetime') ||
            $('.dev-metainfo-details dd time').attr('datetime');
        const published = publishedStr ? new Date(publishedStr) : new Date();

        return {
            id: deviationId,
            url: url,
            title: title,
            imageUrl: imageUrl,
            description: description,
            published: published,
            author: {
                name: authorName,
                url: authorUrl,
                avatar: authorAvatar
            }
        };
    } catch (error) {
        console.error('Error scraping deviation page:', error);
        throw error;
    }
}

export async function getRecentDeviations(url, limit = 5, fetchFullDetails = false) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const html = response.data;
        const $ = cheerio.load(html);

        // Find all deviation links
        const deviationLinks = $('a[href*="/art/"]');
        const uniqueUrls = new Set();
        const deviations = [];

        // Collect unique deviation URLs
        for (let i = 0; i < deviationLinks.length && deviations.length < limit; i++) {

            // Debug console log
            //console.log(`Processing link ${i + 1}/${deviationLinks.length}: ${$(deviationLinks[i]).attr('href')}`);

            const link = $(deviationLinks[i]);
            const deviationUrl = link.attr('href');

            // Skip if not a valid deviation URL or already processed
            if (!deviationUrl || !deviationUrl.includes('/art/') || uniqueUrls.has(deviationUrl)) {
                continue;
            }

            uniqueUrls.add(deviationUrl);

            if (fetchFullDetails) {
                try {
                    const fullDeviation = await scrapeDeviationPage(deviationUrl);
                    deviations.push(fullDeviation);
                } catch (error) {
                    console.error(`Error scraping deviation ${deviationUrl}:`, error);
                }
            } else {
                // Quick extraction of basic info from gallery
                const deviationId = extractDeviationId(url);
                const container = link.closest('div');
                const thumbTitle = link.find('h2').text().trim() ||
                    deviationUrl.split('/art/')[1]?.replace(/-/g, ' ');
                const thumbImageUrl = container.find('img').attr('src');

                deviations.push({
                    id: deviationId,
                    url: deviationUrl,
                    title: thumbTitle,
                    thumbnailUrl: thumbImageUrl
                });
            }
        }

        return deviations;
    } catch (error) {
        console.error('Error scraping DeviantArt:', error);
        throw error;
    }
}

function extractDeviationId(url) {
    // Remove #comment
    const baseUrl = url.split('#')[0];
    // Extract id
    return baseUrl.split('-').pop() || baseUrl.split('/art/')[1];
}