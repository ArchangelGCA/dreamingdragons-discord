# DreamingDragons Discord Bot

A Discord bot built with discord.js and PocketBase by @ArchangelGCA for the DreamingDragons community. This bot provides a simple way to create and manage some "nice to have" features such as reaction roles in your Discord server.

## Features

- Create embeds with reaction roles
- Add multiple roles to a single message
- Edit existing reaction role messages and configurations
- Remove individual reaction roles or entire messages
- List all reaction roles on a message
- Custom colored embeds
- Persistent storage with PocketBase

## Prerequisites

- Node.js 16.x or higher
- npm or yarn
- A Discord bot application with proper permissions
- PocketBase instance (self-hosted or cloud)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/discord-reaction-roles-bot.git
   cd discord-reaction-roles-bot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file from example:
   ```bash
   cp .env.example .env
   ```

4. Edit the `.env` file with your credentials:
   ```dotenv
   DISCORD_BOT_TOKEN=your_discord_bot_token_here
   DISCORD_CLIENT_ID=your_client_id_here
   DISCORD_GUILD_ID=your_guild_id_here
   POCKETBASE_URL=https://your-pocketbase-url.com/
   POCKETBASE_ADMIN_EMAIL=your_admin_email@example.com
   POCKETBASE_ADMIN_PASSWORD=your_admin_password_here
   ```

5. Set up your PocketBase:
    - Create a collection called `reaction_roles` with fields:
        - `guild_id` (text)
        - `channel_id` (text)
        - `message_id` (text)
        - `emoji_identifier` (text)
        - `role_id` (text)

## PocketBase Setup

1. Create a new PocketBase instance or use an existing one
2. Create a new collection called `reaction_roles`
3. Add the required fields:
    - `guild_id` (text)
    - `channel_id` (text)
    - `message_id` (text)
    - `emoji_identifier` (text)
    - `role_id` (text)
4. Add the admin credentials to your `.env` file

## Bot Permissions

The bot requires the following permissions:
- `Manage Roles`
- `Send Messages`
- `Embed Links`
- `Add Reactions`
- `Read Message History`

Make sure the bot's role in your server hierarchy is **higher** than any roles it needs to assign.

## Deploy Commands

Before using the bot, deploy the slash commands:

```bash
npm run deploy
```

## Running the Bot

```bash
npm start

# For development with auto-restart:
npm run dev
```

## Commands

All commands require Administrator permissions.

### `/reactionrole setup`

Create a new reaction role message.

**Options:**
- `channel`: The channel to send the reaction message to
- `message_content`: The text content for the message (use \n for new lines)
- `role`: The role to assign
- `emoji`: The emoji users should react with
- `embed_title` (Optional): Title for the embed message
- `color` (Optional): Custom color for the embed (hex code like #FF0000)

### `/reactionrole add`

Add another role to an existing reaction role message.

**Options:**
- `message_id`: The ID of the existing reaction role message
- `role`: The role to assign
- `emoji`: The emoji users should react with

### `/reactionrole list`

List all reaction roles for a specific message.

**Options:**
- `message_id`: The ID of the reaction role message

### `/reactionrole edit`

Edit an existing reaction role message or role assignment.

**Options:**
- `message_id`: The ID of the reaction role message
- `current_emoji` (Optional): The current emoji of the reaction role to edit
- `new_role` (Optional): The new role to assign
- `new_emoji` (Optional): The new emoji to use
- `new_message_content` (Optional): New text content for the message
- `new_embed_title` (Optional): New title for the embed message
- `new_embed_color` (Optional): New color for the embed

### `/reactionrole remove`

Remove a single reaction role from a message.

**Options:**
- `message_id`: The ID of the reaction role message
- `emoji`: The emoji of the reaction role to remove

### `/reactionrole delete`

Delete an entire reaction role message with all roles.

**Options:**
- `message_id`: The ID of the reaction role message to delete
- `delete_message` (Optional): Also delete the Discord message (Default: false)

## Troubleshooting

### Common Issues:

1. **"Unknown Emoji"**: The bot can only use standard Unicode emojis or custom emojis from the current server.

2. **"Missing Permissions"**: Ensure the bot has the `Manage Roles` permission and its role is higher than the roles it needs to assign.

3. **"Cannot find message"**: Verify that the message ID exists and the bot has access to that channel.

4. **"PocketBase connection errors"**: Check your PocketBase URL and credentials in the `.env` file.

## License

This project is licensed under the MIT License - see the LICENSE file for details.