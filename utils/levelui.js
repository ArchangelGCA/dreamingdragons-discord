/**
 * Components V2 layouts for the leveling system: the /level rank card and the
 * paginated /levels leaderboard. The builders are pure (no I/O) so they can be
 * unit-tested without a Discord connection; the loader functions gather the
 * data the builders need.
 */
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Colors, container, formatInt, progressBar, separator, text, thumbnailSection } from './ui.js';
import { calculateLevelFromXp, calculateXpForLevel, calculateXpToNextLevel } from './leveling.js';
import { cumulativeXpForLevel } from './levelservice.js';

/** Custom-id prefix for leaderboard pagination buttons: lb:<prev|next>:<page>. */
export const LEADERBOARD_BUTTON_PREFIX = 'lb';

export const LEADERBOARD_PAGE_SIZE = 10;

/**
 * Build the /level rank card for a member.
 * Pure: pass plain data, get back CV2 components.
 *
 * @param {object} p
 * @param {string} p.displayName
 * @param {string|null} [p.avatarUrl]
 * @param {number|null|undefined} [p.accentColor] member display color (0 falls back to brand)
 * @param {number} p.level
 * @param {number} p.xp total XP
 * @param {number} [p.rank] 1-based server rank; 0/undefined = unknown
 * @param {boolean} [p.isSelf]
 */
export function buildLevelCard({ displayName, avatarUrl, accentColor, level, xp, rank, isSelf }) {
    const xpIntoLevel = xp - cumulativeXpForLevel(level);
    const xpForThisLevel = calculateXpForLevel(level + 1);
    const xpToNext = calculateXpToNextLevel(xp);
    const ratio = xpForThisLevel > 0 ? xpIntoLevel / xpForThisLevel : 0;
    const percent = Math.floor(Math.min(1, Math.max(0, ratio)) * 100);

    const headerLines = [
        `## Level ${formatInt(level)}`,
        `**${displayName}**`
    ];
    const statBits = [];
    if (rank) statBits.push(`Rank **#${formatInt(rank)}**`);
    statBits.push(`**${formatInt(xp)}** XP`);
    headerLines.push(statBits.join('  ·  '));

    return container(
        accentColor || Colors.BRAND,
        thumbnailSection(headerLines, avatarUrl),
        separator({ divider: false }),
        text(`${progressBar(ratio)}  **${percent}%**`),
        text(`-# ${formatInt(xpToNext)} XP to Level ${formatInt(level + 1)}${isSelf ? ' — keep chatting!' : ''}`)
    );
}

const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };

/** One leaderboard line: `🥇 ⁠<@id> · Lv **12** · 3,240 XP`. */
function leaderboardLine({ rank, userId, level, xp }) {
    const medal = MEDALS[rank];
    const prefix = medal || `**${rank}.**`;
    return `${prefix}  <@${userId}>  ·  Lv **${formatInt(level)}**  ·  ${formatInt(xp)} XP`;
}

/**
 * Build the paginated leaderboard card.
 * @param {object} p
 * @param {string} p.guildName
 * @param {string|null} [p.guildIcon]
 * @param {Array<{rank:number,userId:string,level:number,xp:number}>} p.entries
 * @param {number} p.page current page (1-based)
 * @param {number} p.maxPages
 * @param {number} p.total total ranked members
 * @param {{rank:number,level:number,xp:number}|null} [p.viewer] invoker's standing when off-page
 */
