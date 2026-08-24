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

	function flairFor(u: any): string | null {
		return u.cosmetics?.flair ?? null;
	}
	function badgeFor(u: any): string | null {
		return u.cosmetics?.badge ?? null;
	}
	function titleFor(u: any): string | null {
		return u.cosmetics?.title ?? null;
	}
	function colorFor(u: any): {from:string,to:string} | null {
		return u.cosmetics?.color ?? null;
	}
</script>

<svelte:head>
	<title>Leaderboard — {siteName}</title>
	<meta property="og:title" content="{siteName} — Leaderboard" />
	<meta property="og:description" content="Who's leading in {siteName}? Live XP rankings with custom cosmetics from daily rewards." />
</svelte:head>

<div class="topbar">
	<div>
		<h1>🏆 Leaderboard</h1>
		<p class="muted">
			{#if guild}Top members of <strong>{siteName}</strong> by XP — styles from <code>/daily</code> & <code>/shop</code>.{:else}Community XP rankings.{/if}
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
			{@const flair = flairFor(u)}
			{@const badge = badgeFor(u)}
			{@const title = titleFor(u)}
			{@const color = colorFor(u)}
			{@const frame = u.cosmetics?.frame ?? null}
			<a
				class="board-row {frame ? frame : ''}"
				href="/u/{u.userId}{gQuery ? `?${gQuery}` : ''}"
				use:animateIn={{ delay: Math.min(i, 12) * 22 }}
				style:border-left={color ? `3px solid ${color.from}` : undefined}
				style:background={u.rank<=3 && color ? `linear-gradient(90deg, ${color.from}14, transparent 65%)` : undefined}
			>
				<span class="rank" class:top={u.rank <= 3}>{medals[u.rank - 1] ?? u.rank}</span>
				<span class="avatar-stack">
					<Avatar src={u.avatar ?? ''} {name} seed={u.userId} size={38} />
					{#if badge}<span class="row-badge">{badge}</span>{/if}
					{#if flair}<span class="row-flair">{flair}</span>{/if}
				</span>
				<span class="who">
					<span class="name-row">
						<span class="name">{name}</span>
						{#if badge && !flair}<span class="inline-badge">{badge}</span>{/if}
					</span>
					{#if title}
						<span class="row-title">{title}</span>
					{/if}
					<span class="bar">
						<span class="progress"><span style:width={`${p.pct}%`} style:background={color ? `linear-gradient(90deg, ${color.from}, ${color.to})` : undefined}></span></span>
					</span>
				</span>
				<span class="lvl-chip" style:background={color ? `linear-gradient(135deg, ${color.from}22, ${color.to}22)` : undefined} style:color={color ? color.from : undefined} style:border-color={color ? color.from + '55' : undefined}>Lv {u.level}</span>
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
		{board.total} ranked members · Earn XP by chatting + <code>/daily</code> for gold & cosmetics ·
		<a href="/privacy">What do we store?</a>
	</p>
{/if}

<style>
	.board {
		display: flex;
		flex-direction: column;
		padding: 0.35rem 0.5rem;
		overflow: hidden;
	}
	.board-row {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		padding: 0.62rem 0.6rem;
		border-bottom: 1px solid var(--border);
		border-left: 3px solid transparent;
		color: var(--text);
		border-radius: var(--radius-sm);
		transition:
			background var(--t),
			transform var(--t),
			border-color var(--t);
		position: relative;
		overflow: hidden;
	}
	.board-row:last-child {
		border-bottom: none;
	}
	.board-row:hover {
		background: var(--bg-hover);
		text-decoration: none;
		transform: translateX(2px);
	}
	.rank {
		width: 34px;
		text-align: center;
		font-weight: 800;
		color: var(--text-muted);
		flex: 0 0 auto;
		font-variant-numeric: tabular-nums;
	}
	.rank.top {
		font-size: 1.25rem;
	}
	.avatar-stack {
		position: relative;
		flex: 0 0 auto;
		display: grid;
		place-items: center;
	}
	.row-badge {
		position: absolute;
		top: -6px;
		right: -6px;
		width: 18px;
		height: 18px;
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: var(--bg-elev);
		border: 1px solid var(--border);
		font-size: 0.62rem;
		box-shadow: var(--shadow-sm);
		pointer-events: none;
	}
	.row-flair {
		position: absolute;
		bottom: -4px;
		right: -6px;
		font-size: 0.72rem;
		background: var(--bg-elev);
		border: 1px solid var(--border);
		border-radius: var(--pill);
		padding: 0 3px;
		line-height: 1.2;
		box-shadow: var(--shadow-sm);
		pointer-events: none;
	}
	.who {
		flex: 1;
		min-width: 0;
		display: grid;
		gap: 0.18rem;
	}
	.name-row {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		min-width: 0;
	}
	.name {
		font-weight: 700;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}
	.inline-badge {
		font-size: 0.82rem;
		flex: 0 0 auto;
	}
	.row-title {
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--text-muted);
		letter-spacing: 0.01em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		margin-top: -0.05rem;
	}
	.bar .progress {
		max-width: 320px;
		height: 6px;
	}
	.lvl-chip {
		display: inline-flex;
		align-items: center;
		padding: 0.2rem 0.62rem;
		border-radius: var(--pill);
		background: var(--accent-grad-soft);
		color: var(--accent-soft);
		font-weight: 800;
		font-size: 0.78rem;
		white-space: nowrap;
		border: 1px solid transparent;
		flex: 0 0 auto;
	}
	.xp {
		font-size: 0.82rem;
		white-space: nowrap;
		flex: 0 0 auto;
		min-width: 72px;
		text-align: right;
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
	/* Subtle frame ring for premium frames on leaderboard rows */
	.board-row.frame-glow { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08); }
	.board-row.frame-rainbow { border-left-color: transparent !important; }
	.board-row.frame-rainbow::before { border-radius: var(--radius-sm); }

	@media (max-width: 640px) {
		.board-row { gap: 0.55rem; padding: 0.55rem 0.4rem; }
		.xp { min-width: 60px; font-size: 0.78rem; }
		.lvl-chip { padding: 0.16rem 0.5rem; }
	}
</style>
