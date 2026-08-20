/** Shared record types mirroring the PocketBase collections. */

export interface BaseRecord {
	id: string;
	created: string;
	updated: string;
}

export interface ReactionRole extends BaseRecord {
	guild_id: string;
	channel_id: string;
	message_id: string;
	emoji_identifier: string;
	role_id: string;
	component_type: 'reaction' | 'button' | '';
	label: string;
	button_style: string;
}

export interface LevelSettings extends BaseRecord {
	guild_id: string;
	notification_channel_id: string;
	xp_per_message: number;
	xp_cooldown: number;
	enabled: boolean;
}

export interface LevelReward extends BaseRecord {
	guild_id: string;
	level: number;
	role_id: string;
}

export interface UserLevel extends BaseRecord {
	guild_id: string;
	user_id: string;
	xp: number;
	level: number;
	last_message_time: string;
}
