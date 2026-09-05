# SvelteKit admin/dashboard + public site — Bun 1.4.2 native with svelte-adapter-bun.
# Build AND runtime use Bun's JavaScriptCore (JSC) via `bun --bun`, not Node's V8.
# Context is repo root (see docker-compose.yml) so shared/cosmetics.json is available.
FROM oven/bun:1.4.2-alpine AS build
WORKDIR /app

# web deps (context = repo root, so prefix with web/)
COPY web/package.json web/bun.lock* ./
RUN bun install --frozen-lockfile

# web source
COPY web/. .
# shared catalog — single source (shared/cosmetics.json) lives at /shared for the
# relative import `../../../shared/cosmetics.json` from src/lib/cosmetics.ts
COPY shared /shared
# Force Bun runtime for Vite (see above)
RUN bun --bun run build

FROM oven/bun:1.4.2-alpine
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
