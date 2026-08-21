<script lang="ts">
	import { safeColor } from '$lib/format';

	let {
		name = null,
		color = null,
		id = ''
	}: { name?: string | null; color?: string | null; id?: string } = $props();

	const dot = $derived(safeColor(color, 'var(--text-faint)'));
</script>

{#if name}
	<span class="role-pill" style="--role:{dot}">
		<span class="role-dot"></span>
		<span class="role-name">{name}</span>
	</span>
{:else if id}
	<code>{id}</code>
{:else}
	<span class="faint">—</span>
{/if}

<style>
	.role-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.16rem 0.6rem 0.16rem 0.5rem;
		border-radius: var(--pill);
		font-size: 0.82rem;
		font-weight: 600;
		max-width: 100%;
		background: color-mix(in srgb, var(--role) 13%, transparent);
		border: 1px solid color-mix(in srgb, var(--role) 32%, transparent);
		color: color-mix(in srgb, var(--role) 62%, var(--text));
	}
	.role-dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--role);
		flex: 0 0 auto;
		box-shadow: 0 0 6px color-mix(in srgb, var(--role) 60%, transparent);
	}
	.role-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
