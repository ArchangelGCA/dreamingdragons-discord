<script lang="ts">
	import { theme, setTheme, type Theme } from '$lib/theme.svelte';

	const options: { value: Theme; label: string; icon: string }[] = [
		{ value: 'system', label: 'System', icon: '🖥️' },
		{ value: 'light', label: 'Light', icon: '☀️' },
		{ value: 'dark', label: 'Dark', icon: '🌙' }
	];
</script>

<div class="theme-toggle" role="group" aria-label="Theme">
	{#each options as o (o.value)}
		<button
			type="button"
			class:active={theme.value === o.value}
			title={o.label}
			aria-pressed={theme.value === o.value}
			onclick={() => setTheme(o.value)}
		>
			<span aria-hidden="true">{o.icon}</span>
		</button>
	{/each}
</div>

<style>
	.theme-toggle {
		display: flex;
		gap: 0.15rem;
		padding: 0.2rem;
		border-radius: 10px;
		background: var(--bg-inset);
		border: 1px solid var(--border);
	}
	.theme-toggle button {
		flex: 1;
		display: grid;
		place-items: center;
		padding: 0.35rem;
		border: none;
		border-radius: 7px;
		background: transparent;
		cursor: pointer;
		font-size: 0.95rem;
		filter: grayscale(0.5);
		opacity: 0.7;
		transition: background var(--t), opacity var(--t), filter var(--t);
	}
	.theme-toggle button:hover {
		opacity: 1;
	}
	.theme-toggle button.active {
		background: var(--bg-elev);
		box-shadow: var(--shadow-sm);
		opacity: 1;
		filter: none;
	}
</style>
