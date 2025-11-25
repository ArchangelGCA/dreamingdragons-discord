# DreamingDragons Discord Bot

![Discord.js](https://img.shields.io/badge/discord.js-v14.18.0-blue.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)

A feature-rich Discord bot designed for communities with a focus on role management and user engagement.

## ✨ Features

### 🏷️ Reaction Roles
- Create custom role assignment messages with emoji reactions
- Support for standard and custom Discord emojis
- Customizable embeds with titles, descriptions, and colors
- Role add/remove notifications

### 📈 Leveling System
- Reward users with XP for chat activity
- Automatic role rewards at configurable levels
- Customizable XP rates and cooldown periods
- Level-up notifications in designated channels
- Admin tools for managing user levels and rewards

### 🛠️ Admin Controls
- Administrator-only commands for server management
- Detailed logs and error handling

## 📋 Commands

### `/ping`
Simple ping command to check if the bot is responsive.

### `/reactionrole`
Manage reaction-based role assignments.

| Subcommand | Description |
|------------|-------------|
| `setup` | Create a new reaction role message |
| `add` | Add another reaction role to an existing message |
| `list` | List all reaction roles for a message |
| `edit` | Edit an existing reaction role message |
| `remove` | Remove a single reaction role from a message |
| `delete` | Delete an entire reaction role message |

### `/leveladmin`
Configure and manage the server's leveling system.

| Subcommand | Description |
|------------|-------------|
| `setup` | Configure the leveling system with notification channel, XP rates, etc. |
| `setreward` | Set a role to be awarded at a specific level |
| `removereward` | Remove a role reward |
| `resetuser` | Reset a user's level data |
| `enable` | Enable the leveling system |
| `disable` | Disable the leveling system |
| `sync` | Sync roles for all users based on their levels |
| `migrateroles` | Convert existing role assignments to XP levels |
| `setlevel` | Manually set a user's level |

#### `/level`
Check your or someone's current level and XP.

#### `/levels`
Check the leaderboard for the server.

## 🚀 Setup

1. **Prerequisites**
   - Node.js (v16.9.0 or higher)
   - PocketBase server

2. **Configuration**
   Create a `.env` file with the following:
   
```
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
DISCORD_GUILD_ID=your_development_server_id
POCKETBASE_URL=http://your-pocketbase-url.com
POCKETBASE_ADMIN_EMAIL=admin_email
POCKETBASE_ADMIN_PASSWORD=admin_password
```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Deploy commands**
   ```bash
   npm run deploy
   ```

5. **Start the bot**
   ```bash
   npm start
   ```

## ⚙️ PocketBase Configuration

The bot requires the following PocketBase collections:
- `reaction_roles` - Stores reaction role configurations
    - `guild_id` (text)
    - `channel_id` (text)
    - `message_id` (text)
    - `emoji_identifier` (text)
    - `role_id` (text)
- `level_settings` - Stores leveling system settings
    - `guild_id` (text)
    - `notification_channel_id` (text)
    - `xp_per_message` (number)
    - `xp_cooldown` (number)
    - `enabled` (boolean)
- `level_rewards` - Stores role rewards for levels
    - `guild_id` (text)
    - `level` (number)
    - `role_id` (text)
- `user_levels` - Stores user XP and level data
    - `guild_id` (text)
    - `user_id` (text)
    - `xp` (number)
    - `level` (number)
    - `last_message_time` (datetime)

## 💻 Development
   ```bash
   npm install
   npm run dev
   ```

Built with:
- [discord.js](https://discord.js.org/) - Discord API library
- [PocketBase](https://pocketbase.io/) - Backend database

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.