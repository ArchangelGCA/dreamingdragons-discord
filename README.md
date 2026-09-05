# 🐉 DreamingDragons Discord Bot (dd-bot)

![discord.js](https://img.shields.io/badge/discord.js-v14.27-5865F2.svg)
![Bun](https://img.shields.io/badge/bun-%3E%3D1.4.2-f472b6.svg)
![PocketBase](https://img.shields.io/badge/PocketBase-v0.39-B8DBE4.svg)
![SvelteKit](https://img.shields.io/badge/SvelteKit-Svelte%205-FF3E00.svg)
![License](https://img.shields.io/badge/license-MIT-success.svg)

A feature-rich Discord bot for communities — **reaction roles** (modern buttons *or* classic emoji reactions), a **leveling / XP** system, and a **daily rewards / gold economy** with cosmetically customisable public profile cards — bundled as a single, self-provisioning Docker deployment together with its database and a private admin dashboard.

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

### 🎨 Modern Components V2 design
- Every bot surface — rank cards, the leaderboard, help, reaction-role panels, level-up announcements and status replies — uses Discord's **Components V2** layouts (accent-colored containers, sections, separators, thumbnails) instead of legacy embeds.
- Shared brand palette matching the DreamingDragons dashboard (teal/cyan), with role-colored accents on role notifications.
- XP **progress bars**, avatar thumbnails, top-3 🥇🥈🥉 medals and an always-visible "You: #rank" footer.

### 🏷️ Reaction Roles
- **Button roles (modern):** users click a button inside a single accent-colored panel — no reacting, no `Manage Emoji` needed.
- **Emoji reaction roles (classic):** still fully supported for existing setups (also rendered as panels).
- Custom panels (title, description, accent color), up to 25 buttons per message, add/remove/edit/delete, autocomplete for message IDs and emojis.
- Editing or re-sending texts works for **both** the modern panel format and any legacy embed messages created before the upgrade.

### 📈 Leveling System
- XP for chat activity with configurable rate & cooldown, non-linear level curve.
- Automatic role rewards at configured levels, rich level-up cards, paginated leaderboard (`◀ Previous · Page n/m · Next ▶`).
- Admin tools: setup, rewards, reset, enable/disable, sync, migrate existing roles, set level.
- `/level` shows an accent-colored rank card with avatar, rank, progress bar and XP-to-next-level.

### 🪙 Daily Rewards and Gold Economy

- **`/daily`** — claim a daily reward worth **XP + gold 🪙**, tuned to the default leveling config (100 XP ≈ 5 messages). Streak bonuses grow up to **+100%** by day 10, plus gold **milestone bonuses every 7 days** and a rare **jackpot** (2× gold).
- **Streak system** — claiming on consecutive UTC days builds a streak. A **3-day grace** keeps it safe: come back anytime within 3 days and it survives. Miss 4+ days and it resets (with a gentle "your streak ended" notice). Claiming during the grace shows a "saved it!" flock.
- **DM reminders (opt-in, default OFF)** — `/reminders enabled:true` lets the bot DM you on the *last* day before your streak breaks. `/reminders enabled:false` opts out.
- **Gold shop** — spend gold on cosmetics with `/shop`, `/buy`, `/equip` (and `/inventory`). Equipped items personalise the member's **public profile card** (`/u/<id>`) and the Discord `/level` rank card:
  - 🎨 **Colours** — override the card accent gradient
  - 🏷️ **Titles** — a title line under your name
  - 🖼️ **Frames** — glow / animated rainbow borders
  - 💫 **Flair** — a small emoji beside your name
- All shop/equip actions happen **from Discord** — there is no login on the public site and no dashboard for users. Purchases are safe-guarded by per-user locks to prevent double claims.

> Balance notes: a first week of perfect claims (welcome gift + streak + day-7 milestone) pays for your first colour; titles and frames need 2–6 weeks of streaks, so chat XP still dominates the leaderboard.

### 🛠️ Admin dashboard
- Private (PocketBase superuser login — no public sign-up).
- **Multi-server aware:** a guild switcher scopes every page to the selected server.
- **Live Discord data:** roles, channels and members are resolved to real **names & avatars** (not raw IDs) via a secure, internal-only bridge to the bot.
- **Full management, not just viewing:**
  - **Leveling** — edit settings (XP/message, cooldown, notification channel, enable/disable) and full **reward-role CRUD** with searchable role pickers.
  - **Users** — search any member, edit XP / set level / reset; changes route through the bot so **reward roles re-sync** automatically.
  - **Reaction roles** — an intuitive builder: pick a channel, compose the embed, add role rows (button *or* emoji mode) and it **posts to Discord** for you; edit/add/remove entries and **delete cleans up the Discord message too** (no more stale buttons).
- **XP Recovery** — lost your DB but members still hold their reward roles? Preview (dry-run) then apply a recovery that grants each member **at least the XP tied to the highest reward role they hold**. Also available as `/leveladmin migrateroles`.
- **Graceful degradation:** if the bot is offline the dashboard still runs — it shows a banner, falls back to raw IDs, and DB-only edits keep working.

> The dashboard never holds the Discord token. It talks to PocketBase directly and reaches the bot only **server-side** over an internal Docker network (`http://bot:8787`, Bearer-authenticated, no host port). See `INTERNAL_API_SECRET` below.

### 🌐 Public website (GDPR-friendly)

The same `web` service also serves a **public, no-login section** at the site root:

- **`/`** — landing page with server stats and the top-3 podium.
- **`/leaderboard`** — public leaderboard (same data as `/levels` in Discord).
- **`/u/<userId>`** — a member's personal stats card; `/level` in Discord links straight to it when `PUBLIC_URL` is set.
- **`/privacy`** — a ready-made GDPR/privacy page you can adapt.

Privacy by design:

- **Minimal data** — only `user_id`, `xp`, `level` are exposed; profile pages show a "last active" **day only** (no timestamps, no message content). Server-side reads go through the superuser (`web/src/lib/server/public.ts`) because the collections have no public API rules.
- **Pseudonym fallback** — names/avatars resolve via the bot bridge; if the bot is offline, entries render as `Member #xxxx` so no data beyond the ID leaves the server.
- **Anonymous-fast** — public visitors get no session cookies and bypass auth handling; public GETs are rate-limited per IP (120 req/min).
- Set leveling to disabled and the leaderboard hides itself; personal pages keep working (members keep their rank link).

## 🚀 Quick start (Docker Compose)

**Prerequisites:** Docker + Docker Compose. A Discord application with a bot token
(from the [Discord Developer Portal](https://discord.com/developers/applications)) with the
**Server Members** and **Message Content** privileged intents enabled.

```bash
# 1. Clone and enter the repo
git clone <your-repo-url> dd-bot && cd dd-bot

# 2. Create your environment file
cp .env.example .env
#    ...then edit .env (bot token, client ID, admin email/password, ORIGIN,
#    and INTERNAL_API_SECRET — generate one with:  openssl rand -hex 32)

# 3. Launch the whole stack
docker compose up -d --build
```

That's it. On first boot PocketBase creates its collections and the superuser account,
the bot deploys its slash commands and logs in, and the dashboard comes up.

- Admin dashboard → `http://localhost:3000`
- PocketBase dashboard → `http://localhost:8090/_/` (host port) — or, from anywhere
  behind the Cloudflare Tunnel, the baked-in proxy at **`https://<your-domain>/pb/_/`**
  (same superuser login, gated behind the dashboard session — see below).

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
| `PUBLIC_URL` | — | Public site base URL (usually same public origin as `ORIGIN`). Enables the "View stats online" link button on `/level`. |
| `INTERNAL_API_SECRET` | ▲ | Shared secret for the dashboard↔bot bridge (Discord names + live actions). **Blank = bridge disabled**, dashboard degrades to DB-only/raw-IDs. Bot & web must share the same value; use `openssl rand -hex 32`. Internal network only — never exposed to a host port. |
| `BOT_API_PORT` | — | Port for the bot's internal API on the Docker network (default `8787`; no host mapping). |
| `POCKETBASE_PORT` | — | Host port for PocketBase (default `8090`). |
| `WEB_PORT` | — | Host port for the dashboard (default `3000`). |
| `POCKETBASE_URL` | — | Only for running **outside** Docker; inside compose it's `http://pocketbase:8090` automatically. |
| `TUNNEL_TOKEN` | — | Cloudflare Tunnel token (only with `--profile tunnel`). |
| `AUTO_UPDATE` | — | `true` enables the auto-updater (continuous deployment). Default `false`. See [Automatic updates](#-automatic-updates-continuous-deployment). |
| `AUTO_UPDATE_INTERVAL` | — | Seconds between remote checks (default `300`). |
| `AUTO_UPDATE_BRANCH` | — | Branch to track/deploy (default `master`). |
| `AUTO_UPDATE_REMOTE` | — | Git remote to pull from (default `origin`). |
| `GIT_PULL_TOKEN` | — | **Private repos only:** GitHub token so the updater can fetch. Blank for public repos. |
| `COMPOSE_PROJECT_NAME` | — | Normally auto-detected; only set to force the stack/volume name. |
| `COMPOSE_PROFILES` | — | Active profiles (e.g. `tunnel`) so the updater manages those services too. |

<sub>✅ required · ▲ required for live dashboard features (safe to leave blank for a DB-only dashboard) · — optional</sub>

## 🗄️ PocketBase (auto-provisioned)

No manual setup. On first `serve`, PocketBase applies the migration in
`pb_migrations/` which creates the collections (`reaction_roles`, `level_settings`,
`level_rewards`, `user_levels`, `user_economy`), and the entrypoint upserts the superuser from your
env vars. Collections have no public API rules — only the superuser (bot + dashboard)
can read/write them. Data persists in the `pb_data` Docker volume.

**Accessing the admin UI:** The dashboard includes a built-in proxy at
**`/pb/_/`** (served by `web/src/routes/pb/[...path]/+server.ts`). When
your site is behind the Cloudflare Tunnel (or any public origin), open
`https://<your-domain>/pb/_/` — it's proxied to PocketBase through the
`web` service, gated behind the dashboard admin session. The classic
`http://localhost:8090/_/` (host port) still works for local access. The
`/pb` tree is only reachable to authenticated admins, so the underlying
8090 port never needs to be opened publicly.

## ☁️ Cloudflare Tunnel (optional)

Expose the dashboard publicly without opening ports (great for home/local hosting).
Create a tunnel in the Cloudflare Zero Trust dashboard, point a hostname at
`http://web:3000`, put the token in `TUNNEL_TOKEN`, set `ORIGIN` to your public HTTPS
URL, then:

```bash
docker compose --profile tunnel up -d
```

## 🔄 Automatic updates (continuous deployment)

Turn your server into a self-updating deployment: **`git push` → the server pulls
and rebuilds itself**, in place, without wiping any data. No GitHub Actions, no
webhooks, no manual SSH.

A small `updater` service (bundled in `docker-compose.yml`) polls your git remote
on a timer. When the tracked branch has new commits it:

1. `git reset --hard` the repo to the fetched commit (untracked files like `.env`
   and PocketBase data are left untouched — no `git clean`);
2. rebuilds the images and **recreates only the changed containers**;
3. leaves the `pb_data` volume — and every other named volume — completely alone,
   so **your database is never reset**.

It never rebuilds *itself* mid-update, so a deploy can't interrupt the loop.

### Enable it

```bash
# In your server's .env:
AUTO_UPDATE=true
AUTO_UPDATE_INTERVAL=300      # check every 5 minutes (tune as you like)
AUTO_UPDATE_BRANCH=master     # the branch you deploy from
COMPOSE_PROFILES=tunnel       # if (and only if) you run the Cloudflare Tunnel

# Bring the WHOLE stack up (and build the updater image the first time).
# With COMPOSE_PROFILES=tunnel set above, this also starts cloudflared —
# no need for the --profile flag anymore.
docker compose up -d --build

# Watch the updater work:
docker compose logs -f updater
```

> ⚠ Run `docker compose up -d --build` (no service name). Adding `updater` to the
> end scopes the command to **only** that one container and leaves the bot,
> dashboard, PocketBase and tunnel stopped — the updater does *not* launch the
> stack itself, it only reacts to future pushes.

That's it. From now on, every push to `AUTO_UPDATE_BRANCH` is live within
`AUTO_UPDATE_INTERVAL` seconds. To pause auto-updates, set `AUTO_UPDATE=false`
and run `docker compose up -d updater` again (that one *is* scoped to the updater
on purpose — it stays up but idles; the rest of the stack keeps running).

> **Using the Cloudflare Tunnel too?** Add `COMPOSE_PROFILES=tunnel` to `.env` so
> the updater keeps managing `cloudflared` alongside the rest of the stack.

> **Private repo?** Set `GIT_PULL_TOKEN` to a GitHub token
> (fine-grained, *Contents: read*). Public repos need nothing.

### ⚠ Security & notes

- The updater talks to the host Docker daemon through a mounted
  `/var/run/docker.sock`, which is **root-equivalent access to the host**. Only
  enable it on a server you control. It's **off by default**.
- The stack/volume identity is auto-detected from the running containers, so the
  updater drives the *same* project (and the *same* `pb_data`) your host started —
  regardless of the folder name. Override with `COMPOSE_PROJECT_NAME` only if you
  know you need to.
- To update the **updater itself** after changing its files, run once by hand:
  `docker compose up -d --build updater`.
- Prefer a host-managed schedule instead of a sidecar? The same effect is a
  one-liner in `cron`/systemd:
  `cd /path/to/dd-bot && git fetch && git reset --hard origin/master && docker compose up -d --build`.

## 🧱 ARM64 / multi-arch

Images build natively for your host arch. To build for an ARM VPS from an x86 machine:

```bash
docker buildx build --platform linux/arm64 -f pocketbase/Dockerfile -t <you>/ddbot-pocketbase .
docker buildx build --platform linux/arm64 -f Dockerfile           -t <you>/ddbot-bot .
docker buildx build --platform linux/arm64 -f web/Dockerfile       -t <you>/ddbot-web .
```

The PocketBase image downloads the correct binary via `TARGETARCH`; Bun images have
official `arm64` variants. All three are verified to build for `linux/amd64` and `linux/arm64`.

## 📋 Commands

| Command | Description |
|---------|-------------|
| `/help` | List all available commands. |
| `/ping` | Check the bot is responsive. |
| `/level [user]` | Show your (or another member's) level, XP and rank. |
| `/levels [page]` | Paginated server XP leaderboard. |
| `/daily` | Claim your daily reward (XP + gold, streak tracking). |
| `/balance [user]` | Check a wallet: gold, streak, best streak, claims, equipped cosmetics. |
| `/shop [category]` | Browse the cosmetics shop (colours, titles, frames, flair). |
| `/buy <item>` | Purchase a cosmetic (autocomplete). |
| `/equip <item>` | Equip an owned cosmetic, or remove one (autocomplete includes unequip options). |
| `/inventory` | View your owned cosmetics and what's equipped. |
| `/reminders <enabled>` | Opt in/out of DM streak reminders (default OFF). |
| `/reactionrole` | Admin: `setup`, `add`, `list`, `edit`, `remove`, `delete` reaction roles. |
| `/leveladmin` | Admin: `setup`, `setreward`, `removereward`, `resetuser`, `enable`, `disable`, `sync`, `migrateroles`, `setlevel`. |

**Button reaction role example:** `/reactionrole setup channel:#roles message_content:"Pick a role!" role:@Gamer button:true label:"Gamer" style:success`

**Classic emoji example:** `/reactionrole setup channel:#roles message_content:"React!" role:@Gamer emoji:🎮`

> ⚠ The cosmetics catalog lives in a single source of truth, [`shared/cosmetics.json`](shared/cosmetics.json), consumed by both the bot (`utils/economy.js`) and the dashboard (`web/src/lib/cosmetics.ts`). Edit it once — do not copy data into either consumer.

## 💻 Local development (without Docker)

Requires [Bun](https://bun.sh/) ≥ 1.4.2 and a PocketBase instance (run one with the bundled image or the
[binary](https://pocketbase.io/docs/)).

```bash
# Bot (repo root — Bun auto-loads .env, no dotenv needed)
bun install
cp .env.example .env          # set POCKETBASE_URL to your PB instance,
                              # and INTERNAL_API_SECRET to enable the dashboard bridge
bun run deploy                # register slash commands
bun run dev                   # start with auto-reload (--watch); the internal API
                              # listens on 127.0.0.1:${BOT_API_PORT:-8787}
bun test                      # run the unit tests (fully offline): leveling math,
                              # economy math/streak/reward, recovery planner, CV2 UI builders,
                              # command contracts

# Admin dashboard (share the SAME INTERNAL_API_SECRET as the bot; point BOT_API_URL at it)
cd web
bun install
POCKETBASE_URL=http://127.0.0.1:8090 ORIGIN=http://localhost:5173 \
  INTERNAL_API_SECRET=<same-as-bot> BOT_API_URL=http://127.0.0.1:8787 \
  POCKETBASE_ADMIN_EMAIL=<superuser-email> POCKETBASE_ADMIN_PASSWORD=<superuser-password> \
  bun run dev
```

> The `POCKETBASE_ADMIN_*` vars power the **public pages** (leaderboard/profile). Without them the
> dashboard still works (login provides its own token), but public routes show a
> "Stats are temporarily unavailable" notice.

> Skip `INTERNAL_API_SECRET` / `BOT_API_URL` to develop the dashboard against PocketBase
> alone — it runs in degraded mode (raw IDs, DB-only edits) with an "bot offline" banner.

## 🗂️ Project structure

```
dd-bot/
├─ index.js               # bot entrypoint (interactions, events, starts internal API)
├─ deploy-commands.js     # registers slash commands (guild or global)
├─ CHANGELOG.md           # notable changes per release (Keep a Changelog format)
├─ commands/              # slash commands (admin/, fun/, utility/)
├─ api/                   # bot's internal HTTP API for the dashboard (names + actions)
├─ utils/                 # pocketbase, leveling, economy (daily/cosmetics), reminders,
│                         # reactionroles, ui (Components V2 kit), levelui, economyui
├─ init/                  # boot-time reaction-role message caching
├─ test/                  # node --test unit tests (leveling, UI builders, command contracts)
├─ pb_migrations/         # PocketBase schema (auto-applied)
├─ pocketbase/            # PocketBase Dockerfile + entrypoint
├─ web/                   # SvelteKit 5 admin dashboard + public site (leaderboard, profiles, privacy)
├─ deploy/updater/        # auto-update sidecar (continuous deployment)
├─ Dockerfile             # bot image
└─ docker-compose.yml     # full stack
```

## 🧰 Built with

- [discord.js](https://discord.js.org/) — Discord API library
- [PocketBase](https://pocketbase.io/) — database & auth
- [SvelteKit](https://svelte.dev/) (Svelte 5) — admin dashboard & public site
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) — optional public access

## 📜 Changelog

All notable changes per release are documented in [CHANGELOG.md](CHANGELOG.md), following the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format. This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 📄 License

MIT — see the [LICENSE](LICENSE) file.
