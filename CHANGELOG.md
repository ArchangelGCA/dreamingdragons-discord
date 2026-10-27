# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] – 2026-10-27

Major toolchain upgrade: **Bun 1.4.4** and **SvelteKit 3** (dashboard + public site). Bot behaviour is unchanged.

### Changed

- **Runtime: Bun 1.4.2 → 1.4.4** (`engines` in both `package.json` files, and `oven/bun:1.4.4-alpine` in both Dockerfiles — still multi-arch amd64/arm64). Bun 1.4.4 ships a libc-aware Linux installer (musl builds for Alpine) and a `ws` rewrite that matches ws 8.22.0, which discord.js uses for the gateway.
- **Dashboard: SvelteKit 2 → 3.** Applied with `sv migrate sveltekit-3` plus manual follow-ups:
  - **Adapter:** community `svelte-adapter-bun@1.0.2` (peer `@sveltejs/kit ^2`) → official **`@sveltejs/adapter-bun@1.0.0`** (peer `@sveltejs/kit ^3`), which serves through `Bun.serve`/`Bun.file`.
  - **Vite 8** (`^8.3.5`), `@sveltejs/vite-plugin-svelte` 7, `svelte` 5.57, `svelte-check` 4.7, TypeScript 6.0 (7 is not usable yet — `svelte-check` peers on `^5 || ^6`), `pocketbase` 0.28.1.
  - **`ORIGIN` is now a build-time value** (`paths.origin`): SvelteKit 3 dropped adapter-node's runtime `ORIGIN`. `docker-compose.yml` forwards `ORIGIN` as a build arg, so the documented "must match the URL you open the dashboard from" contract still holds — but changing it now requires `docker compose up -d --build web`. A trailing slash is normalized away; a real path/query (e.g. `https://host/admin`) fails the build with SvelteKit's `config_origin_has_path` error. The runtime env var is kept for the `Secure` cookie flag.
  - **Explicit env vars:** new `web/src/env.ts` declares/validates every variable once with `defineEnvVars`; consumers import from `$app/env/private` instead of `$env/dynamic/private`. Malformed URLs now fail fast at startup.
  - **Imports:** `$lib` → the `#lib/*` package-imports map (`web/package.json`); `$app/environment` → `$app/env`; `Handle`/`HandleServerError` now come from `@sveltejs/kit/hooks`, `SubmitFunction` from `$app/forms`.
  - **`page.url` is readonly:** the shop's filter/sort URL sync now copies with `new URL(page.url.href)`, and `replaceState` was replaced by `goto(url, { shallow: true, replace: true })`.
  - **Enhanced forms** now use the `fail()` status code and navigate when the action lives on another page; audited every form — all target the current page (`?/action`), and the guild switcher is a plain POST.
  - Added `handleError` in `hooks.server.ts` (logs unexpected errors only, keeps SvelteKit's default status/message).
- **Docker images:** both Dockerfiles now use `bun pm fetch` in its own layer followed by `bun install --offline --frozen-lockfile`, so editing source never re-downloads dependencies. In `web/Dockerfile` the `ORIGIN` build arg is declared *after* those layers, so a changed `ORIGIN` only re-runs the build (~8 s) instead of reinstalling packages. The web runtime image copies only `build/` + `package.json` — no `node_modules` at runtime, because the adapter bundles `pocketbase` (moved to `devDependencies`).
- **New `BODY_SIZE_LIMIT` setting** (default `20M`, configurable in `.env`): `@sveltejs/adapter-bun` defaults to a 512K request body, which would break PocketBase admin uploads proxied through `/pb/*`.
- **Formatting:** added **`bun fmt`** (Bun 1.4.4's built-in Prettier-compatible formatter) scoped to `web/` via `web/bunfig.toml`, with `bun run format` / `format:check` scripts. The whole `web/` tree was reformatted once (mechanical diff only). The bot source is untouched to avoid churn.
- README/AGENTS: Bun 1.4.4, SvelteKit 3, official Bun adapter, `#lib` imports, `bun fmt`, the build-time `ORIGIN` caveat, and the `BODY_SIZE_LIMIT` variable.

### Fixed

- **Dashboard / Docker:** the web image no longer depends on `node_modules` being present at runtime (previously a latent failure mode with the community adapter), and `bun install` inside the image is now fully offline/reproducible.
- **Dashboard / env:** a malformed `POCKETBASE_URL`, `BOT_API_URL` or `ORIGIN` is reported with a clear message at boot instead of failing later inside a request.

## [0.1.6] – 2026-09-07

### Security

- **Bot / admin commands:** `/leveladmin` and `/reactionrole` now enforce the Administrator permission at runtime. Previously they relied solely on `setDefaultMemberPermissions`, which server admins can loosen per role/channel. `/leveladmin` is also guild-only now (`setContexts(Guild)` + `inGuild()` guard) and `/leveladmin setlevel` caps at the new max level.
- **Bot / leveling:** user-supplied XP/level values are now clamped (`MAX_LEVEL = 1000`, `MAX_XP ≈ 1.27B`) in `utils/levelservice.js`. The level curve loops once per level, so a huge value (via dashboard, internal API or `/leveladmin setlevel`) could hang the bot in a long loop (CPU DoS). The dashboard (`users` actions) applies the same ceilings.
- **Bot / economy:** `/buy` and `/equip` are now serialized per (guild, user) with the existing claim lock. Two concurrent purchases could both pass the gold check and overspend (double-spend); concurrent equips could clobber the equipped map.
- **Bot / reaction panels:** panel title/description lengths are validated up front in `utils/reactionservice.js` (title ≤ 256, description ≤ 4000 chars, matching Discord limits) for both the slash command and dashboard paths, instead of failing at send time. `parseColorHex`/`panelDescription` now coerce non-string input instead of throwing on malformed API payloads.
- **Dashboard / login:** the superuser sign-in now has its own rate limit (10 attempts per 5 min per IP) plus a small delay on failure, slowing online password guessing. The public-page limiter additionally has a global ceiling so rotating `cf-connecting-ip`/`x-forwarded-for` headers can't bypass it unboundedly.
- **Dashboard / hardening:** every response now carries `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY` and a minimal `Permissions-Policy`; the `dd_guild` cookie gets the `Secure` flag on HTTPS origins (matching the auth cookie); the bot bridge tolerates non-JSON replies instead of throwing into page loads; deleting a level reward now verifies the record belongs to the current guild.
- **Internal API:** `leveling/settings` rejects malformed `notification_channel_id` (must be a channel ID or empty) and `/cache/invalidate` validates `guildId`/`userId` formats instead of accepting arbitrary strings.
- **Updater / tooling:** `deploy/updater/update.sh` validates `AUTO_UPDATE_INTERVAL` (falls back to 300s, clamps to a 30s minimum) so a bad value can't turn the poll loop into a busy git-fetch hammer; `deploy-commands.js` exits early with a clear error when `DISCORD_BOT_TOKEN` is unset.

## [0.1.5] – 2026-09-05

### Changed

- Upgraded the runtime from Bun 1.4.0 to **Bun 1.4.2**: `engines` in `package.json` and `web/package.json` now require `bun >= 1.4.2`, and both Docker images (`Dockerfile`, `web/Dockerfile`) are pinned to `oven/bun:1.4.2-alpine` (multi-arch amd64/arm64). Local toolchain already runs 1.4.2.
- Documented the new Bun 1.4.1 `bun install --offline` / `--prefer-offline` modes (and their `bunfig.toml` equivalents) as opt-in comments — left off by default so fresh clones and CI can still fetch dependencies.
- README: local-development section now describes Bun (was stale Node.js/npm), runtime badge tracks Bun ≥ 1.4.2, ARM build example for `web/` uses the repo-root context, and the cosmetics note points at the single source of truth (`shared/cosmetics.json`).

### Fixed

- Via the Bun 1.4.2 runtime (no code changes needed):
  - Discord gateway stability — fixed `worker_threads` `'online'` event ordering that could hang `@discordjs/ws` (used by discord.js v14 for the gateway).
  - Alpine/musl GC crash when shrinking object arrays — hardens both Docker images.
  - `AsyncLocalStorage` memory leak regression introduced in 1.4.1 (timers/promises created in `store.exit()` / nested `run()` kept the outer store alive).
  - `bun build` variable-name collision that broke Elysia-style bundles.
  - `.json()` on `Response`/`Blob`/`Bun.file()` now rejects with the real `SyntaxError` message instead of a generic `Failed to parse JSON`.
  - `bun install` / `bun add` panic on mismatched cached package-name hashes.

### Performance

- Automatic gains from Bun 1.4.1/1.4.2 for the long-running bot and dashboard: lower idle memory (JSC discards idle JIT code), faster startup, lazily-loaded `node:` builtins, faster first HTTPS request, ~2× faster `AsyncLocalStorage`, and up to 9× faster `Buffer` reads/writes (used in the internal API's auth check and body handling).
- Evaluated but deliberately **not** enabled: HTTP/2 in `Bun.serve` (the internal API is cleartext Docker-network HTTP; TLS terminates at the Cloudflare Tunnel), `Bun.write()` response streaming (no large file downloads in the codebase), `WebSocket` `pause()`/`resume()` (the gateway is managed by discord.js), and `crypto.argon2` (auth is handled by PocketBase).

## [0.1.4] – 2026-08-31

### Added

- `CHANGELOG.md` (this file), following the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format, plus a pointer to it in the README.

### Fixed

- **Web / Shop:** the preview card's XP bar shimmer now has a smooth ending — the highlight sweep is sized to the whole bar and fully exits before the animation loops, instead of abruptly vanishing mid-sweep at the end of every cycle (it was previously sized to the bar's fill, so a partially visible highlight teleported back to the start).

## [0.1.3] – 2026-08-31

### Changed

- Removed excessive text from the shop page.
- The shop's live preview card now scrolls with the user so it is always visible (desktop only).
- Internal frontend changes.

## [0.1.2] – 2026-08-25

### Changed

- Centralised shop configuration — the cosmetics catalog has a single source of truth (`shared/cosmetics.json`) consumed by both the bot and the dashboard.
- Internal changes.

## [0.1.1] – 2026-08-25

### Fixed

- `/shop` command now features pagination.

## [0.1.0] – 2026-08-24

### Added

- New cosmetics and enhancements to the shop and daily rewards.
- Experimental Bun 1.4 migration (Bun replaces Node/npm for running, testing and deployment).
- Everything between v0.0.3 and this release, including the full bot rework: new libraries and commands, an admin-only SvelteKit dashboard, a public website, and easy Docker Compose deployment (shipped 2026-08-20…2026-08-21 without a version bump).

## [0.0.3] – 2025-11-25

### Changed

- Improved handling for failing Discord logins and PocketBase connection issues.
- Upgraded packages.

### Removed

- DeviantArt feed reader and its commands.

## [0.0.2] – 2025-04-20

### Changed

- MIT license declared in `package.json`.
- Caching and refresh issues with `pocketbase.js` — attempted fixes.

## [0.0.1] – 2025-04-08

### Added

- Initial release.

[Unreleased]: https://github.com/ArchangelGCA/dreamingdragons-discord/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/ArchangelGCA/dreamingdragons-discord/compare/v0.1.6...v0.2.0
[0.1.6]: https://github.com/ArchangelGCA/dreamingdragons-discord/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/ArchangelGCA/dreamingdragons-discord/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/ArchangelGCA/dreamingdragons-discord/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/ArchangelGCA/dreamingdragons-discord/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/ArchangelGCA/dreamingdragons-discord/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/ArchangelGCA/dreamingdragons-discord/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/ArchangelGCA/dreamingdragons-discord/compare/v0.0.3...v0.1.0
[0.0.3]: https://github.com/ArchangelGCA/dreamingdragons-discord/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/ArchangelGCA/dreamingdragons-discord/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/ArchangelGCA/dreamingdragons-discord/releases/tag/v0.0.1
