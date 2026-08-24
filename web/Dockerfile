# SvelteKit admin dashboard — Bun 1.4 native with svelte-adapter-bun.
# Build AND runtime use Bun's JavaScriptCore (JSC) via `bun --bun`, not Node's V8:
# - Vite (Rolldown) JS orchestration runs on Bun (`bun --bun run build` forces JSC
#   instead of the oven/bun image's /usr/local/bun-node-fallback-bin/node shim)
# - Runtime uses `svelte-adapter-bun` which emits a native `Bun.serve` server
#   (uWebSockets) instead of Node's `http.createServer`+`polka` — ~2-3x faster
#   than adapter-node via node:http compat, lower memory, native WebSocket.
FROM oven/bun:1.4-alpine AS build
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .
# Force Bun runtime for Vite (see above)
RUN bun --bun run build

FROM oven/bun:1.4-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV BUN_ENV=production
ENV PORT=3000
# svelte-adapter-bun bundles most deps but keeps `pocketbase` (and others)
# external — retain node_modules for runtime resolution.
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

EXPOSE 3000
USER bun
# Native Bun entry — `svelte-adapter-bun` produces a Bun.serve server.
# `bun --bun` guarantees JSC even though `build/index.js` has `// @bun` header.
CMD ["bun", "--bun", "build/index.js"]
