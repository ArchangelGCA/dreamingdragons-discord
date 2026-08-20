/**
 * Shared leveling operations used by BOTH the /leveladmin slash command and the
 * internal HTTP API (api/server.js). Keeping one implementation means the bot and
 * the dashboard behave identically and the core logic can be unit-tested.
 */
import {
    calculateXpForLevel,
    calculateLevelFromXp,
    checkAndAwardRoles,
    invalidateUserCache,
    invalidateGuildUserCache
} from './leveling.js';

/** Small buffer added on top of a level's threshold so the user sits solidly at it. */
export const XP_BUFFER = 10;

/**
 * Total XP required to have reached a given level (sum of the per-level costs).
 * Mirrors the cumulative threshold used by calculateLevelFromXp.
 */
export function cumulativeXpForLevel(level) {
    let total = 0;
    for (let i = 1; i <= level; i++) {
        total += calculateXpForLevel(i);
    }
    return total;
}

/**
 * Pure planner for the "recover XP from reward roles" operation.
 *
 * For each non-bot member, find the highest level among the reward roles they
 * currently hold. If they have no level record, or their current level is below
 * that role level, plan to grant them the XP tied to that level. Otherwise skip.
 *
 * @param {object} args
 * @param {Array<{id:string,bot:boolean,roleIds:string[],name?:string}>} args.members
 * @param {Array<{role_id:string,level:number}>} args.rewards
 * @param {Map<string,{id:string,xp:number}>} args.existing  user_id -> record
 * @returns {{changes:Array<object>, skipped:number}}
 */
export function planRecovery({ members, rewards, existing }) {
    // Highest configured level per role (a role could, in theory, map to several).
    const roleLevels = new Map();
    for (const r of rewards) {
        const lvl = Number(r.level) || 0;
        if (lvl > (roleLevels.get(r.role_id) ?? 0)) roleLevels.set(r.role_id, lvl);
    }

    const changes = [];
    let skipped = 0;

    for (const m of members) {
        if (m.bot) { skipped++; continue; }

        let highestLevel = 0;
        for (const roleId of m.roleIds) {
            const lvl = roleLevels.get(roleId);
            if (lvl && lvl > highestLevel) highestLevel = lvl;
        }
        if (highestLevel === 0) { skipped++; continue; }

        const targetXp = cumulativeXpForLevel(highestLevel) + XP_BUFFER;
        const rec = existing.get(m.id);

        if (rec) {
            const existingLevel = calculateLevelFromXp(rec.xp);
            if (existingLevel < highestLevel) {
                changes.push({
                    userId: m.id, name: m.name ?? null, recordId: rec.id, action: 'update',
                    fromXp: rec.xp, fromLevel: existingLevel, toXp: targetXp, toLevel: highestLevel
                });
            } else {
                skipped++;
            }
        } else {
            changes.push({
                userId: m.id, name: m.name ?? null, recordId: null, action: 'create',
                fromXp: 0, fromLevel: 0, toXp: targetXp, toLevel: highestLevel
            });
        }
    }

    return { changes, skipped };
}

/**
 * Gather the inputs planRecovery needs from Discord + PocketBase for a guild.
 */
export async function gatherRecoveryInputs(pb, client, guildId) {
    const rewards = await pb.collection('level_rewards').getFullList({
        filter: pb.filter('guild_id = {:g}', { g: guildId }),
        sort: '+level'
    });

    const guild = await client.guilds.fetch(guildId);
    const memberColl = await guild.members.fetch();
    const members = memberColl.map((m) => ({
        id: m.id,
        bot: m.user.bot,
        roleIds: [...m.roles.cache.keys()],
        name: m.displayName ?? m.user.username
    }));

    const existingList = await pb.collection('user_levels').getFullList({
        filter: pb.filter('guild_id = {:g}', { g: guildId })
    });
    const existing = new Map(existingList.map((r) => [r.user_id, { id: r.id, xp: r.xp }]));

    return { members, rewards, existing };
}

