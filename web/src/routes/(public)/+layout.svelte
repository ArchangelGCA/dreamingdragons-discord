<script lang="ts">
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';
	import Avatar from '$lib/components/Avatar.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	let { data, children } = $props();

	const pub = $derived(data.pub);
	const siteName = $derived(pub?.guild?.name ?? 'DreamingDragons');

	/** Keep the ?g= guild selection while navigating between public pages. */
	function hrefFor(path: string): string {
		const g = pub?.guild?.id;
		const multi = (pub?.guilds?.length ?? 0) > 1;
		return multi && g ? `${path}?g=${g}` : path;
	}

	const links = [
		{ path: '/', label: 'Home' },
		{ path: '/leaderboard', label: 'Leaderboard', icon: '🏆' },
		{ path: '/privacy', label: 'Privacy' }
	];
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="description" content="{siteName} — community leaderboard and stats, powered by the dd-bot leveling system." />
</svelte:head>

<div class="pub">
	<header class="pub-nav">
		<a class="pub-brand" href={hrefFor('/')}>
			{#if pub?.guild?.icon}
				<Avatar src={pub.guild.icon} name={siteName} seed={pub.guild.id} size={30} rounded="square" />
			{:else}
				<span class="pub-mark">🐉</span>
			{/if}
			<span class="pub-name">{siteName}</span>
		</a>

		<nav class="pub-links">
			{#each links as l (l.path)}
				{@const active = page.url.pathname === l.path}
				<a href={hrefFor(l.path)} class:active aria-current={active ? 'page' : undefined}>{l.label}</a>
			{/each}
		</nav>

		<div class="pub-tools">
			<ThemeToggle />
			<a class="btn secondary small" href="/dashboard" title="Admin area">⚙️ Admin</a>
		</div>
	</header>

	<main class="pub-main">
		{@render children()}
	</main>

	<footer class="pub-footer">
		<div class="muted small">
			Powered by the dd-bot leveling system · Stats come from public server activity ·
			<a href={hrefFor('/privacy')}>Privacy</a>
		</div>
		<div class="faint tiny">Not affiliated with Discord Inc.</div>
	</footer>
</div>

<style>
	.pub {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}
	.pub-nav {
		position: sticky;
		top: 0;
		z-index: 40;
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.6rem clamp(0.9rem, 4vw, 2rem);
		background: color-mix(in srgb, var(--bg-elev) 82%, transparent);
		backdrop-filter: blur(10px);
		border-bottom: 1px solid var(--border);
	}
	.pub-brand {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		font-weight: 800;
		font-size: 1.05rem;
		color: var(--text);
		min-width: 0;
	}
	.pub-brand:hover {
		text-decoration: none;
	}
	.pub-mark {
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border-radius: 9px;
		background: var(--accent-grad);
		box-shadow: var(--accent-glow);
	}
	.pub-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 32vw;
	}
	.pub-links {
		display: flex;
		gap: 0.2rem;
		margin-left: 0.25rem;
	}
	.pub-links a {
		padding: 0.45rem 0.75rem;
		border-radius: 9px;
		color: var(--text-muted);
		font-weight: 600;
		font-size: 0.92rem;
		transition:
			background var(--t),
			color var(--t);
	}
	.pub-links a:hover {
		background: var(--bg-hover);
		color: var(--text);
		text-decoration: none;
	}
	.pub-links a.active {
		color: var(--accent-soft);
		background: var(--accent-grad-soft);
	}
	.pub-tools {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.pub-main {
		flex: 1;
		width: 100%;
		max-width: 780px;
		margin: 0 auto;
		padding: clamp(1.25rem, 4vw, 2.5rem) clamp(0.9rem, 4vw, 1.5rem) 3rem;
	}
	.pub-footer {
		padding: 1.5rem 1rem 2rem;
		text-align: center;
		display: grid;
		gap: 0.2rem;
		border-top: 1px solid var(--border);
	}
	.small {
		font-size: 0.82rem;
	}
	.tiny {
		font-size: 0.72rem;
	}

	@media (max-width: 640px) {
		.pub-name {
			max-width: 34vw;
		}
		.pub-nav {
			gap: 0.5rem;
			flex-wrap: wrap;
		}
		.pub-links {
			order: 3;
			width: 100%;
			justify-content: center;
		}
		.pub-links a {
			padding: 0.5rem 0.6rem;
		}
	}
</style>
