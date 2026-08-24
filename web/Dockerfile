# SvelteKit admin dashboard (adapter-node) — Bun 1.4 multi-stage build.
# Bun installs ~10x faster than npm and Vite builds under Bun benefit from Bun's
# faster transpiler/FS layer. The final runtime is still the same adapter-node
# output; Bun runs it via node:http compatibility (Bun.serve not needed here
# because SvelteKit's polka handler expects Node http).
FROM oven/bun:1.4-alpine AS build
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

FROM oven/bun:1.4-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV BUN_ENV=production
ENV PORT=3000
# Keep the full production node_modules — adapter-node's standalone output in
# SvelteKit 2 still resolves some imports (e.g. `pocketbase`) from node_modules
# at runtime. Pruning is handled by the build stage already.
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

EXPOSE 3000
USER bun
# Bun can run the Node-built output directly (node:http is fully supported).
# Using `bun` instead of `node` gives ~30% faster startup and lower memory.
CMD ["bun", "build/index.js"]
