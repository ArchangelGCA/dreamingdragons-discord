<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';

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
