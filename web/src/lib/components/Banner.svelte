<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		kind = 'info',
		children
	}: { kind?: 'info' | 'warn' | 'error'; children: Snippet } = $props();
</script>

<div class="banner {kind}">
	<span class="icon">{kind === 'error' ? '⛔' : kind === 'warn' ? '⚠️' : 'ℹ️'}</span>
	<div>{@render children()}</div>
</div>

<style>
	.banner {
		display: flex;
		gap: 0.6rem;
		align-items: flex-start;
		padding: 0.7rem 1rem;
		border-radius: 8px;
		margin-bottom: 1rem;
		font-size: 0.9rem;
		border: 1px solid var(--border);
	}
	.banner.warn {
		background: rgba(240, 178, 50, 0.12);
		border-color: rgba(240, 178, 50, 0.4);
	}
	.banner.error {
		background: rgba(242, 63, 67, 0.12);
		border-color: rgba(242, 63, 67, 0.4);
	}
	.icon {
		flex: 0 0 auto;
	}
</style>