export function buildLeaderboardCard({ guildName, guildIcon, entries, page, maxPages, total, viewer }) {
    const children = [
        thumbnailSection([`## 🏆 ${guildName} Leaderboard`], guildIcon ?? null),
        separator(),
        text(entries.map(leaderboardLine).join('\n'))
    ];

    if (viewer) {
        children.push(
            separator({ divider: false }),
            text(`-# You: #${formatInt(viewer.rank)}  ·  Lv ${formatInt(viewer.level)}  ·  ${formatInt(viewer.xp)} XP`)
        );
    }

    const nav = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${LEADERBOARD_BUTTON_PREFIX}:prev:${page}`)
            .setLabel('Previous')
            .setEmoji('◀️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page <= 1),
        new ButtonBuilder()
            .setCustomId(`${LEADERBOARD_BUTTON_PREFIX}:page:${page}:${maxPages}`)
            .setLabel(`Page ${page} / ${maxPages}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId(`${LEADERBOARD_BUTTON_PREFIX}:next:${page}`)
            .setLabel('Next')
            .setEmoji('▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page >= maxPages)
    );

    children.push(
        separator(),
        text(`-# ${formatInt(total)} ranked member${total === 1 ? '' : 's'}`),
        nav
    );

    return container(Colors.BRAND, ...children);
}

/** Parse a leaderboard pagination custom id: lb:<prev|next>:<page> -> target page. */
export function parseLeaderboardCustomId(customId) {
    const parts = String(customId || '').split(':');
    if (parts[0] !== LEADERBOARD_BUTTON_PREFIX) return null;
    if (parts[1] !== 'prev' && parts[1] !== 'next') return null;
    const page = Number.parseInt(parts[2], 10);
    if (!Number.isInteger(page)) return null;
    return { direction: parts[1], page };
}

/**
 * Gather everything the leaderboard card needs and render it.
 * Shared by the /levels command and the pagination button handler.
 *
 * @param {import('pocketbase').default} pb
 * @param {import('discord.js').Guild} guild
 * @param {number} page requested page (1-based, clamped)
 * @param {string} [viewerId] invoker — adds a "You: #…" line when ranked
 * @returns {Promise<{components: any[], page: number, maxPages: number, total: number}|null>}
 *   null when nobody has XP yet
 */
export async function loadLeaderboard(pb, guild, page, viewerId) {
    const filter = pb.filter('guild_id = {:guild_id}', { guild_id: guild.id });
    const firstPage = await pb.collection('user_levels').getList(1, 1, { filter });
    if (firstPage.totalItems === 0) return null;

    const total = firstPage.totalItems;
    const maxPages = Math.max(1, Math.ceil(total / LEADERBOARD_PAGE_SIZE));
    const safePage = Math.min(Math.max(1, page), maxPages);

    const levelData = await pb.collection('user_levels').getList(safePage, LEADERBOARD_PAGE_SIZE, {
        filter,
        sort: '-xp'
    });

    const entries = await Promise.all(levelData.items.map(async (user, i) => {
        const rank = (safePage - 1) * LEADERBOARD_PAGE_SIZE + i + 1;
        return {
            rank,
            userId: user.user_id,
            level: calculateLevelFromXp(user.xp),
            xp: user.xp
        };
    }));

    // Locates the viewer even when they're not on the requested page.
    let viewer = null;
    if (viewerId) {
        try {
            const onPage = entries.find((e) => e.userId === viewerId);
            if (!onPage) {
                const viewerRes = await pb.collection('user_levels').getList(1, 1, {
                    filter: pb.filter('guild_id = {:g} && user_id = {:u}', { g: guild.id, u: viewerId })
                });
                if (viewerRes.totalItems > 0) {
                    const vxp = viewerRes.items[0].xp;
                    const ahead = await pb.collection('user_levels').getList(1, 1, {
                        filter: pb.filter('guild_id = {:g} && xp > {:xp}', { g: guild.id, xp: vxp })
                    });
                    viewer = { rank: ahead.totalItems + 1, level: calculateLevelFromXp(vxp), xp: vxp };
                }
            }
        } catch (error) {
            console.error('Error resolving viewer rank for leaderboard:', error);
        }
    }

    const card = buildLeaderboardCard({
        guildName: guild.name,
        guildIcon: guild.iconURL({ size: 128 }),
        entries,
        page: safePage,
        maxPages,
        total,
        viewer
    });

    return { components: [card], page: safePage, maxPages, total };
}
