<script lang="ts">
	import { page } from '$app/state';
	import Avatar from '$lib/components/Avatar.svelte';
	import { anonymize } from '$lib/format';
	import { formatNumber, levelProgress } from '$lib/leveling';
	import { animateIn } from '$lib/actions/animate';

	let { data } = $props();

	const pub = $derived(data.pub);
	const profile = $derived(data.profile);
	const entry = $derived(profile?.entry ?? null);
	const name = $derived(entry ? (entry.name ?? anonymize(entry.userId)) : '');
	const p = $derived(levelProgress(entry?.xp ?? 0));
	const siteName = $derived(pub.guild?.name ?? 'this community');

	/** Leaderboard link that lands on the page this member is ranked on. */
	const boardQuery = $derived.by(() => {
		const params = new URLSearchParams();
		if (pub.guild && pub.guilds.length > 1) params.set('g', pub.guild.id);
		if (entry) {
			const targetPage = Math.ceil(entry.rank / 25);
			if (targetPage > 1) params.set('page', String(targetPage));
		}
		const qs = params.toString();
		return qs ? `?${qs}` : '';
	});
	const lastActiveFmt = $derived(
		profile?.lastActiveDay
			? new Date(profile.lastActiveDay + 'T00:00:00Z').toLocaleDateString(undefined, {
					year: 'numeric',
					month: 'long',
					day: 'numeric'
				})
			: null
	);

	let copied = $state(false);
	async function copyLink() {
		try {
			await navigator.clipboard.writeText(data.shareUrl);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			/* clipboard unavailable */
		}
	}
</script>

<svelte:head>
	{#if entry}
		<title>{name} — Level {entry.level} · {siteName}</title>
		<meta property="og:title" content="{name} — Level {entry.level}" />
		<meta
			property="og:description"
			content="Rank #{entry.rank} on {siteName} with {formatNumber(entry.xp)} XP."
		/>
		{#if entry.avatar}<meta property="og:image" content={entry.avatar} />{/if}
	{:else}
		<title>No stats yet · {siteName}</title>
	{/if}
</svelte:head>

{#if !entry}
	<div class="center" use:animateIn>
		<div class="card profile">
			<span style="font-size:2.2rem">🌱</span>
			<h1 class="p-name">No stats yet</h1>
			<p class="muted">
				This member hasn't earned any XP in {siteName} yet — or the link has a typo.
				A card appears here after their first counted messages.
			</p>
			<a class="btn secondary small" href="/leaderboard{boardQuery}">🏆 To the leaderboard</a>
		</div>
	</div>
{:else}
<div class="center" use:animateIn>
	<div class="card profile">
		<Avatar src={entry.avatar ?? ''} {name} seed={entry.userId} size={88} />
		<h1 class="p-name">{name}</h1>
		<div class="cluster" style="justify-content:center">
			<span class="rank-pill">Rank #{entry.rank}</span>
			<span class="lvl-chip">Level {entry.level}</span>
		</div>

		<div class="xp-line">
			<span class="xp-num">{formatNumber(entry.xp)}</span>
			<span class="muted">total XP</span>
		</div>

		<div class="progress big"><span style="width:{p.pct}%"></span></div>
		<div class="muted" style="font-size:0.82rem;margin-top:0.35rem">
			{p.into} / {p.span} XP to Level {p.level + 1} ({p.pct}%)
		</div>

		{#if profile && !profile.levelingEnabled}
			<div class="alert" style="margin-top:1rem">⏸️ Leveling is paused right now — your XP is safe and this page keeps working.</div>
		{/if}
		{#if lastActiveFmt}
			<p class="faint" style="margin-top:0.9rem">Last active: {lastActiveFmt}</p>
		{/if}

		<div class="cluster" style="justify-content:center;margin-top:1.1rem">
			<button class="btn small" type="button" onclick={copyLink}>{copied ? '✅ Copied!' : '🔗 Copy link'}</button>
			<a class="btn secondary small" href="/leaderboard{boardQuery}">🏆 Leaderboard</a>
		</div>
	</div>

	<div class="card transparency">
		<h2>🛡️ Your data, in plain view</h2>
		<p class="muted">
			This page shows <strong>everything</strong> we store about this account on this website:
			a Discord user ID, the XP / level derived from public chat activity in
			<em>{siteName}</em>, and the day of the last counted message. No messages, emails, or
			IP logs.
		</p>
		<p class="muted">
			Want your entry removed? Use the <a href="/privacy">privacy page</a> — deletion is one
			ask away (an admin can erase it instantly).
		</p>
	</div>
</div>
{/if}

<style>
	.center {
		display: grid;
		gap: 1rem;
		justify-items: center;
	}
	.profile {
		width: 100%;
		max-width: 420px;
		text-align: center;
		display: grid;
		justify-items: center;
		gap: 0.4rem;
		padding: 2rem 1.5rem 1.7rem;
		border-top: 3px solid transparent;
		border-image: linear-gradient(90deg, var(--accent-strong), var(--accent-soft)) 1;
	}
	.p-name {
		margin: 0.2rem 0 0.1rem;
		font-size: 1.5rem;
	}
	.rank-pill {
		padding: 0.22rem 0.7rem;
		border-radius: var(--pill);
		background: linear-gradient(135deg, #f5a623, #f7c95e);
		color: #412d00;
		font-weight: 800;
		font-size: 0.8rem;
	}
	.lvl-chip {
		display: inline-block;
		padding: 0.22rem 0.7rem;
		border-radius: var(--pill);
		background: var(--accent-grad-soft);
		color: var(--accent-soft);
		font-weight: 700;
		font-size: 0.8rem;
	}
	.xp-line {
		margin-top: 0.7rem;
		display: flex;
		align-items: baseline;
		gap: 0.45rem;
	}
	.xp-num {
		font-size: 1.9rem;
		font-weight: 800;
		letter-spacing: -0.02em;
	}
	.progress.big {
		width: 100%;
		height: 10px;
		margin-top: 0.7rem;
	}
	.transparency {
		width: 100%;
		max-width: 420px;
	}
	.transparency h2 {
		font-size: 1rem;
		margin-bottom: 0.4rem;
	}
	.transparency p {
		font-size: 0.85rem;
	}
</style>
