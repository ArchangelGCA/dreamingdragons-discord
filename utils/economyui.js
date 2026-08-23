/**
 * Components V2 layouts for the economy system: the /daily claim card, the
 * /balance wallet card, the /shop catalog and the /inventory card. Like
 * levelui.js these builders are PURE (no I/O) so they can be unit-tested
 * without a Discord connection — commands gather the data, builders render it.
 */
import {Colors, container, formatInt, progressBar, separator, text, thumbnailSection} from './ui.js';
import {MILESTONE_EVERY, nextMilestoneInfo, slotEmoji, slotLabel} from './economy.js';

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
    const pct = into / MILESTONE_EVERY;
    return `\`${progressBar(pct, 14)}\`  **${info.inDays}** day${info.inDays === 1 ? '' : 's'} to milestone ${info.next}`;
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
        return container(
            accent,
            thumbnailSection([
                `### 🎁 Daily reward`,
                `**Already claimed today!**`
            ], p.avatarUrl ?? null),
            separator(),
            text(`Come back in **${humanDuration(p.secondsUntilMidnight)}** — <t:${at}:R>`)
        );
    }

    const {reward} = p;
    const children = [
        thumbnailSection([
            `### 🎁 Daily reward claimed!`,
            `**+${formatInt(reward.xp)} XP**  ·  **+${formatInt(reward.gold)} 🪙**`
        ], p.avatarUrl ?? null),
        separator()
    ];

    if (reward.welcomeGold > 0) {
        children.push(text(`🎉 **+${formatInt(reward.welcomeGold)} 🪙 welcome gift** — your first ever claim!`));
    }
    if (reward.milestoneGold > 0) {
        children.push(text(`🏆 **${formatInt(p.newStreak)}-day milestone!** +${formatInt(reward.milestoneGold)} 🪙 bonus`));
    }
    if (reward.jackpot) {
        children.push(text(`💥 **JACKPOT!** Gold doubled`));
    }
    if (p.rescued) {
        children.push(text(`🚨 You came back just in time — your **${formatInt(p.newStreak)}**-day streak lives on!`));
    }
    if (p.brokenFrom) {
        children.push(text(`😢 Your **${formatInt(p.brokenFrom)}**-day streak broke — claiming restarts it at **1** day.`));
    }
    if (p.leveledUp) {
        children.push(text(`## 🎉 Level up! You reached **level ${formatInt(p.newLevel)}**`));
    }

    children.push(
        separator(),
        text(streakLine({streak: p.newStreak, best: p.bestStreak, claims: p.totalClaims})),
        text(milestoneProgress(p.newStreak)),
        separator({divider: false}),
        text(`💼 New balance: **${formatInt(p.newGold)} 🪙**`)
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
    for (const slot of Object.keys(equipped || {})) {
        const item = equipped[slot];
        if (item) equippedBits.push(`${item.emoji} ${item.name}`);
    }

    const children = [
        thumbnailSection([
            `## 💰 Gold Balance`,
            `**${displayName}**`
        ], avatarUrl ?? null),
        separator(),
        text(`**${formatInt(gold || 0)}** 🪙 gold`),
        text(streakLine({streak, best: bestStreak, claims})),
        text(`🎒 Equipped: ${equippedBits.length > 0 ? equippedBits.join(' · ') : '_nothing yet_'}`),
        separator({divider: false}),
        text('-# \`/daily\` to claim  ·  \`/shop\` to browse  ·  \`/equip\` to style your card')
    ];

    return container(accentColor || Colors.BRAND, ...children);
}

/**
 * One catalog section of shop cards.
 * @param {string} placeholder
 */
function itemLine(item, owned) {
    return `${item.emoji} **${item.name}** — ${formatInt(item.price)} 🪙${owned ? '  ✅' : ''}  ·  ${item.description}`;
}

/**
 * Build the /shop card.
 * @param {object} p
 * @param {number} p.balance caller's gold
 * @param {Set<string>} p.owned owned item ids for the caller
 * @param {Array<{slot:string, items:Array}>} p.groups slot -> items
 */
export function buildShopCard({balance, owned, groups}) {
    const children = [
        thumbnailSection([
            `## 🛒 DreamingDragons Shop`,
            `Your balance: **${formatInt(balance || 0)} 🪙**`
        ], null),
        separator()
    ];

    for (const {slot, items} of groups) {
        children.push(text(`### ${slotEmoji(slot)} ${slotLabel(slot)}`));
        children.push(text(items.map((i) => itemLine(i, owned.has(i.id))).join('\n')));
    }

    children.push(
        separator(),
        text('-# Buy with \`/buy\`  ·  equip with \`/equip\`  ·  all cosmetics show on your public profile card')
    );

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
    const equippedBits = [];
    for (const slot of Object.keys(equipped || {})) {
        const item = equipped[slot];
        if (item) equippedBits.push(`${item.emoji} **${item.name}** (${slotLabel(slot)})`);
    }

    const owned = ownedItems || [];
    const notEquipped = owned.filter((i) => {
        for (const slot of Object.keys(equipped || {})) {
            if (equipped[slot]?.id === i.id) return false;
        }
        return true;
    });

    const children = [
        thumbnailSection([
            `## 🎒 Inventory`,
            `Balance: **${formatInt(balance || 0)} 🪙**`
        ], null),
        separator(),
        text(`### ✅ Equipped`),
        text(equippedBits.length > 0 ? equippedBits.join('\n') : '_Nothing equipped yet — use \`/equip\`._'),
        text(`### 🗃️ Owned (not equipped)`),
        text(notEquipped.length > 0
            ? notEquipped.map((i) => `${i.emoji} **${i.name}** (${slotLabel(i.slot)}) — \`/equip ${i.id}\``).join('\n')
            : '_Nothing here yet. Head to \`/shop\` to spend your gold._'),
        separator({divider: false}),
        text('-# \`/buy\` new cosmetics  ·  \`/equip\` to equip or remove')
    ];

    return container(Colors.BRAND, ...children);
}