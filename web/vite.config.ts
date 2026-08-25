import adapter from 'svelte-adapter-bun';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) => filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		})
	],
	// Allow importing the shared catalog (../shared/cosmetics.json) which lives
	// outside the SvelteKit root (web/). Both Vite dev and `vite build` need it.
	server: {
		fs: {
			allow: ['..']
		}
	}
});
