/**
 * Components V2 layouts for the economy system: the /daily claim card, the
 * /balance wallet card, the /shop catalog and the /inventory card. Like
 * levelui.js these builders are PURE (no I/O) so they can be unit-tested
 * without a Discord connection — commands gather the data, builders render it.
 *
 * Polished to feel rewarding: reward breakdowns, streak progress, affordability
 * hints, rarity tags, and celebratory copy.
 */
import {Colors, container, formatInt, progressBar, separator, text, thumbnailSection} from './ui.js';
import {COSMETICS, MILESTONE_EVERY, nextMilestoneInfo, slotEmoji, slotLabel} from './economy.js';

/** Human "Xh Ym" from a seconds countdown. */
export function humanDuration(totalSeconds) {
    const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h === 0 && m === 0) return 'less than a minute';
    return [h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ');
}

/** Unix-seconds timestamp for a moment `totalSeconds` ahead of `now`. */
export function laterUnix(now = new Date(), totalSeconds) {
    return Math.floor(now.getTime() / 1000) + Math.max(0, Math.floor(Number(totalSeconds) || 0));
}

/**
 * Safely map a loaded/claimed status into a footer line hint.
 * Pure: just picks the right markdown.
 * @param {{already?:boolean}} result claim result from claimDailyReward
 * @param {object} counters {streak, best, claims}
 */
function streakLine({streak, best, claims}) {
    const bits = [`🔥 Streak: **${formatInt(streak)} day${streak === 1 ? '' : 's'}**`];
    if (best > streak) bits.push(`best: ${formatInt(best)}`);
    bits.push(`· claims: ${formatInt(claims)}`);
    return bits.join('  ');
}

/** Progress bar toward the next 7-day milestone. */
function milestoneProgress(streak) {
    const into = streak % MILESTONE_EVERY;
    const info = nextMilestoneInfo(streak);
    if (!info) return '';
    const pct = into / MILESTONE_EVERY;
    return `\`${progressBar(pct, 14)}\`  **${info.inDays}** day${info.inDays === 1 ? '' : 's'} to milestone **${info.next}**  ·  +${formatInt(info.next / MILESTONE_EVERY * 120)}🪙 bonus`;
}

function rarityTag(price) {
    if (price >= 2500) return '💎 Legendary';
    if (price >= 1500) return '🟣 Epic';
    if (price >= 800) return '🔵 Rare';
    if (price >= 400) return '🟢 Uncommon';
    return '⚪ Common';
}

/**
 * Build the /daily claim card.
 * @param {object} p
 * @param {boolean} p.already claimed today already?
 * @param {number} p.secondsUntilMidnight when the next claim becomes available
 * @param {string|null} [p.avatarUrl]
 * @param {object} [p.reward] {xp, gold, milestoneGold, jackpot, welcomeGold, multiplier}
 * @param {number} [p.newStreak]
 * @param {number} [p.oldStreak]
 * @param {number} [p.bestStreak]
 * @param {number} [p.totalClaims]
 * @param {number} [p.newGold]
 * @param {boolean} [p.rescued]
 * @param {number|null} [p.brokenFrom]
 * @param {boolean} [p.leveledUp]
 * @param {number} [p.newLevel]
 */
