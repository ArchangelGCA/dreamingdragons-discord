# 🐉 DreamingDragons Discord Bot (dd-bot)

![discord.js](https://img.shields.io/badge/discord.js-v14.27-5865F2.svg)
![Node](https://img.shields.io/badge/node-24%20LTS-3C873A.svg)
![PocketBase](https://img.shields.io/badge/PocketBase-v0.39-B8DBE4.svg)
![SvelteKit](https://img.shields.io/badge/SvelteKit-Svelte%205-FF3E00.svg)
![License](https://img.shields.io/badge/license-MIT-success.svg)

A feature-rich Discord bot for communities — **reaction roles** (modern buttons *or* classic emoji reactions) and a **leveling / XP** system — bundled as a single, self-provisioning Docker deployment together with its database and a private admin dashboard.

## 📦 What's inside

`docker compose up -d` brings up the whole stack:

| Service | Description | Image |
|---------|-------------|-------|
| **bot** | The Discord bot (discord.js v14) | built from `Dockerfile` |
| **pocketbase** | Database + auto-created schema & superuser | built from `pocketbase/Dockerfile` |
| **web** | Private admin dashboard (SvelteKit + Svelte 5) | built from `web/Dockerfile` |
| **cloudflared** | *Optional* Cloudflare Tunnel for local hosting | `cloudflare/cloudflared` |

Everything is **multi-arch** — it runs on `linux/amd64` and `linux/arm64` (e.g. an ARM VPS or a Raspberry Pi). No manual database setup: collections and the admin account are created automatically on first start.

## ✨ Features

### 🏷️ Reaction Roles
- **Button roles (modern):** users click a button — no reacting, no `Manage Emoji` needed.
- **Emoji reaction roles (classic):** still fully supported for existing setups.
- Custom embeds (title, description, color), multiple roles per message, add/remove/edit/delete, autocomplete for message IDs and emojis.

### 📈 Leveling System
- XP for chat activity with configurable rate & cooldown, non-linear level curve.
- Automatic role rewards at configured levels, level-up notifications, leaderboard.
- Admin tools: setup, rewards, reset, enable/disable, sync, migrate existing roles, set level.

### 🛠️ Admin dashboard
- Private (PocketBase superuser login — no public sign-up).
- Overview stats, edit leveling settings & rewards, browse/prune reaction roles, view & edit member XP/levels.

## 🚀 Quick start (Docker Compose)

**Prerequisites:** Docker + Docker Compose. A Discord application with a bot token
(from the [Discord Developer Portal](https://discord.com/developers/applications)) with the
**Server Members** and **Message Content** privileged intents enabled.

```bash
# 1. Clone and enter the repo
git clone <your-repo-url> dd-bot && cd dd-bot

# 2. Create your environment file
cp .env.example .env
#    ...then edit .env (bot token, client ID, admin email/password, ORIGIN)

# 3. Launch the whole stack
docker compose up -d --build
```

That's it. On first boot PocketBase creates its collections and the superuser account,
the bot deploys its slash commands and logs in, and the dashboard comes up.

- Admin dashboard → `http://localhost:3000`
- PocketBase dashboard → `http://localhost:8090/_/`

View logs / stop:

```bash
docker compose logs -f bot        # or: pocketbase / web
docker compose down               # add -v to also wipe the database volume
```

## ⚙️ Configuration

All configuration is via `.env` (see `.env.example` for the annotated template):

| Variable | Required | Description |
|----------|:--------:|-------------|
| `DISCORD_BOT_TOKEN` | ✅ | Bot token. |
| `DISCORD_CLIENT_ID` | ✅ | Application (client) ID. |
| `DISCORD_GUILD_ID` | — | Single guild for **instant** command updates. Empty = **global** deploy (~1h to propagate). |
| `POCKETBASE_ADMIN_EMAIL` | ✅ | Superuser email (auto-created). |
| `POCKETBASE_ADMIN_PASSWORD` | ✅ | Superuser password (**min 8 chars**, auto-created). |
| `ORIGIN` | ✅ | Public URL the dashboard is opened from (e.g. `http://localhost:3000`). Must match or form actions fail. |
| `POCKETBASE_PORT` | — | Host port for PocketBase (default `8090`). |
| `WEB_PORT` | — | Host port for the dashboard (default `3000`). |
| `POCKETBASE_URL` | — | Only for running **outside** Docker; inside compose it's `http://pocketbase:8090` automatically. |
| `TUNNEL_TOKEN` | — | Cloudflare Tunnel token (only with `--profile tunnel`). |

## 🗄️ PocketBase (auto-provisioned)

No manual setup. On first `serve`, PocketBase applies the migration in
`pb_migrations/` which creates the collections (`reaction_roles`, `level_settings`,
`level_rewards`, `user_levels`), and the entrypoint upserts the superuser from your
env vars. Collections have no public API rules — only the superuser (bot + dashboard)
can read/write them. Data persists in the `pb_data` Docker volume.

## ☁️ Cloudflare Tunnel (optional)

Expose the dashboard publicly without opening ports (great for home/local hosting).
Create a tunnel in the Cloudflare Zero Trust dashboard, point a hostname at
`http://web:3000`, put the token in `TUNNEL_TOKEN`, set `ORIGIN` to your public HTTPS
URL, then:

```bash
docker compose --profile tunnel up -d
```

## 🧱 ARM64 / multi-arch

Images build natively for your host arch. To build for an ARM VPS from an x86 machine:

```bash
docker buildx build --platform linux/arm64 -f pocketbase/Dockerfile -t <you>/ddbot-pocketbase .
docker buildx build --platform linux/arm64 -f Dockerfile           -t <you>/ddbot-bot .
docker buildx build --platform linux/arm64 -f web/Dockerfile       -t <you>/ddbot-web ./web
```

The PocketBase image downloads the correct binary via `TARGETARCH`; Node images have
official `arm64` variants. All three are verified to build for `linux/amd64` and `linux/arm64`.

## 📋 Commands

| Command | Description |
|---------|-------------|
| `/help` | List all available commands. |
| `/ping` | Check the bot is responsive. |
| `/level [user]` | Show your (or another member's) level, XP and rank. |
| `/levels [page]` | Server XP leaderboard. |
| `/reactionrole` | Admin: `setup`, `add`, `list`, `edit`, `remove`, `delete` reaction roles. |
| `/leveladmin` | Admin: `setup`, `setreward`, `removereward`, `resetuser`, `enable`, `disable`, `sync`, `migrateroles`, `setlevel`. |

**Button reaction role example:** `/reactionrole setup channel:#roles message_content:"Pick a role!" role:@Gamer button:true label:"Gamer" style:success`

**Classic emoji example:** `/reactionrole setup channel:#roles message_content:"React!" role:@Gamer emoji:🎮`

## 💻 Local development (without Docker)

Requires Node.js 22+ and a PocketBase instance (run one with the bundled image or the
[binary](https://pocketbase.io/docs/)).

```bash
# Bot
npm install
cp .env.example .env          # set POCKETBASE_URL to your PB instance
npm run deploy                # register slash commands
npm run dev                   # start with auto-reload (nodemon)

# Admin dashboard
cd web
npm install
POCKETBASE_URL=http://127.0.0.1:8090 ORIGIN=http://localhost:5173 npm run dev
```

## 🗂️ Project structure

```
dd-bot/
├─ index.js               # bot entrypoint (interactions, events)
├─ deploy-commands.js     # registers slash commands (guild or global)
├─ commands/              # slash commands (admin/, fun/, utility/)
├─ utils/                 # pocketbase, leveling, reactionroles, replies helpers
├─ init/                  # boot-time reaction-role message caching
├─ pb_migrations/         # PocketBase schema (auto-applied)
├─ pocketbase/            # PocketBase Dockerfile + entrypoint
├─ web/                   # SvelteKit 5 admin dashboard
├─ Dockerfile             # bot image
└─ docker-compose.yml     # full stack
```

## 🧰 Built with

- [discord.js](https://discord.js.org/) — Discord API library
- [PocketBase](https://pocketbase.io/) — database & auth
- [SvelteKit](https://svelte.dev/) (Svelte 5) — admin dashboard
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) — optional public access

## 📄 License

MIT — see the [LICENSE](LICENSE) file.
