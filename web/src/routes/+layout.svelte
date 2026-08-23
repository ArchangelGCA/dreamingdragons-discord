<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import GuildSwitcher from '$lib/components/GuildSwitcher.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import Toasts from '$lib/components/Toasts.svelte';
	import { pushToast } from '$lib/toast.svelte';

	let { data, children } = $props();

	const nav = [
		{ href: '/dashboard', label: 'Dashboard', icon: '📊' },
		{ href: '/leveling', label: 'Leveling', icon: '📈' },
		{ href: '/reaction-roles', label: 'Reaction Roles', icon: '🏷️' },
		{ href: '/users', label: 'Users', icon: '👥' }
	];

	// Surface form action results (success/error) as toasts, once each.
	// `page.form` persists after an action and the effect can re-run on every
	// `invalidateAll()` (triggered by use:enhance `update()`), so guard against
	// re-toasting the same result object — otherwise a single submit produces a
	// burst of duplicate toasts.
	let lastForm: unknown = null;
	$effect(() => {
		const f = page.form as { success?: unknown; error?: unknown } | null;
		if (!f || f === lastForm) return;
		lastForm = f;
		if (typeof f.success === 'string') pushToast('success', f.success);
		else if (typeof f.error === 'string') pushToast('error', f.error);
	});

	// Public pages (under the (public) route group) use their own shell — even
	// for logged-in admins, so the public site looks exactly like what visitors see.
	const isPublicRoute = $derived(page.route.id?.startsWith('/(public)') ?? false);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>dd-bot admin</title>
</svelte:head>

{#if isPublicRoute}
	{@render children()}
	<Toasts />
{:else if data.admin}
	<div class="app">
		<aside class="sidebar">
			<div class="brand">
				<span class="brand-mark">🐉</span>
				<span>dd-bot</span>
			</div>

			{#if data.guild}
				<GuildSwitcher guilds={data.guild.guilds} currentGuildId={data.guild.currentGuildId} />
				<div class="bot-status" class:online={data.guild.botOnline}>
					<span class="dot"></span>
					{data.guild.botOnline ? 'Bot online' : 'Bot offline'}
				</div>
			{/if}

			<nav class="nav">
				{#each nav as item (item.href)}
					{@const active = page.url.pathname === item.href}
					<a href={item.href} class:active aria-current={active ? 'page' : undefined}>
						<span class="nav-icon">{item.icon}</span>
						{item.label}
					</a>
				{/each}
			</nav>

			<div class="spacer"></div>

			<div class="sidebar-divider"></div>
			<a class="btn ghost block" href="/" rel="noreferrer">🌐 View public site</a>
			<a class="btn ghost block" href="/pb/_/" target="_blank" rel="noreferrer">🗄️ PocketBase</a>
			<ThemeToggle />
			<div class="user-chip">
				<Avatar name={data.admin.email} seed={data.admin.email} size={26} />
				<span class="who">{data.admin.email}</span>
			</div>
			<form method="POST" action="/logout">
				<button class="btn secondary block">Log out</button>
			</form>
		</aside>

		<main class="main">
			<!-- Keyed on the URL so SvelteKit page swaps animate in on route/query change -->
			{#key page.url.href}
				<div class="page">
					{@render children()}
				</div>
			{/key}
		</main>
	</div>
	<Toasts />
{:else}
	{@render children()}
	<Toasts />
{/if}