export function buildDailyCard(p) {
    const accent = p.already ? Colors.GOLD : Colors.SUCCESS;

    if (p.already) {
        const at = laterUnix(new Date(), p.secondsUntilMidnight);
        const streak = p.streak ?? p.newStreak ?? 0;
        const nextInfo = streak ? nextMilestoneInfo(streak) : null;
        return container(
            accent,
            thumbnailSection([
                `### 🎁 Daily reward`,
                `**Already claimed today!**`
            ], p.avatarUrl ?? null),
            separator(),
            text(`Come back in **${humanDuration(p.secondsUntilMidnight)}** — <t:${at}:R>`),
            ...(nextInfo ? [separator({divider:false}), text(`⏳ Next milestone **${nextInfo.next}** in **${nextInfo.inDays}** day${nextInfo.inDays===1?'':'s'}`)] : []),
            separator({divider:false}),
            text(`-# Keep that streak alive — 3-day grace saves you if you miss a day!`)
        );
    }

    const {reward} = p;
    const baseGold = Math.round(reward.gold - (reward.milestoneGold||0) - (reward.welcomeGold||0) * (reward.jackpot? 1/2 : 1));
    // Breakdown: streak bonus portion
    const streakBonusGold = reward.gold - (reward.milestoneGold||0) - (reward.welcomeGold||0) - Math.round(55 * 1); // rough; simpler display via multiplier
    const children = [
        thumbnailSection([
            `### 🎁 Daily reward claimed!`,
            `**+${formatInt(reward.xp)} XP**  ·  **+${formatInt(reward.gold)} 🪙**` + (reward.multiplier > 1 ? `  ·  **×${reward.multiplier.toFixed(2)}** streak` : '')
        ], p.avatarUrl ?? null),
        separator()
    ];

    // Reward breakdown
    const breakdown = [];
    if (reward.multiplier > 1) breakdown.push(`⚡ Streak **×${reward.multiplier.toFixed(2)}** bonus applied`);
    if (reward.welcomeGold > 0) breakdown.push(`🎉 **+${formatInt(reward.welcomeGold)} 🪙 welcome gift** — your first ever claim! Instant flair unlocked!`);
    if (reward.milestoneGold > 0) breakdown.push(`🏆 **${formatInt(p.newStreak)}-day milestone!** +${formatInt(reward.milestoneGold)} 🪙 bonus`);
    if (reward.jackpot) breakdown.push(`💥 **JACKPOT!** Gold doubled — lucky day!`);
    if (breakdown.length) children.push(text(breakdown.join('\n')));

    if (p.rescued) {
        children.push(text(`🚨 You came back just in time — your **${formatInt(p.newStreak)}**-day streak lives on! (grace saved you)`));
    }
    if (p.brokenFrom) {
        children.push(text(`😢 Your **${formatInt(p.brokenFrom)}**-day streak broke — claiming restarts it at **1** day. Build it again!`));
    }
    if (p.leveledUp) {
        children.push(text(`## 🎉 Level up! You reached **level ${formatInt(p.newLevel)}**`));
    }

    // Encouraging next-step hint based on gold balance
    let affordHint = '';
    if (p.newGold != null) {
        if (p.newGold >= 300 && p.newGold < 500) affordHint = `💡 You can afford a **flair** or **badge** now — check \`/shop\`!`;
        else if (p.newGold >= 500 && p.newGold < 1200) affordHint = `💡 You can grab a **colour** or **banner** — \`/shop\` → \`/buy\` → \`/equip\`!`;
        else if (p.newGold >= 1200) affordHint = `💡 Enough for a **frame** or **title** — style your profile card to shine on the leaderboard!`;
    }

    children.push(
        separator(),
        text(streakLine({streak: p.newStreak, best: p.bestStreak, claims: p.totalClaims})),
        text(milestoneProgress(p.newStreak)),
        ...(affordHint ? [text(affordHint)] : []),
        separator({divider: false}),
        text(`💼 New balance: **${formatInt(p.newGold)} 🪙**  ·  Next claim <t:${laterUnix(new Date(), p.secondsUntilMidnight)}:R>`)
    );

    return container(accent, ...children);
}

/**
 * Build the /balance card for a member.
 * @param {object} p
 * @param {string} p.displayName
 * @param {string|null} [p.avatarUrl]
 * @param {number|null|undefined} [p.accentColor]
 * @param {number} p.gold
 * @param {number} p.streak
 * @param {number} p.bestStreak
 * @param {number} p.claims
 * @param {object|null} p.equipped resolved cosmetics by slot ({slot: item|null})
 */
