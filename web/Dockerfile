# SvelteKit 3 admin dashboard + public site — Bun 1.4.4 native with the official
# @sveltejs/adapter-bun (Bun.serve + Bun.file, multi-arch amd64/arm64).
# Context is repo root (see docker-compose.yml) so shared/cosmetics.json is available.
FROM oven/bun:1.4.4-alpine AS build
WORKDIR /app

# web deps (context = repo root, so prefix with web/)
COPY web/package.json web/bun.lock* ./
# Bun 1.4.4: download everything into the cache in its own layer, so editing the
# source never re-downloads dependencies.
RUN bun pm fetch

# web source
COPY web/. .
# shared catalog — single source (shared/cosmetics.json) lives at /shared for the
# relative import `../../../shared/cosmetics.json` from src/lib/cosmetics.ts
COPY shared /shared
RUN bun install --offline --frozen-lockfile

# SvelteKit 3 replaced adapter-node's runtime ORIGIN env var with the build-time
# `paths.origin` option. docker compose forwards ORIGIN here so the dashboard keeps
# working at whatever URL it is opened from (http://localhost:3000 locally, the
# public https origin behind the tunnel). Empty = derive it from the Host header.
# Declared *after* the dependency layers on purpose: changing ORIGIN only re-runs
# the build below instead of re-installing packages.
ARG ORIGIN=
ENV ORIGIN=$ORIGIN

# The adapter runs Bun.build, so the build itself must run under Bun.
RUN bun run build

FROM oven/bun:1.4.4-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV BUN_ENV=production
ENV PORT=3000
# Mirror the build-time origin at runtime too, so a plain `docker run` of this
# image makes the same Secure-cookie decision as the deployed stack.
ARG ORIGIN=
ENV ORIGIN=$ORIGIN
# @sveltejs/adapter-bun defaults to a 512K request body; the /pb/* proxy forwards
# PocketBase admin uploads (icons, backups), so allow more.
ENV BODY_SIZE_LIMIT=20M

# The adapter bundles `dependencies` into the server output (pocketbase is a
# devDependency on purpose), so no node_modules are needed at runtime.
COPY --from=build --chown=bun:bun /app/build ./build
COPY --from=build --chown=bun:bun /app/package.json ./package.json

EXPOSE 3000
USER bun
# `bun ./build` runs the generated Bun.serve entrypoint (build/index.js).
CMD ["bun", "./build"]
