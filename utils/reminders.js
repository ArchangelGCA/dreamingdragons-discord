/**
 * Streak-reminder loop: sends a DM to opted-in users whose daily streak is
 * about to break (last claim was exactly GRACE_DAYS ago = last chance today).
 * Runs on a one-hour interval after the bot logs in.
 */
import {utcDayString, dayGap, GRACE_DAYS, COLLECTION_NAME} from './economy.js';
import {Colors, CV2, container, text} from './ui.js';

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // every hour
const INITIAL_DELAY_MS = 60_000; // first check after 1 minute

/** Called once from index.js after the client is ready. */
export function startStreakReminderLoop(client) {
    if (global.__streakReminderLoopStarted) return;
    global.__streakReminderLoopStarted = true;

    const run = async () => {
        try {
            await sendDueReminders(client);
        } catch (err) {
            console.error('[streak-reminder] loop error:', err);
        }
    };

    setTimeout(run, INITIAL_DELAY_MS);
    setInterval(run, CHECK_INTERVAL_MS);
}

async function sendDueReminders(client) {
    const {getPb} = await import('./pocketbase.js');
    const pb = await getPb();
    if (!pb) return;

    const today = utcDayString();
    const lastChanceDay = (() => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - GRACE_DAYS);
        return utcDayString(d);
    })();

    try {
        const filter = pb.filter(
            'dm_reminders = {:optin} && last_claim_date = {:lastChance} && last_reminder_date != {:today} && daily_streak >= {:minStreak}',
            {optin: true, lastChance: lastChanceDay, today, minStreak: 2}
        );

        const records = await pb.collection(COLLECTION_NAME).getFullList({filter, fields: 'id,guild_id,user_id,daily_streak,last_reminder_date'});

        if (records.length === 0) return;

        console.log(`[streak-reminder] sending ${records.length} reminder(s)`);

        let sent = 0;
        let failed = 0;

        for (const rec of records) {
            try {
                const user = await client.users.fetch(rec.user_id);
                if (user.bot) continue;

                const card = container(
                    Colors.GOLD,
                    text(`### ⏰ Streak at risk!`),
                    text(`Your **${rec.daily_streak}**-day daily streak will break at the end of today (UTC).`),
                    text(`Run \`/daily\` in the server to keep it alive.`)
                );

                await user.send({components: [card], flags: CV2});
                await pb.collection(COLLECTION_NAME).update(rec.id, {last_reminder_date: today});
                sent++;
            } catch (err) {
                if (err.code === 50007) {
                    // Cannot DM this user — disable their opt-in so we don't retry.
                    try {
                        await pb.collection(COLLECTION_NAME).update(rec.id, {dm_reminders: false, last_reminder_date: today});
                    } catch {}
                } else {
                    console.error(`[streak-reminder] failed for user ${rec.user_id}:`, err?.message || err);
                }
                failed++;
            }
        }

        console.log(`[streak-reminder] done: ${sent} sent, ${failed} failed`);
    } catch (err) {
        console.error('[streak-reminder] query error:', err);
    }
}