export function buildBalanceCard({displayName, avatarUrl, accentColor, gold, streak, bestStreak, claims, equipped}) {
    const equippedBits = [];
    const slotOrder = ['color','title','banner','frame','flair','badge','effect'];
    for (const slot of slotOrder) {
        const item = equipped?.[slot];
        if (item) equippedBits.push(`${slotEmoji(slot)} ${item.emoji} **${item.name}**`);
    }
    // Fallback for any extra slots
    for (const slot of Object.keys(equipped || {})) {
        if (!slotOrder.includes(slot)) {
            const item = equipped[slot];
            if (item) equippedBits.push(`${item.emoji} ${item.name}`);
        }
    }

    const nextMilestone = streak ? nextMilestoneInfo(streak) : null;

    const children = [
        thumbnailSection([
            `## 💰 Gold Balance`,
            `**${displayName}**`
        ], avatarUrl ?? null),
        separator(),
        text(`**${formatInt(gold || 0)}** 🪙 gold`),
        text(streakLine({streak, best: bestStreak, claims})),
        ...(nextMilestone ? [text(`⏭️ Next milestone **${nextMilestone.next}** in **${nextMilestone.inDays}** day${nextMilestone.inDays===1?'':'s'} — +${formatInt(nextMilestone.next / MILESTONE_EVERY * 120)}🪙`)] : []),
        text(`🎒 Equipped: ${equippedBits.length > 0 ? '\n' + equippedBits.join('\n') : '_nothing yet — style your card with \\`/shop\\`!_'}`),
        separator({divider: false}),
        text('-# `/daily` to claim  ·  `/shop` to browse  ·  `/equip` to style your card  ·  Flair from 150🪙, colours from 500🪙')
    ];

    return container(accentColor || Colors.BRAND, ...children);
}

/**
 * One catalog section of shop cards.
 */
function detailedItemLine(item, owned, balance) {
    const ownedMark = owned ? '  ✅ Owned' : '';
    const canAfford = balance >= item.price;
    const affordMark = owned ? '' : (canAfford ? '  🟢' : `  🔴 need ${formatInt(item.price - balance)} more`);
    const rarity = rarityTag(item.price);
    const preview = item.palette ? `  \`${item.palette[0]}→${item.palette[1]}\`` : '';
    return `${item.emoji} **${item.name}** — ${formatInt(item.price)} 🪙${ownedMark}${affordMark}  ·  ${item.description}  ·  _${rarity}_${preview}`;
}

function compactItemLine(item, owned, balance) {
    const ownedMark = owned ? ' ✅' : '';
    const canAfford = balance >= item.price;
    const affordMark = owned ? '' : (canAfford ? ' 🟢' : ' 🔴');
    return `${item.emoji} **${item.name}** — ${formatInt(item.price)} 🪙${ownedMark}${affordMark}`;
}

/**
 * Build the /shop card.
 * Guaranteed to stay under Discord's 4000-char total TextDisplay limit.
 * - Single-category: detailed lines (description + rarity + palette) — always fits (< ~1300).
 * - Multi-category (overview): compact lines (emoji+name+price) — fits for current catalog (~1900) and future growth.
 * - If even compact would exceed 4000, falls back to summary mode or truncates with overflow note.
 * @param {object} p
 * @param {number} p.balance caller's gold
 * @param {Set<string>} p.owned owned item ids for the caller
 * @param {Array<{slot:string, items:Array}>} p.groups slot -> items
 */
