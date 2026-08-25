# dd-bot Discord bot image — Bun 1.4 (multi-arch: linux/amd64 + linux/arm64)
FROM oven/bun:1.4-alpine

ENV NODE_ENV=production
ENV BUN_ENV=production
WORKDIR /app
# /app is created by WORKDIR as root; hand it to the unprivileged bun user (oven/bun image).
RUN chown bun:bun /app
USER bun

# Install production dependencies first (better layer caching).
# Bun 1.4 uses a plain-text bun.lock (committed). The wildcard covers both the new
# text lockfile (bun.lock) and any legacy binary lockfile (bun.lockb) during migration.
COPY --chown=bun:bun package.json bun.lock* ./
RUN bun install --frozen-lockfile --production && bun pm cache rm || true

# Copy bot source (+ shared catalog — single source for cosmetics).
COPY --chown=bun:bun index.js deploy-commands.js ./
COPY --chown=bun:bun commands ./commands
COPY --chown=bun:bun utils ./utils
COPY --chown=bun:bun api ./api
COPY --chown=bun:bun init ./init
COPY --chown=bun:bun shared ./shared

# Deploys slash commands then starts the bot (see package.json "start").
CMD ["bun", "run", "start"]
