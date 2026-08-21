<script lang="ts">
	import Banner from '$lib/components/Banner.svelte';
	import StatCard from '$lib/components/StatCard.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import CopyId from '$lib/components/CopyId.svelte';
	import { formatNumber, levelProgress } from '$lib/leveling';

	let { data } = $props();

	const guild = $derived(data.guild);
	const members = $derived(data.members);
	const cur = $derived(guild?.currentGuild ?? null);
	const medals = ['🥇', '🥈', '🥉'];
</script>

<div class="topbar">
	<div>
		<h1>Dashboard</h1>
		<p class="muted">
			{#if cur}Overview for <strong>{cur.name}</strong>.{:else}Overview of your bot's data.{/if}
		</p>
	</div>
	{#if guild}
		<div class="bot-pill" class:online={guild.botOnline}>
			<span class="dot"></span>
			{guild.botOnline ? 'Bot online' : 'Bot offline'}
		</div>
	{/if}
</div>

{#if !data.ok}
	<Banner kind="error">Could not reach PocketBase. Check the bot's database service.</Banner>
{/if}
{#if guild && !guild.botConfigured}
	<Banner kind="warn">The bot bridge isn't configured (<code>INTERNAL_API_SECRET</code>). The dashboard works but shows raw IDs and can't post to Discord.</Banner>
{:else if guild && !guild.botOnline}
	<Banner kind="warn">Bot is offline — showing raw IDs. Discord names and actions return when the bot is running.</Banner>
{/if}
{#if !data.gid && guild?.botOnline && guild.guilds.length === 0}
	<Banner kind="info">The bot isn't in any servers yet. Invite it to a server to get started.</Banner>
{/if}

{#if cur}
	<div class="hero card section">
		<Avatar src={cur.icon ?? ''} name={cur.name} seed={cur.id} rounded="square" size={64} />
		<div class="hero-info">
			<div class="hero-name">{cur.name}</div>
			<div class="cluster">
				<span class="chip">👥 {formatNumber(cur.memberCount)} members</span>
				<CopyId value={cur.id} />
			</div>
		</div>
	</div>
{/if}

<div class="grid section">
	<StatCard label="Reaction roles" value={data.counts.reactionRoles} icon="🏷️" tone="accent" />
	<StatCard label="Level rewards" value={data.counts.levelRewards} icon="🎁" tone="gold" />
	<StatCard label="Tracked users" value={data.counts.userLevels} icon="👥" tone="blue" />
	{#if cur}
		<StatCard label="Server members" value={formatNumber(cur.memberCount)} icon="🐉" tone="green" />
	{/if}
</div>

<div class="section">
	<h2>🏆 Top members by XP</h2>
	{#if data.topUsers.length === 0}
		<div class="empty">
			<span class="big">📊</span>
			<span>No XP data yet — activity will show up here.</span>
		</div>
	{:else}
		<div class="board card">
			{#each data.topUsers as u, i (u.id)}
				{@const m = members[u.user_id]}
				{@const p = levelProgress(u.xp)}
				<div class="board-row">
					<div class="rank" class:top={i < 3}>{medals[i] ?? i + 1}</div>
					<Avatar src={m?.avatar ?? ''} name={m?.displayName ?? u.user_id} seed={u.user_id} size={40} />
					<div class="who">
						<div class="name">{m?.displayName ?? ''}{#if !m}<CopyId value={u.user_id} short />{/if}</div>
						<div class="bar">
							<div class="progress"><span style="width:{p.pct}%"></span></div>
							<span class="xp faint">{formatNumber(u.xp)} XP</span>
						</div>
					</div>
					<div class="lvl">
						<span class="lvl-num">{u.level}</span>
						<span class="lvl-cap faint">LVL</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.bot-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.35rem 0.8rem;
		border-radius: var(--pill);
		background: var(--bg-elev);
		border: 1px solid var(--border);
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-muted);
	}
	.bot-pill .dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--red);
	}
	.bot-pill.online .dot {
		background: var(--green);
	}
	.hero {
		display: flex;
		align-items: center;
		gap: 1.1rem;
	}
	.hero-info {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
	}
	.hero-name {
		font-size: 1.3rem;
		font-weight: 800;
		letter-spacing: -0.02em;
	}
	.board {
		display: flex;
		flex-direction: column;
		padding: 0.5rem 0.75rem;
	}
	.board-row {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.65rem 0.35rem;
		border-bottom: 1px solid var(--border);
	}
	.board-row:last-child {
		border-bottom: none;
	}
	.rank {
		width: 30px;
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
	}
	.name {
		font-weight: 600;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-bottom: 0.3rem;
	}
	.bar {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.bar .progress {
		flex: 1;
		max-width: 340px;
	}
	.xp {
		font-size: 0.78rem;
		white-space: nowrap;
	}
	.lvl {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex: 0 0 auto;
		min-width: 42px;
	}
	.lvl-num {
		font-size: 1.3rem;
		font-weight: 800;
		line-height: 1;
	}
	.lvl-cap {
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.08em;
	}
</style>