export function buildShopCard({balance, owned, groups}) {
    const MAX_TOTAL = 4000;
    const ownedCount = owned.size;
    const totalItems = groups.reduce((s,g)=>s+g.items.length,0);
    const affordable = groups.flatMap(g=>g.items).filter(i=>!owned.has(i.id) && i.price <= balance).length;

    const isSingleCategory = groups.length === 1;

    const headerLines = [
        `## 🛒 DreamingDragons Shop`,
        `Your balance: **${formatInt(balance || 0)} 🪙**  ·  ${ownedCount}/${totalItems} owned${affordable ? `  ·  **${affordable}** you can afford now!` : ''}`
    ];
    const headerContent = headerLines.join('\n');
    const footer1 = `-# 🟢 affordable · 🔴 need more gold · Buy with \`/buy\`  ·  equip with \`/equip\`  ·  all cosmetics show on your public profile card & leaderboard`;
    const footer2 = `-# 💡 Tip: Day 1 welcome = **200🪙** → instant flair! • A week ≈ **800🪙** → colour/banner • Two weeks ≈ **1 800🪙** → frame`;
    const footerOverviewHint = isSingleCategory ? null : `-# 📂 Use \`/shop category:<name>\` for full details (description, rarity, palette)`;

    // Build slot entries in the preferred mode for this view
    let slotEntries = [];
    for (const {slot, items} of groups) {
        const slotOwned = items.filter(i => owned.has(i.id)).length;
        const slotHeader = `### ${slotEmoji(slot)} ${slotLabel(slot)}  —  ${slotOwned}/${items.length}`;
        const lines = items.map(i => (isSingleCategory ? detailedItemLine(i, owned.has(i.id), balance) : compactItemLine(i, owned.has(i.id), balance))).join('\n');
        slotEntries.push({slotHeader, lines, count: items.length, slot, items});
    }

    // Estimate total length (sum of all TextDisplay contents)
    const estimateTotal = (entries) => {
        let total = headerContent.length + footer1.length + footer2.length + (footerOverviewHint ? footerOverviewHint.length : 0);
        for (const e of entries) total += e.slotHeader.length + e.lines.length;
        // separators not counted, but add small buffer for newlines
        return total;
    };

    let totalLen = estimateTotal(slotEntries);

    // If over limit, progressively simplify
    let overflowNote = null;
    if (totalLen > MAX_TOTAL) {
        if (!isSingleCategory) {
            // Try summary mode: one compact line per category (examples + counts) instead of listing every item
            const summaryEntries = [];
            for (const {slot, items} of groups) {
                const slotOwned = items.filter(i => owned.has(i.id)).length;
                const affordableHere = items.filter(i => !owned.has(i.id) && i.price <= balance).length;
                const header = `### ${slotEmoji(slot)} ${slotLabel(slot)}  —  ${slotOwned}/${items.length}`;
                const examples = items.slice(0, 3).map(i => `${i.emoji} ${i.name}`).join(', ');
                const more = items.length > 3 ? ` +${items.length - 3} more` : '';
                const affordText = affordableHere ? ` · 🟢 ${affordableHere} affordable` : '';
                const body = `${examples}${more} — from ${formatInt(Math.min(...items.map(i => i.price)))}🪙${affordText}`;
                summaryEntries.push({slotHeader: header, lines: body, count: items.length});
            }
            const summaryTotal = estimateTotal(summaryEntries);
            if (summaryTotal <= MAX_TOTAL) {
                slotEntries = summaryEntries;
                totalLen = summaryTotal;
            } else {
                // Still over — truncate categories: keep only those that fit, overflow the rest
                const truncated = [];
                let running = headerContent.length + footer1.length + footer2.length + (footerOverviewHint ? footerOverviewHint.length : 0);
                let hiddenItems = 0;
                let hiddenCats = 0;
                for (const e of summaryEntries) {
                    const need = e.slotHeader.length + e.lines.length + 2;
                    if (running + need > MAX_TOTAL - 120) {
                        hiddenItems += e.count;
                        hiddenCats++;
                    } else {
                        truncated.push(e);
                        running += need;
                    }
                }
                slotEntries = truncated;
                totalLen = running;
                if (hiddenCats > 0) {
                    overflowNote = `-# … and **${hiddenItems}** more items across **${hiddenCats}** categories — use \`/shop category:<name>\` to browse.`;
                    totalLen += overflowNote.length;
                }
            }
        } else {
            // Single category but still over (future-proof for huge category): truncate item list
            const entry = slotEntries[0];
            const available = MAX_TOTAL - (headerContent.length + footer1.length + footer2.length + entry.slotHeader.length + 120);
            const linesArr = entry.lines.split('\n');
            let acc = '';
            let shown = 0;
            for (const line of linesArr) {
                if (acc.length + line.length + 1 > available) break;
                acc += (acc ? '\n' : '') + line;
                shown++;
            }
            const remaining = linesArr.length - shown;
            if (remaining > 0) acc += `\n-# … and **${remaining}** more — use filters or pagination.`;
            entry.lines = acc;
            totalLen = headerContent.length + footer1.length + footer2.length + entry.slotHeader.length + acc.length;
        }
    }

    const children = [
        text(headerLines.join('\n')),
        separator()
    ];

    for (const e of slotEntries) {
        children.push(text(e.slotHeader));
        children.push(text(e.lines));
    }

    if (overflowNote) children.push(text(overflowNote));

    children.push(separator());
    children.push(text(footer1));
    children.push(text(footer2));
    if (footerOverviewHint) children.push(text(footerOverviewHint));

    return container(Colors.BRAND, ...children);
}

