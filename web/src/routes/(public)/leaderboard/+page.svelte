<script lang="ts">
	import Avatar from '$lib/components/Avatar.svelte';
	import { anonymize } from '$lib/format';
	import { formatNumber, levelProgress } from '$lib/leveling';
	import { animateIn } from '$lib/actions/animate';

	let { data } = $props();

	const pub = $derived(data.pub);
	const board = $derived(data.board);
	const guild = $derived(pub.guild);
	const siteName = $derived(guild?.name ?? 'Community');
	const medals = ['🥇', '🥈', '🥉'];

	/** Query string that keeps the guild selection across pages/changes. */
	const gQuery = $derived(
		pub.guild && pub.guilds.length > 1 ? `g=${pub.guild.id}` : ''
	);
	function pageHref(p: number): string {
		const params = new URLSearchParams();
		if (gQuery) params.set('g', pub.guild!.id);
		if (p > 1) params.set('page', String(p));
		const qs = params.toString();
		return qs ? `/leaderboard?${qs}` : '/leaderboard';
	}
</script>

<svelte:head>
	<title>Leaderboard — {siteName}</title>
	<meta property="og:title" content="{siteName} — Leaderboard" />
	<meta property="og:description" content="Who's leading in {siteName}? Live XP rankings." />
</svelte:head>

<div class="topbar">
	<div>
		<h1>🏆 Leaderboard</h1>
		<p class="muted">
			{#if guild}Top members of <strong>{siteName}</strong> by XP.{:else}Community XP rankings.{/if}
		</p>
	</div>
	{#if pub.guilds.length > 1 && pub.guild}
		<form method="GET" action="/leaderboard">
			<label class="faint" style="margin:0" for="g">Server</label>
			<select id="g" name="g" onchange={(e) => e.currentTarget.form?.submit()} style="width:auto">
				{#each pub.guilds as g (g.id)}
					<option value={g.id} selected={g.id === pub.guild?.id}>{g.name ?? g.id}</option>
				{/each}
			</select>
		</form>
	{/if}
</div>

{#if !guild}
	<div class="alert error">The leaderboard is not available right now — please check back later.</div>
{:else if !board}
	<div class="alert error">Stats are temporarily unavailable. Please try again later.</div>
{:else if board.disabled}
	<div class="empty" use:animateIn>
		<span class="big">⏸️</span>
		<span>Leveling is currently paused for this server.<br />Come back soon!</span>
	</div>
{:else if board.entries.length === 0}
	<div class="empty" use:animateIn>
		<span class="big">🌱</span>
		<span>Nobody has earned XP yet — be the first!</span>
	</div>
{:else}
	{#if !pub.botOnline}
		<div class="alert">Names are hidden right now — members appear as pseudonyms until the bot reconnects.</div>
	{/if}
	<div class="board card">
		{#each board.entries as u, i (u.userId)}
			{@const name = u.name ?? anonymize(u.userId)}
			{@const p = levelProgress(u.xp)}
			<a class="board-row" href="/u/{u.userId}{gQuery ? `?${gQuery}` : ''}" use:animateIn={{ delay: Math.min(i, 12) * 25 }}>
				<span class="rank" class:top={u.rank <= 3}>{medals[u.rank - 1] ?? u.rank}</span>
				<Avatar src={u.avatar ?? ''} {name} seed={u.userId} size={38} />
				<span class="who">
					<span class="name">{name}</span>
					<span class="bar">
						<span class="progress"><span style="width:{p.pct}%"></span></span>
					</span>
				</span>
				<span class="lvl-chip">Lv {u.level}</span>
				<span class="xp faint">{formatNumber(u.xp)} XP</span>
			</a>
		{/each}
	</div>

	{#if board.totalPages > 1}
		<div class="cluster pager">
			{#if board.page > 1}<a class="btn secondary small" href={pageHref(board.page - 1)}>← Prev</a>{/if}
			<span class="muted">Page {board.page} / {board.totalPages}</span>
			{#if board.page < board.totalPages}<a class="btn secondary small" href={pageHref(board.page + 1)}>Next →</a>{/if}
		</div>
	{/if}
	<p class="faint foot-note">
		{board.total} ranked members · Earn XP by being active in the server ·
		<a href="/privacy">What do we store?</a>
	</p>
{/if}

<style>
	.board {
		display: flex;
		flex-direction: column;
		padding: 0.4rem 0.75rem;
	}
	.board-row {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		padding: 0.6rem 0.35rem;
		border-bottom: 1px solid var(--border);
		color: var(--text);
		border-radius: var(--radius-sm);
		transition: background var(--t);
	}
	.board-row:last-child {
		border-bottom: none;
	}
	.board-row:hover {
		background: var(--bg-hover);
		text-decoration: none;
	}
	.rank {
		width: 34px;
		text-align: center;
		font-weight: 700;
		color: var(--text-muted);
		flex: 0 0 auto;
	}
	.rank.top {
		font-size: 1.25rem;
	}
	.who {
		flex: 1;
		min-width: 0;
		display: grid;
		gap: 0.3rem;
	}
	.name {
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.bar .progress {
		max-width: 320px;
	}
	.lvl-chip {
		display: inline-block;
		padding: 0.16rem 0.6rem;
		border-radius: var(--pill);
		background: var(--accent-grad-soft);
		color: var(--accent-soft);
		font-weight: 700;
		font-size: 0.8rem;
		white-space: nowrap;
	}
	.xp {
		font-size: 0.82rem;
		white-space: nowrap;
	}
	.pager {
		justify-content: center;
		margin-top: 1.1rem;
	}
	.foot-note {
		text-align: center;
		font-size: 0.8rem;
		margin-top: 0.9rem;
	}
</style>
