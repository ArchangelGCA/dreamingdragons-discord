<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		kind = 'info',
		children
	}: { kind?: 'info' | 'warn' | 'error'; children: Snippet } = $props();

	const icon = { info: 'ℹ️', warn: '⚠️', error: '⛔' } as const;
</script>

<div class="banner {kind}">
	<span class="icon">{icon[kind]}</span>
	<div class="content">{@render children()}</div>
</div>

<style>
	.banner {
		display: flex;
		gap: 0.65rem;
		align-items: flex-start;
		padding: 0.8rem 1rem;
		border-radius: var(--radius-sm);
		margin-bottom: 1rem;
		font-size: 0.9rem;
		border: 1px solid var(--border);
		background: var(--bg-elev);
	}
	.banner.info {
		background: var(--accent-grad-soft);
		border-color: color-mix(in srgb, var(--accent) 35%, transparent);
	}
	.banner.warn {
		background: rgba(245, 158, 11, 0.12);
		border-color: rgba(245, 158, 11, 0.4);
	}
	.banner.error {
		background: rgba(239, 68, 68, 0.12);
		border-color: rgba(239, 68, 68, 0.4);
	}
	.icon {
		flex: 0 0 auto;
		line-height: 1.5;
	}
	.content {
		min-width: 0;
	}
</style>
