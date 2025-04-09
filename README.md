# DreamingDragons Discord Bot

![Discord.js](https://img.shields.io/badge/discord.js-v14.18.0-blue.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)

A feature-rich Discord bot designed for communities with a focus on DeviantArt integration and role management.

## ✨ Features

### 🎨 DeviantArt Integration
- Monitor DeviantArt galleries and automatically post new artwork
- Configure update intervals and notification channels
- Test feeds before setting them up

### 🏷️ Reaction Roles
- Create custom role assignment messages with emoji reactions
- Support for standard and custom Discord emojis
- Customizable embeds with titles, descriptions, and colors
- Role add/remove notifications

### 🛠️ Admin Controls
- Administrator-only commands for server management
- Detailed logs and error handling

## 📋 Commands

### `/ping`
Simple ping command to check if the bot is responsive.

### `/deviantart`
Manage DeviantArt feed monitoring.

| Subcommand | Description |
|------------|-------------|
| `add` | Add a new DeviantArt feed to monitor |
| `list` | List all DeviantArt feeds being monitored |
| `edit` | Edit an existing DeviantArt feed |
| `remove` | Remove a DeviantArt feed |
| `test` | Test a feed by fetching the latest deviation |

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
- `deviantart_feeds` - Stores DeviantArt feed configurations
  - `guild_id` (text)
  - `channel_id` (text)
  - `url` (text/URL)
  - `interval` (number)
  - `last_check` (datetime)
  - `known_deviations` (JSON)
- `reaction_roles` - Stores reaction role configurations
  - `guild_id` (text)
  - `channel_id` (text)
  - `message_id` (text)
  - `emoji_identifier` (text)
  - `role_id` (text)

## 💻 Development
   ```bash
   npm install
   npm run dev
   ```


Built with:
- [discord.js](https://discord.js.org/) - Discord API library
- [PocketBase](https://pocketbase.io/) - Backend database
- [Cheerio](https://cheerio.js.org/) - For DeviantArt feed parsing

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.