/**
 * Build the /inventory card.
 * @param {object} p
 * @param {number} p.balance
 * @param {object} p.equipped slot -> item|null (resolved)
 * @param {Array<object>} p.ownedItems resolved catalog items owned
 */
export function buildInventoryCard({balance, equipped, ownedItems}) {
    const slotOrder = ['color','title','banner','frame','flair','badge','effect'];
    const equippedBits = [];
    for (const slot of slotOrder) {
        const item = equipped?.[slot];
        if (item) equippedBits.push(`${slotEmoji(slot)} ${item.emoji} **${item.name}** (${slotLabel(slot)})`);
    }
    // any extra
    for (const slot of Object.keys(equipped || {})) {
        if (!slotOrder.includes(slot) && equipped[slot]) equippedBits.push(`${equipped[slot].emoji} **${equipped[slot].name}** (${slotLabel(slot)})`);
    }

    const owned = ownedItems || [];
    // Group owned not equipped by slot for nicer display
    const bySlot = {};
    for (const slot of slotOrder) bySlot[slot]=[];
    for (const i of owned) {
        if (!bySlot[i.slot]) bySlot[i.slot]=[];
        // skip equipped
        let isEquipped = false;
        for (const s of Object.keys(equipped || {})) if (equipped[s]?.id === i.id) isEquipped = true;
        if (!isEquipped) bySlot[i.slot].push(i);
    }

    const notEquippedLines = [];
    for (const slot of slotOrder) {
        const list = bySlot[slot];
        if (list.length) {
            notEquippedLines.push(`**${slotEmoji(slot)} ${slotLabel(slot)}**`);
            for (const it of list) notEquippedLines.push(`${it.emoji} **${it.name}** — \`/equip ${it.id}\``);
        }
    }
    // fallback any leftover
    const leftover = owned.filter(i=>{
        for (const slot of slotOrder) if (bySlot[slot].includes(i)) return false;
        let eq=false; for (const s of Object.keys(equipped||{})) if (equipped[s]?.id===i.id) eq=true;
        return !eq;
    });
    for (const it of leftover) notEquippedLines.push(`${it.emoji} **${it.name}** (${slotLabel(it.slot)}) — \`/equip ${it.id}\``);

    const totalOwned = owned.length;
    const totalCatalog = COSMETICS.length;

    const children = [
        thumbnailSection([
            `## 🎒 Inventory`,
            `Balance: **${formatInt(balance || 0)} 🪙**  ·  ${totalOwned}/${totalCatalog} collected`
        ], null),
        separator(),
        text(`### ✅ Equipped (${equippedBits.length}/7 slots)`),
        text(equippedBits.length > 0 ? equippedBits.join('\n') : '_Nothing equipped yet — use \`/equip\`._'),
        text(`### 🗃️ Owned (not equipped) — ${owned.length - equippedBits.length} items`),
        text(notEquippedLines.length > 0
            ? notEquippedLines.join('\n')
            : '_Nothing here yet. Head to \`/shop\` to spend your gold — flair starts at 150🪙!_'),
        separator({divider: false}),
        text(`-# \`/buy\` new cosmetics  ·  \`/equip\` to equip or remove  ·  Style appears on your public card → https://your-site/u/<your-id>`),
        text(`-# ${progressBar(totalOwned/totalCatalog, 14)}  **${Math.round(totalOwned/totalCatalog*100)}%** collection`)
    ];

    return container(Colors.BRAND, ...children);
}
