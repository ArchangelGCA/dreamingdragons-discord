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
	const cosmetics = $derived(profile?.cosmetics ?? null);
	const economy = $derived(profile?.economy ?? null);
	const ownedCount = $derived(profile?.ownedCount ?? 0);
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

	// Accent gradient for progress + pills when a color is equipped
	const accentStyle = $derived(
		cosmetics?.color ? `linear-gradient(90deg, ${cosmetics.color.from}, ${cosmetics.color.to})` : null
	);
	const accentFrom = $derived(cosmetics?.color?.from ?? null);

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

	const hasAnyCosmetic = $derived(
		!!(cosmetics?.color || cosmetics?.title || cosmetics?.frame || cosmetics?.flair || cosmetics?.banner || cosmetics?.badge || cosmetics?.effect)
	);
</script>

<svelte:head>
	{#if entry}
		<title>{name} — Level {entry.level} · {siteName}</title>
		<meta property="og:title" content="{name} — Level {entry.level}" />
		<meta
			property="og:description"
			content="Rank #{entry.rank} on {siteName} with {formatNumber(entry.xp)} XP. {cosmetics?.title ? 'Title: ' + cosmetics.title + ' · ' : ''}Custom style unlocked via daily rewards!"
		/>
		{#if entry.avatar}<meta property="og:image" content={entry.avatar} />{/if}
	{:else}
		<title>No stats yet · {siteName}</title>
	{/if}
</svelte:head>

{#if !entry}
	<div class="center" use:animateIn>
		<div class="card profile empty-card">
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
	<div class="card profile-card {cosmetics?.frame ?? ''}" style:overflow="hidden">
		<!-- Banner header -->
		<div class="banner {cosmetics?.banner?.cssClass ?? 'banner-default'}" style:background={cosmetics?.banner ? `linear-gradient(135deg, ${cosmetics.banner.from}, ${cosmetics.banner.to})` : undefined}>
			{#if cosmetics?.color}
				<div class="banner-wash" style:background={`linear-gradient(90deg, ${cosmetics.color.from}55, ${cosmetics.color.to}55)`}></div>
			{/if}
			{#if cosmetics?.badge}
				<div class="profile-badge" title="Badge — {cosmetics.badge}">{cosmetics.badge}</div>
			{/if}
			<div class="banner-pattern"></div>
		</div>

		<!-- Avatar overlapping banner -->
		<div class="avatar-wrap">
			<div class="avatar-ring {cosmetics?.frame ? '' : 'no-frame'}" style:box-shadow={cosmetics?.color ? `0 0 0 3px ${cosmetics.color.from}, 0 8px 24px rgba(0,0,0,0.3)` : undefined}>
				<Avatar src={entry.avatar ?? ''} {name} seed={entry.userId} size={96} />
			</div>
			{#if cosmetics?.flair}
				<span class="flair-bubble" title="Flair">{cosmetics.flair}</span>
			{/if}
		</div>

		<div class="profile-body">
			<h1 class="p-name {cosmetics?.effect ?? ''}">{name}</h1>

			{#if cosmetics?.title}
				<div class="title-pill">
					<span>{(cosmetics as any).titleEmoji ?? '🏷️'}</span>
					{cosmetics.title}
				</div>
			{/if}

			<div class="pills">
				<span class="rank-pill">#{entry.rank}</span>
				<span class="lvl-chip" style:background={accentStyle ?? undefined} style:color={accentStyle ? '#fff' : undefined}>Level {entry.level}</span>
				{#if entry.rank <= 3}
					<span class="medal-pill">{['🥇','🥈','🥉'][entry.rank - 1]}</span>
				{/if}
			</div>

			<div class="xp-block">
				<div class="xp-line">
					<span class="xp-num">{formatNumber(entry.xp)}</span>
					<span class="muted">total XP</span>
				</div>
				<div class="progress big" style:height="10px">
					<span
						style:width={`${p.pct}%`}
						style:background={accentStyle ?? undefined}
					></span>
				</div>
				<div class="muted xp-sub">
					{p.into} / {p.span} XP to Level {p.level + 1} · {p.pct}%
				</div>
			</div>

			{#if economy}
				<div class="stats-row">
					<span class="stat-pill" title="Current streak">🔥 {economy.streak} day{economy.streak===1 ? '' : 's'}</span>
					{#if economy.bestStreak > economy.streak}
						<span class="stat-pill faint">best {economy.bestStreak}</span>
					{/if}
					<span class="stat-pill">🎁 {economy.totalClaims} claims</span>
					{#if ownedCount > 0}
						<span class="stat-pill">🎒 {ownedCount} owned</span>
					{/if}
				</div>
			{/if}

			{#if hasAnyCosmetic}
				<div class="cosmetics-strip">
					<span class="strip-label">Style</span>
					<div class="strip-items">
						{#if cosmetics?.color}<span class="mini-chip" style:background={accentStyle} style:color="#fff">🎨 {cosmetics.color.from}</span>{/if}
						{#if cosmetics?.banner}<span class="mini-chip">🏞️ {cosmetics.banner.cssClass?.replace('banner-','') ?? 'banner'}</span>{/if}
						{#if cosmetics?.frame}<span class="mini-chip">🖼️ {cosmetics.frame.replace('frame-','')}</span>{/if}
						{#if cosmetics?.flair}<span class="mini-chip">💫 {cosmetics.flair}</span>{/if}
						{#if cosmetics?.badge}<span class="mini-chip">🎖️ {cosmetics.badge}</span>{/if}
						{#if cosmetics?.effect}<span class="mini-chip">✨ {cosmetics.effect.replace('effect-','')}</span>{/if}
						{#if cosmetics?.title}<span class="mini-chip">🏷️ {cosmetics.title}</span>{/if}
					</div>
				</div>
			{:else}
				<p class="faint hint">No cosmetics equipped yet — run <code>/daily</code> and visit <code>/shop</code> in Discord to style this card!</p>
			{/if}

			{#if profile && !profile.levelingEnabled}
				<div class="alert" style="margin-top:1rem">⏸️ Leveling is paused right now — your XP is safe and this page keeps working.</div>
			{/if}
			{#if lastActiveFmt}
				<p class="faint last-active">Last active: {lastActiveFmt}</p>
			{/if}

			<div class="actions">
				<button class="btn small" type="button" onclick={copyLink}>{copied ? '✅ Copied!' : '🔗 Copy link'}</button>
				<a class="btn secondary small" href="/leaderboard{boardQuery}">🏆 Leaderboard</a>
			</div>
		</div>
	</div>

	<div class="card transparency">
		<h2>🛡️ Your data, in plain view</h2>
		<p class="muted">
			This page shows <strong>everything</strong> we store about this account on this website:
			a Discord user ID, the XP / level derived from public chat activity in
			<em>{siteName}</em>, the day of the last counted message, and your equipped cosmetics.
			No messages, emails, or IP logs.
		</p>
		<p class="muted">
			🎨 <strong>Customise it:</strong> In Discord use <code>/daily</code> to earn gold, <code>/shop</code> to browse 30+ cosmetics (colours, titles, banners, frames, flair, badges, name effects) and <code>/equip</code> to style this card — it shines on the leaderboard too!
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
		gap: 1.15rem;
		justify-items: center;
	}
	.profile-card {
		width: 100%;
		max-width: 440px;
		padding: 0;
		text-align: center;
		position: relative;
		overflow: hidden;
		border-radius: var(--radius-lg);
	}
	.empty-card {
		max-width: 440px;
		padding: 2rem 1.5rem 1.7rem;
		display: grid;
		justify-items: center;
		gap: 0.5rem;
		text-align: center;
	}
	.banner {
		height: 112px;
		position: relative;
		background: var(--accent-grad);
		overflow: hidden;
	}
	.banner-default {
		background: var(--accent-grad) !important;
	}
	.banner-wash {
		position: absolute;
		inset: 0;
		mix-blend-mode: soft-light;
		opacity: 0.9;
		pointer-events: none;
	}
	.banner-pattern {
		position: absolute;
		inset: 0;
		background-image:
			radial-gradient(1px 1px at 12% 28%, rgba(255,255,255,0.55) 1px, transparent 1px),
			radial-gradient(1px 1px at 68% 42%, rgba(255,255,255,0.45) 1px, transparent 1px),
			radial-gradient(1.2px 1.2px at 38% 72%, rgba(255,255,255,0.4) 1px, transparent 1px),
			radial-gradient(1px 1px at 82% 68%, rgba(255,255,255,0.35) 1px, transparent 1px);
		background-size: 140px 80px;
		opacity: 0.5;
		pointer-events: none;
	}
	.avatar-wrap {
		position: relative;
		margin-top: -48px;
		display: grid;
		justify-items: center;
		z-index: 2;
	}
	.avatar-ring {
		border-radius: 50%;
		padding: 4px;
		background: var(--bg-elev);
		box-shadow: 0 8px 32px rgba(0,0,0,0.22), 0 0 0 3px var(--bg-elev);
		position: relative;
	}
	.avatar-ring.no-frame {
		box-shadow: 0 8px 32px rgba(0,0,0,0.2), 0 0 0 4px var(--bg-elev);
	}
	.flair-bubble {
		position: absolute;
		bottom: 2px;
		right: calc(50% - 52px);
		width: 28px;
		height: 28px;
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: var(--bg-elev);
		border: 1px solid var(--border);
		box-shadow: var(--shadow-sm);
		font-size: 0.95rem;
		z-index: 3;
	}
	.profile-body {
		padding: 0.9rem 1.4rem 1.4rem;
		display: grid;
		justify-items: center;
		gap: 0.55rem;
	}
	.p-name {
		margin: 0.15rem 0 0;
		font-size: 1.55rem;
		font-weight: 800;
		letter-spacing: -0.02em;
		line-height: 1.15;
	}
	.title-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.28rem 0.75rem;
		border-radius: var(--pill);
		background: var(--bg-inset);
		border: 1px solid var(--border);
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--text-muted);
		letter-spacing: 0.01em;
	}
	.pills {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-top: 0.15rem;
	}
	.rank-pill {
		padding: 0.26rem 0.75rem;
		border-radius: var(--pill);
		background: linear-gradient(135deg, #f5a623, #f7c95e);
		color: #412d00;
		font-weight: 800;
		font-size: 0.8rem;
		box-shadow: 0 2px 10px rgba(245,166,35,0.35);
	}
	.lvl-chip {
		display: inline-block;
		padding: 0.26rem 0.75rem;
		border-radius: var(--pill);
		background: var(--accent-grad-soft);
		color: var(--accent-soft);
		font-weight: 800;
		font-size: 0.8rem;
		border: 1px solid transparent;
	}
	.medal-pill {
		font-size: 1.1rem;
	}
	.xp-block {
		width: 100%;
		margin-top: 0.6rem;
		display: grid;
		gap: 0.4rem;
	}
	.xp-line {
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: 0.5rem;
	}
	.xp-num {
		font-size: 1.95rem;
		font-weight: 800;
		letter-spacing: -0.02em;
	}
	.progress.big {
		width: 100%;
		height: 10px;
	}
	.xp-sub {
		font-size: 0.82rem;
		text-align: center;
	}
	.stats-row {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.4rem;
		margin-top: 0.35rem;
	}
	.stat-pill {
		padding: 0.22rem 0.6rem;
		border-radius: var(--pill);
		background: var(--bg-inset);
		border: 1px solid var(--border);
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--text-muted);
	}
	.cosmetics-strip {
		width: 100%;
		margin-top: 0.7rem;
		padding: 0.75rem 0.85rem;
		border-radius: var(--radius);
		background: var(--bg-inset);
		border: 1px solid var(--border);
		display: grid;
		gap: 0.45rem;
		text-align: left;
	}
	.strip-label {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-faint);
	}
	.strip-items {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.mini-chip {
		padding: 0.22rem 0.55rem;
		border-radius: var(--pill);
		background: var(--bg-elev);
		border: 1px solid var(--border);
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-muted);
	}
	.hint {
		font-size: 0.82rem;
		text-align: center;
		margin-top: 0.4rem;
		line-height: 1.4;
	}
	.last-active {
		font-size: 0.8rem;
		margin-top: 0.2rem;
	}
	.actions {
		display: flex;
		justify-content: center;
		gap: 0.6rem;
		flex-wrap: wrap;
		margin-top: 0.8rem;
	}
	.transparency {
		width: 100%;
		max-width: 440px;
	}
	.transparency h2 {
		font-size: 1rem;
		margin-bottom: 0.4rem;
	}
	.transparency p {
		font-size: 0.85rem;
	}

	@media (max-width: 480px) {
		.profile-card { max-width: 100%; }
		.transparency { max-width: 100%; }
	}
</style>
