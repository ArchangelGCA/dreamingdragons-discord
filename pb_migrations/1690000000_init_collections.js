/// <reference path="../pb_data/types.d.ts" />

/**
 * Initial schema for dd-bot.
 * Creates all collections the bot and admin dashboard rely on.
 * Runs automatically on the first `pocketbase serve` (automigrate is on by default).
 *
 * Collections are locked down (no public API rules) — only superusers (the bot
 * and the admin dashboard, which authenticate as a superuser) can access them.
 */
migrate((app) => {
    // Helper: create a collection only if it doesn't already exist (safe re-run).
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
        name: 'reaction_roles',
        fields: [
            { name: 'guild_id', type: 'text', max: 30 },
            { name: 'channel_id', type: 'text', max: 30 },
            { name: 'message_id', type: 'text', max: 30 },
            { name: 'emoji_identifier', type: 'text', max: 100 },
            { name: 'role_id', type: 'text', max: 30 },
            { name: 'component_type', type: 'text', max: 20 },
            { name: 'label', type: 'text', max: 100 },
            { name: 'button_style', type: 'text', max: 20 },
            ...autodates
        ],
        indexes: [
            'CREATE INDEX idx_rr_guild_message ON reaction_roles (guild_id, message_id)'
        ]
    });

    ensure({
        type: 'base',
        name: 'level_settings',
        fields: [
            { name: 'guild_id', type: 'text', max: 30 },
            { name: 'notification_channel_id', type: 'text', max: 30 },
            { name: 'xp_per_message', type: 'number' },
            { name: 'xp_cooldown', type: 'number' },
            { name: 'enabled', type: 'bool' },
            ...autodates
        ],
        indexes: [
            'CREATE UNIQUE INDEX idx_ls_guild ON level_settings (guild_id)'
        ]
    });

    ensure({
        type: 'base',
        name: 'level_rewards',
        fields: [
            { name: 'guild_id', type: 'text', max: 30 },
            { name: 'level', type: 'number' },
            { name: 'role_id', type: 'text', max: 30 },
            ...autodates
        ],
        indexes: [
            'CREATE INDEX idx_lr_guild_level ON level_rewards (guild_id, level)'
        ]
    });

    ensure({
        type: 'base',
        name: 'user_levels',
        fields: [
            { name: 'guild_id', type: 'text', max: 30 },
            { name: 'user_id', type: 'text', max: 30 },
            { name: 'xp', type: 'number' },
            { name: 'level', type: 'number' },
            { name: 'last_message_time', type: 'date' },
            ...autodates
        ],
        indexes: [
            'CREATE UNIQUE INDEX idx_ul_guild_user ON user_levels (guild_id, user_id)'
        ]
    });
}, (app) => {
    // Down migration: drop the collections.
    for (const name of ['reaction_roles', 'level_settings', 'level_rewards', 'user_levels']) {
        try {
            const collection = app.findCollectionByNameOrId(name);
            app.delete(collection);
        } catch {
            // already gone
        }
    }
});
