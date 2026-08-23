/// <reference path="../pb_data/types.d.ts" />

/**
 * Daily rewards / gold economy schema.
 *
 * One wallet row per (guild, user): gold balance, daily-claim streak tracking,
 * DM-reminder opt-in (OFF by default), and the owned/equipped cosmetics shown
 * on the member's public profile card. `cosmetics` is a JSON array of catalog
 * item ids; `equipped` is a JSON object mapping slot -> item id (or null).
 *
 * Locked down like the other collections — superuser-only (bot + dashboard).
 */
migrate((app) => {
    const ensure = (config) => {
        try {
            app.findCollectionByNameOrId(config.name);
            return; // already exists
        } catch {
            // not found -> create it
        }
        const collection = new Collection(config);
        app.save(collection);
    };

    const autodates = [
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true }
    ];

    ensure({
        type: 'base',
        name: 'user_economy',
        fields: [
            { name: 'guild_id', type: 'text', max: 30 },
            { name: 'user_id', type: 'text', max: 30 },
            { name: 'gold', type: 'number' },
            { name: 'daily_streak', type: 'number' },
            { name: 'best_streak', type: 'number' },
            { name: 'total_claims', type: 'number' },
            // UTC calendar days (YYYY-MM-DD) — streak logic runs on UTC days.
            { name: 'last_claim_date', type: 'text', max: 10 },
            { name: 'last_reminder_date', type: 'text', max: 10 },
            // Opt-in DM nudge on the last day before a streak breaks. Default OFF.
            { name: 'dm_reminders', type: 'bool' },
            { name: 'cosmetics', type: 'json' },
            { name: 'equipped', type: 'json' },
            ...autodates
        ],
        indexes: [
            'CREATE UNIQUE INDEX idx_ue_guild_user ON user_economy (guild_id, user_id)'
        ]
    });
}, (app) => {
    try {
        const collection = app.findCollectionByNameOrId('user_economy');
        app.delete(collection);
    } catch {
        // already gone
    }
});
