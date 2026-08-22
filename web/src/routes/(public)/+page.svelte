<script lang="ts">
	import Avatar from '$lib/components/Avatar.svelte';
	import { anonymize } from '$lib/format';
	import { formatNumber } from '$lib/leveling';
	import { animateIn } from '$lib/actions/animate';

	let { data } = $props();

	const pub = $derived(data.pub);
	const home = $derived(data.home);
	const guild = $derived(pub.guild);
	const siteName = $derived(guild?.name ?? 'this community');
	const medals = ['🥇', '🥈', '🥉'];
	const gParam = $derived(pub.guild && pub.guilds.length > 1 ? `?g=${pub.guild.id}` : '');

	function profileHref(userId: string): string {
		return gParam ? `/u/${userId}${gParam}` : `/u/${userId}`;
	}
</script>

<svelte:head>
	<title>{siteName} — Community stats</title>
	<meta property="og:title" content="{siteName} — Community" />
	<meta property="og:description" content="Live leaderboard and member stats for {siteName}." />
	{#if guild?.icon}<meta property="og:image" content={guild.icon} />{/if}
</svelte:head>

<section class="hero card">
	{#if guild}
		<Avatar src={guild.icon ?? ''} name={siteName} seed={guild.id} rounded="square" size={76} />
	{:else}
		<span class="hero-mark">🐉</span>
	{/if}
	<div class="hero-text">
		<h1>{guild?.name ?? 'Welcome!'}</h1>
		<p class="muted">
			This is the public stats page of <strong>{siteName}</strong>'s Discord community —
			members earn XP by chatting and climb the leaderboard.
		</p>
		<div class="hero-cta">
			<a class="btn" href="/leaderboard{gParam}">🏆 View the leaderboard</a>
		</div>
	</div>
</section>

{#if !guild}
	<div class="alert error">Community stats are not available right now — come back soon!</div>
{:else if !home}
	<div class="alert error">Stats are temporarily unavailable. Please try again later.</div>
{:else}
	{@const stats = home.stats}
	{@const top = home.top}

	<div class="grid section" use:animateIn>
		<div class="card stat">
			<span class="stat-num">{formatNumber(stats.leveledMembers)}</span>
			<span class="stat-label">🏆 ranked members</span>
		</div>
		<div class="card stat">
			<span class="stat-num">{formatNumber(stats.rewardRoles)}</span>
			<span class="stat-label">🎁 level rewards</span>
		</div>
		{#if guild.memberCount != null}
			<div class="card stat">
				<span class="stat-num">{formatNumber(guild.memberCount)}</span>
				<span class="stat-label">👥 server members</span>
			</div>
		{/if}
	</div>

	{#if !stats.levelingEnabled}
		<div class="alert">⏸️ Leveling is paused right now — check back later.</div>
	{:else if top.length > 0}
		<section class="section" use:animateIn={{ delay: 80 }}>
			<h2>✨ Most active members</h2>
			<div class="podium">
				{#each top as u, i (u.userId)}
					{@const name = u.name ?? anonymize(u.userId)}
					<a class="card card-hover podium-card" class:first={i === 0} href={profileHref(u.userId)}>
						<span class="medal">{medals[i]}</span>
						<Avatar src={u.avatar ?? ''} {name} seed={u.userId} size={54} />
						<span class="p-name">{name}</span>
						<span class="lvl-chip">Lv {u.level}</span>
						<span class="faint">{formatNumber(u.xp)} XP</span>
					</a>
				{/each}
			</div>
		</section>
	{/if}

	<div class="card info" use:animateIn={{ delay: 140 }}>
		<h2>🔎 Where am I?</h2>
		<p class="muted">
			In Discord, run <code>/level</code> to see your rank card — it links straight to your
			public stats page. Curious about the data behind it? Everything about your entry is
			shown there, and our <a href="/privacy">privacy page</a> explains what we store
			(spoiler: not much) and how to have it deleted.
		</p>
	</div>
{/if}

<style>
	.hero {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		padding: clamp(1.4rem, 4vw, 2.2rem);
		margin-bottom: 1.75rem;
	}
	.hero-mark {
		display: grid;
		place-items: center;
		width: 76px;
		height: 76px;
		border-radius: 18px;
		background: var(--accent-grad);
		box-shadow: var(--accent-glow);
		font-size: 2.4rem;
	}
	.hero-text {
		min-width: 0;
	}
	.hero-cta {
		margin-top: 0.9rem;
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.stat {
		text-align: center;
		display: grid;
		gap: 0.15rem;
		padding: 1.1rem;
	}
	.stat-num {
		font-size: 1.6rem;
		font-weight: 800;
		letter-spacing: -0.02em;
	}
	.stat-label {
		font-size: 0.82rem;
		color: var(--text-muted);
		font-weight: 600;
	}
	.podium {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.9rem;
	}
	.podium-card {
		display: grid;
		place-items: center;
		gap: 0.4rem;
		text-align: center;
		color: var(--text);
		padding: 1.2rem 0.9rem;
	}
	.podium-card:hover {
		text-decoration: none;
	}
	.podium-card.first {
		border-color: rgba(245, 166, 35, 0.5);
		box-shadow: 0 10px 30px -12px rgba(245, 166, 35, 0.35);
	}
	.medal {
		font-size: 1.6rem;
	}
	.p-name {
		font-weight: 700;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.lvl-chip {
		display: inline-block;
		padding: 0.16rem 0.6rem;
		border-radius: var(--pill);
		background: var(--accent-grad-soft);
		color: var(--accent-soft);
		font-weight: 700;
		font-size: 0.8rem;
	}
	.info h2 {
		margin-bottom: 0.35rem;
	}

	@media (max-width: 640px) {
		.hero {
			flex-direction: column;
			text-align: center;
		}
		.hero-cta {
			justify-content: center;
		}
		.podium {
			grid-template-columns: 1fr;
		}
	}
</style>
