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
	<meta property="og:description" content="Live leaderboard and member stats for {siteName} — earn gold with /daily, unlock 30+ cosmetics, and style your profile card." />
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
			members earn XP by chatting, claim <code>/daily</code> for gold & streaks, and unlock
			cosmetics for their profile card & leaderboard style.
		</p>
		<div class="hero-cta">
			<a class="btn" href="/leaderboard{gParam}">🏆 View the leaderboard</a>
			<a class="btn secondary" href="/privacy">🛡️ Privacy</a>
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
					{@const color = (u as any).cosmetics?.color ?? null}
					{@const flair = (u as any).cosmetics?.flair ?? null}
					{@const badge = (u as any).cosmetics?.badge ?? null}
					{@const frame = (u as any).cosmetics?.frame ?? null}
					<a
						class="card card-hover podium-card {frame ?? ''}"
						class:first={i === 0}
						href={profileHref(u.userId)}
						style:border-top={color ? `3px solid ${color.from}` : undefined}
					>
						<span class="medal">{medals[i]}</span>
						<span class="podium-avatar">
							<Avatar src={u.avatar ?? ''} {name} seed={u.userId} size={54} />
							{#if badge}<span class="podium-badge">{badge}</span>{/if}
						</span>
						<span class="p-name">{flair ? flair + ' ' : ''}{name}</span>
						{#if (u as any).cosmetics?.title}
							<span class="podium-title">{(u as any).cosmetics.title}</span>
						{/if}
						<span class="lvl-chip" style:background={color ? `linear-gradient(135deg, ${color.from}22, ${color.to}22)` : undefined} style:color={color ? color.from : undefined}>Lv {u.level}</span>
						<span class="faint">{formatNumber(u.xp)} XP</span>
					</a>
				{/each}
			</div>
		</section>

		<section class="card cosmetics-teaser" use:animateIn={{ delay: 120 }}>
			<h2>🎨 Style your card</h2>
			<p class="muted">
				Run <code>/daily</code> in Discord every day to build a streak (up to +100% bonus + milestone gold every 7 days + 5% jackpot).
				Spend gold at <code>/shop</code> on <strong>7 categories, 35+ items</strong> — colours, titles, banners, frames, flair, badges & name effects.
				Equip with <code>/equip</code> and your style appears here and on the leaderboard!
			</p>
			<div class="teaser-slots">
				<span class="chip">🎨 9 Colours</span>
				<span class="chip">🏷️ 9 Titles</span>
				<span class="chip">🏞️ 6 Banners</span>
				<span class="chip">🖼️ 6 Frames</span>
				<span class="chip">💫 8 Flair</span>
				<span class="chip">🎖️ 5 Badges</span>
				<span class="chip">✨ 3 Effects</span>
			</div>
			<p class="faint" style="font-size:0.82rem;margin-top:0.6rem">Day 1 welcome = 200🪙 → your first flair is instant! A week of dailies ≈ 800🪙 → a colour or banner. Two weeks ≈ 1 800🪙 → a frame. Jackpots (5%) double your gold randomly!</p>
		</section>
	{/if}

	<div class="card info" use:animateIn={{ delay: 140 }}>
		<h2>🔎 Where am I?</h2>
		<p class="muted">
			In Discord, run <code>/level</code> to see your rank card — it links straight to your
			public stats page. Run <code>/daily</code> for gold, <code>/shop</code> to browse cosmetics,
			<code>/equip</code> to style your card. Curious about the data behind it? Everything about your entry is
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
		position: relative;
		overflow: hidden;
	}
	.podium-card:hover {
		text-decoration: none;
	}
	.podium-card.first {
		border-color: rgba(245, 166, 35, 0.5);
		box-shadow: 0 10px 30px -12px rgba(245, 166, 35, 0.35);
	}
	.podium-avatar {
		position: relative;
	}
	.podium-badge {
		position: absolute;
		top: -4px;
		right: -6px;
		width: 20px;
		height: 20px;
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: var(--bg-elev);
		border: 1px solid var(--border);
		font-size: 0.7rem;
		box-shadow: var(--shadow-sm);
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
	.podium-title {
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--text-muted);
		font-style: italic;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
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
	.cosmetics-teaser {
		margin-top: 1.4rem;
	}
	.cosmetics-teaser h2 { margin-bottom: 0.5rem; }
	.cosmetics-teaser p { font-size: 0.92rem; }
	.teaser-slots {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 0.75rem;
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