/** Persist a set of planned recovery changes. Returns counts. */
export async function applyRecovery(pb, guildId, changes) {
    let updated = 0;
    let errors = 0;
    const now = new Date().toISOString();

    for (const c of changes) {
        try {
            if (c.action === 'update') {
                await pb.collection('user_levels').update(c.recordId, {
                    xp: c.toXp, level: c.toLevel, last_message_time: now
                });
            } else {
                await pb.collection('user_levels').create({
                    guild_id: guildId, user_id: c.userId,
                    xp: c.toXp, level: c.toLevel, last_message_time: now
                });
            }
            updated++;
        } catch (error) {
            console.error(`[recovery] failed for user ${c.userId}:`, error);
            errors++;
        }
    }

    invalidateGuildUserCache(guildId);
    return { updated, errors };
}

/**
 * Full recover flow. With dryRun the DB is untouched and the plan is returned
 * for preview; otherwise the changes are applied.
 */
export async function recoverGuildXp(pb, client, guildId, { dryRun = false } = {}) {
    const inputs = await gatherRecoveryInputs(pb, client, guildId);
    const { changes, skipped } = planRecovery(inputs);

    if (dryRun) {
        return { dryRun: true, changes, skipped, updated: 0, errors: 0 };
    }

    const { updated, errors } = await applyRecovery(pb, guildId, changes);
    return { dryRun: false, changes, skipped, updated, errors };
}

/** Re-evaluate and award level-reward roles for every tracked user in a guild. */
export async function syncGuildRoles(pb, client, guildId) {
    const users = await pb.collection('user_levels').getFullList({
        filter: pb.filter('guild_id = {:g}', { g: guildId })
    });

    let success = 0;
    let failed = 0;
    for (const u of users) {
        try {
            await checkAndAwardRoles(u.user_id, guildId, calculateLevelFromXp(u.xp), client, pb);
            success++;
        } catch {
            failed++;
        }
    }
    return { total: users.length, success, failed };
}

/** Upsert a user's XP (and derived level), then re-sync their reward roles. */
export async function setUserXp(pb, client, guildId, userId, xp) {
    const safeXp = Math.max(0, Math.floor(Number(xp) || 0));
    const level = calculateLevelFromXp(safeXp);
    await upsertUserLevel(pb, guildId, userId, safeXp, level);
    invalidateUserCache(guildId, userId);
    await checkAndAwardRoles(userId, guildId, level, client, pb);
    return { userId, xp: safeXp, level };
}

/** Set a user's level (XP derived from the level threshold), then re-sync roles. */
export async function setUserLevel(pb, client, guildId, userId, level) {
    const safeLevel = Math.max(0, Math.floor(Number(level) || 0));
    const xp = cumulativeXpForLevel(safeLevel) + XP_BUFFER;
    await upsertUserLevel(pb, guildId, userId, xp, safeLevel);
    invalidateUserCache(guildId, userId);
    await checkAndAwardRoles(userId, guildId, safeLevel, client, pb);
    return { userId, xp, level: safeLevel };
}

/** Delete a user's level record and clear their cache entry. */
export async function resetUser(pb, guildId, userId) {
    const existing = await pb.collection('user_levels').getList(1, 1, {
        filter: pb.filter('guild_id = {:g} && user_id = {:u}', { g: guildId, u: userId })
    });
    if (existing.totalItems === 0) {
        invalidateUserCache(guildId, userId);
        return { deleted: false };
    }
    await pb.collection('user_levels').delete(existing.items[0].id);
    invalidateUserCache(guildId, userId);
    return { deleted: true };
}

async function upsertUserLevel(pb, guildId, userId, xp, level) {
    const now = new Date().toISOString();
    const existing = await pb.collection('user_levels').getList(1, 1, {
        filter: pb.filter('guild_id = {:g} && user_id = {:u}', { g: guildId, u: userId })
    });
    if (existing.totalItems > 0) {
        await pb.collection('user_levels').update(existing.items[0].id, {
            xp, level, last_message_time: now
        });
    } else {
        await pb.collection('user_levels').create({
            guild_id: guildId, user_id: userId, xp, level, last_message_time: now
        });
    }
}
