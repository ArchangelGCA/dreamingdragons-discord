# dd-bot — web

SvelteKit 3 + Svelte 5 dashboard and public site for [dd-bot](../README.md).

Run everything from this directory:

```sh
bun install
bun run dev        # vite dev (default: http://localhost:5173)
bun run check      # svelte-check — 0 errors expected
bun run build      # production build → build/ (Bun.serve entrypoint)
bun run format     # bun fmt (config in bunfig.toml)
```

See the [root README](../README.md) for configuration (`ORIGIN`, `POCKETBASE_*`,
`INTERNAL_API_SECRET`), Docker deployment and the ARM64 notes, and
[`../AGENTS.md`](../AGENTS.md) for architecture and gotchas.

> Environment variables are declared and validated in [`src/env.ts`](src/env.ts)
> and imported from `$app/env/private`. `ORIGIN` is baked into the build
> (`paths.origin`) — in Docker it is passed as a build arg, so changing it
> requires rebuilding the image.
