import adapter from '@sveltejs/adapter-bun';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

/**
 * The canonical origin, baked into the build (SvelteKit 3 `paths.origin`).
 * Trailing slashes are stripped to match `ORIGIN`'s runtime handling in
 * `src/env.ts`; anything else invalid (a path, query, missing scheme…) is left
 * for SvelteKit to reject with its own `config_origin_has_path` error.
 */
function buildOrigin(): string | undefined {
	const raw = (process.env.ORIGIN ?? '').trim().replace(/\/+$/, '');
	return raw || undefined;
}

export default defineConfig(({ command }) => ({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// Official SvelteKit 3 Bun adapter: Bun.serve + Bun.file for assets.
			adapter: adapter(),
			paths: {
				// SvelteKit 3 removed adapter-node's runtime `ORIGIN` env var in favour of
				// this build-time option. We keep the documented behaviour by baking the
				// ORIGIN that docker compose passes in as a build arg (see web/Dockerfile).
				// When unset, the adapter derives the origin from the Host header and
				// assumes https — which is exactly right behind the Cloudflare Tunnel.
				// Ignored in dev so `vite dev` keeps using the request's real origin.
				origin: command === 'build' ? buildOrigin() : undefined
			}
		})
	],
	// Allow importing the shared catalog (../shared/cosmetics.json) which lives
	// outside the SvelteKit root (web/). Both Vite dev and `vite build` need it.
	server: {
		fs: {
			allow: ['..']
		}
	}
}));
