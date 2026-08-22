<script lang="ts">
	import { page } from '$app/state';
	import { fly } from 'svelte/transition';
	import Avatar from './Avatar.svelte';
	import { formatNumber } from '$lib/leveling';
	import type { GuildDTO } from '$lib/server/bot';

	let { guilds, currentGuildId }: { guilds: GuildDTO[]; currentGuildId: string | null } = $props();

	let open = $state(false);
	const current = $derived(guilds.find((g) => g.id === currentGuildId) ?? null);
	const redirectTo = $derived(page.url.pathname + page.url.search);

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') open = false;
	}
</script>

<svelte:window onkeydown={onKey} />

{#if guilds.length === 0}
	<div class="gs-empty faint">No servers available</div>
{:else}
	<form method="POST" action="/set-guild" class="gs">
		<input type="hidden" name="redirectTo" value={redirectTo} />

		<button
			type="button"
			class="gs-trigger"
			aria-haspopup="listbox"
			aria-expanded={open}
			onclick={() => (open = !open)}
		>
			<Avatar
				src={current?.icon ?? ''}
				name={current?.name ?? '?'}
				seed={current?.id ?? ''}
				rounded="square"
				size={32}
			/>
			<span class="gs-info">
				<span class="gs-label faint">Server</span>
				<span class="gs-name">{current?.name ?? 'Select a server'}</span>
			</span>
			<span class="gs-caret" class:open>▾</span>
		</button>

		{#if open}
			<div
				class="gs-menu"
				role="listbox"
				tabindex="-1"
				in:fly={{ y: -6, duration: 180, delay: 20 }}
				out:fly={{ y: -4, duration: 140 }}
			>
				{#each guilds as g (g.id)}
					<button
						type="submit"
						name="guild_id"
						value={g.id}
						class="gs-item"
						class:sel={g.id === currentGuildId}
						role="option"
						aria-selected={g.id === currentGuildId}
					>
						<Avatar src={g.icon ?? ''} name={g.name} seed={g.id} rounded="square" size={30} />
						<span class="gs-item-name">{g.name}</span>
						<span class="gs-count faint">{formatNumber(g.memberCount)}</span>
					</button>
				{/each}
			</div>
		{/if}
	</form>

	{#if open}
		<button class="gs-backdrop" aria-hidden="true" tabindex="-1" onclick={() => (open = false)}
		></button>
	{/if}
{/if}

<style>
	.gs {
		position: relative;
	}
	.gs-trigger {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		width: 100%;
		padding: 0.5rem 0.6rem;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--bg-inset);
		color: var(--text);
		cursor: pointer;
		text-align: left;
		transition:
			border-color var(--t),
			background var(--t),
			transform var(--t);
	}
	.gs-trigger:hover {
		border-color: var(--border-strong);
		background: var(--bg-hover);
		transform: translateY(-1px);
	}
	.gs-trigger:active {
		transform: translateY(0);
	}
	.gs-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
	}
	.gs-label {
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-weight: 700;
	}
	.gs-name {
		font-weight: 700;
		font-size: 0.92rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.gs-caret {
		color: var(--text-faint);
		transition: transform var(--t);
		flex: 0 0 auto;
	}
	.gs-caret.open {
		transform: rotate(180deg);
	}
	.gs-menu {
		position: absolute;
		left: 0.35rem;
		right: 0.35rem;
		top: calc(100% - 0.35rem);
		z-index: 30;
		max-height: 340px;
		overflow-y: auto;
		padding: 0.35rem;
		background: var(--bg-elev);
		border: 1px solid var(--border-strong);
		border-radius: 12px;
		box-shadow: var(--shadow-lg);
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}
	.gs-item {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.45rem 0.5rem;
		border: none;
		border-radius: 9px;
		background: transparent;
		color: var(--text);
		cursor: pointer;
		text-align: left;
		font-size: 0.88rem;
		transition:
			background var(--t),
			transform var(--t);
	}
	.gs-item:hover {
		background: var(--bg-hover);
	}
	.gs-item:active {
		transform: scale(0.98);
	}
	.gs-item.sel {
		background: var(--accent-grad-soft);
	}
	.gs-item-name {
		flex: 1;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.gs-count {
		font-size: 0.75rem;
	}
	.gs-backdrop {
		position: fixed;
		inset: 0;
		z-index: 20;
		border: none;
		background: transparent;
		cursor: default;
	}

	@media (max-width: 860px) {
		.gs {
			display: flex;
			align-items: center;
			gap: 0.5rem;
		}
		.gs-item {
			padding: 0.4rem 0.45rem;
		}
		.gs-item .gs-count {
			display: none;
		}
		/* sidebar is horizontal; keep switcher compact */
		.gs {
			margin-right: 0.35rem;
		}
	}
</style>
