<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import GuildSwitcher from '$lib/components/GuildSwitcher.svelte';

	let { data, children } = $props();

	const nav = [
		{ href: '/', label: 'Dashboard', icon: '📊' },
		{ href: '/leveling', label: 'Leveling', icon: '📈' },
		{ href: '/reaction-roles', label: 'Reaction Roles', icon: '🏷️' },
		{ href: '/users', label: 'Users', icon: '👥' }
	];
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>dd-bot admin</title>
</svelte:head>

{#if data.admin}
	<div class="app">
		<aside class="sidebar">
			<div class="brand">🐉 dd-bot</div>

			{#if data.guild}
				<GuildSwitcher guilds={data.guild.guilds} currentGuildId={data.guild.currentGuildId} />
				<div class="bot-status" class:online={data.guild.botOnline}>
					<span class="dot"></span>
					{data.guild.botOnline ? 'Bot online' : 'Bot offline'}
				</div>
			{/if}

			<nav>
				{#each nav as item (item.href)}
					<a href={item.href} class:active={page.url.pathname === item.href}>
						{item.icon}&nbsp; {item.label}
					</a>
				{/each}
			</nav>
			<div class="spacer"></div>
			<div class="muted" style="font-size:0.75rem;padding:0 0.5rem 0.5rem">
				{data.admin.email}
			</div>
			<form method="POST" action="/logout">
				<button class="btn secondary" style="width:100%">Log out</button>
			</form>
		</aside>
		<main class="main">
			{@render children()}
		</main>
	</div>
{:else}
	{@render children()}
{/if}

<style>
	.bot-status {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.75rem;
		color: var(--text-muted);
		padding: 0 0.6rem 0.75rem;
	}
	.bot-status .dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--red);
	}
	.bot-status.online .dot {
		background: var(--green);
	}
</style>
