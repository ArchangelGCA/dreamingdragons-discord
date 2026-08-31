<script lang="ts">
	import Avatar from '$lib/components/Avatar.svelte';
	import { COSMETICS, SLOTS, rarityFor } from '$lib/cosmetics';
	import type { CosmeticDef } from '$lib/cosmetics';
	import { animateIn } from '$lib/actions/animate';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { onMount } from 'svelte';

	let { data } = $props();
	const pub = $derived(data.pub);
	const guild = $derived(pub?.guild ?? null);
	const siteName = $derived(guild?.name ?? 'DreamingDragons');
	const gParam = $derived(pub?.guild && pub.guilds.length > 1 ? `?g=${pub.guild.id}` : '');
	const DISCORD_INVITE = 'https://discord.gg/HreQWPgQ6n';

	const SLOT_LABEL: Record<string, string> = {
		color: 'Colours',
		title: 'Titles',
		banner: 'Banners',
		frame: 'Frames',
		flair: 'Flair',
		badge: 'Badges',
		effect: 'Effects'
	};
	const SLOT_EMOJI: Record<string, string> = {
		color: '🎨',
		title: '🏷️',
		banner: '🏞️',
		frame: '🖼️',
		flair: '💫',
		badge: '🎖️',
		effect: '✨'
	};

	// ── URL-driven state (deep-link support for Discord) ───────────────
	// /shop?slot=<category> ; individual items link to /shop?item=<id>.
	// ?g= for guild and ?q= for search, all shareable.
	function initialSlot(): (typeof SLOTS)[number] | 'all' {
		const raw = page.url.searchParams.get('slot') ?? page.url.searchParams.get('category');
		if (raw && (SLOTS as readonly string[]).includes(raw)) return raw as (typeof SLOTS)[number];
		return 'all';
	}
	function initialPreview(): Record<string, string> {
		const raw = page.url.searchParams.get('item') ?? page.url.searchParams.get('preview');
		if (!raw) return {};
		const ids = raw.split(',').map((s) => s.trim()).filter(Boolean);
		const out: Record<string, string> = {};
		for (const id of ids) {
			const found = COSMETICS.find((c) => c.id === id);
			if (found) out[found.slot] = found.id;
		}
		return out;
	}

	let search = $state(page.url.searchParams.get('q') ?? page.url.searchParams.get('search') ?? '');
	let activeSlot = $state<(typeof SLOTS)[number] | 'all'>(initialSlot());
	let preview = $state<Record<string, string>>(initialPreview());
	let copiedId = $state<string | null>(null);

	// quick helpers
	function rarity(item: CosmeticDef) {
		return rarityFor(item.price);
	}

	function buildShopUrl(slot: string | null, itemId: string | null, q: string | null): string {
		const params = new URLSearchParams(page.url.searchParams);
		if (slot && slot !== 'all') params.set('slot', slot);
		else params.delete('slot');
		params.delete('category');
		if (q && q.trim()) params.set('q', q.trim());
		else params.delete('q');
		if (itemId) params.set('item', itemId);
		else params.delete('item');
		params.delete('preview');
		const qs = params.toString();
		return qs ? `${page.url.pathname}?${qs}` : page.url.pathname;
	}

	// page.url doesn't reliably reflect our own replaceState calls, so track the
	// last URL we pushed instead of comparing against page.url
	let lastSyncedUrl: string | null = null;
	function syncUrl() {
		if (typeof window === 'undefined') return;
		const url = buildShopUrl(activeSlot, Object.values(preview)[0] ?? null, search);
		if (lastSyncedUrl === null) lastSyncedUrl = window.location.pathname + window.location.search;
		if (url === lastSyncedUrl) return;
		lastSyncedUrl = url;
		replaceState(url, {});
	}

	// Keep URL in sync when filters/preview change (search debounced)
	let searchDebounce: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		void activeSlot;
		void preview;
		syncUrl();
	});
	$effect(() => {
		void search;
		if (searchDebounce) clearTimeout(searchDebounce);
		searchDebounce = setTimeout(syncUrl, 400);
		return () => {
			if (searchDebounce) clearTimeout(searchDebounce);
		};
	});

	onMount(() => {
		const item = page.url.searchParams.get('item')?.split(',')[0]?.trim();
		if (item) {
			const el = document.getElementById(`item-${item}`);
			if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120);
		}
	});

	async function shareItem(item: CosmeticDef, e?: Event) {
		e?.stopPropagation();
		e?.preventDefault();
		const url = `${window.location.origin}${buildShopUrl(item.slot, item.id, null)}`;
		try {
			await navigator.clipboard.writeText(url);
			copiedId = item.id;
			setTimeout(() => (copiedId = null), 1600);
		} catch {
			window.prompt('Copy link:', url);
		}
		// also set preview to this item for immediate feedback
		preview = { ...preview, [item.slot]: item.id };
		activeSlot = item.slot as (typeof SLOTS)[number];
	}

	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		return COSMETICS.filter((c) => {
			const matchSlot = activeSlot === 'all' || c.slot === activeSlot;
			if (!matchSlot) return false;
			if (!q) return true;
			return (
				c.name.toLowerCase().includes(q) ||
				c.description.toLowerCase().includes(q) ||
				c.id.toLowerCase().includes(q) ||
				c.slot.includes(q) ||
				(c.rarity ?? '').toLowerCase().includes(q)
			);
		});
	});

	const totalCount = COSMETICS.length;
	const filteredCount = $derived(filtered.length);
	const hasFilter = $derived(search.trim() !== '' || activeSlot !== 'all');

	function isSelected(item: CosmeticDef): boolean {
		return preview[item.slot] === item.id;
	}
	function togglePreview(item: CosmeticDef) {
		if (preview[item.slot] === item.id) {
			const { [item.slot]: _, ...rest } = preview;
			preview = rest;
		} else {
			preview = { ...preview, [item.slot]: item.id };
		}
	}
	function clearSlot(slot: string) {
		const { [slot]: _, ...rest } = preview;
		preview = rest;
	}
	function clearAll() {
		preview = {};
	}

	// sections to render: one per slot in "all" view, a single one when filtered
	const sections = $derived.by(() => {
		if (activeSlot !== 'all') return [{ slot: activeSlot as string, items: filtered }];
		return SLOTS.map((slot) => ({ slot, items: filtered.filter((c) => c.slot === slot) })).filter(
			(s) => s.items.length > 0
		);
	});

	// resolved preview for the mock card
	const previewCos = $derived.by(() => {
		const out: any = { color: null, banner: null, frame: null, flair: null, badge: null, effect: null, title: null, titleEmoji: null };
		for (const [slot, id] of Object.entries(preview)) {
			const item = COSMETICS.find((c) => c.id === id);
			if (!item) continue;
			if (slot === 'color' && item.palette) out.color = { from: item.palette[0], to: item.palette[1] };
			if (slot === 'banner') out.banner = item;
			if (slot === 'frame') out.frame = item.cssClass ?? null;
			if (slot === 'flair') out.flair = item.emoji;
			if (slot === 'badge') out.badge = item.emoji;
			if (slot === 'effect') out.effect = item.cssClass ?? null;
			if (slot === 'title') {
				out.title = item.name;
				out.titleEmoji = item.emoji;
			}
		}
		return out;
	});

	const accentStyle = $derived(
		previewCos.color ? `linear-gradient(90deg, ${previewCos.color.from}, ${previewCos.color.to})` : null
	);

	const previewName = 'Preview User';
	let hasAnyPreview = $derived(Object.keys(preview).length > 0);
</script>

<svelte:head>
	<title>Shop — {siteName} cosmetics preview</title>
	<meta property="og:title" content="Shop — {siteName} cosmetics" />
	<meta
		property="og:description"
		content="Preview 40+ cosmetics for {siteName}: colours, titles, banners, frames, flair, badges and name effects. Earn gold with /daily in Discord and equip with /equip."
	/>
	{#if guild?.icon}<meta property="og:image" content={guild.icon} />{/if}
</svelte:head>

<!-- ── Hero ────────────────────────────────────────────────────────── -->
<section class="shop-hero card" use:animateIn>
	<h1>🛍️ Shop</h1>
	<p class="muted">
		Every cosmetic you can earn in Discord — tap a card to try it on the preview, then claim gold
		with <code>/daily</code> and buy for real.
	</p>
	<div class="hero-cta">
		<a class="btn" href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">💬 Join Discord to earn</a>
		<a class="btn secondary" href="/leaderboard{gParam}">🏆 See styles on leaderboard</a>
	</div>
</section>

<!-- ── Layout: filters + preview sticky ──────────────────────────── -->
<div class="shop-layout">
	<!-- main column -->
	<div class="shop-main">
		<!-- controls -->
		<div class="controls card" use:animateIn={{ delay: 40 }}>
			<div class="search-wrap">
				<span class="search-icon" aria-hidden="true">🔎</span>
				<input
					type="search"
					placeholder="Search cosmetics…"
					bind:value={search}
					aria-label="Search cosmetics"
				/>
				{#if search}
					<button class="btn ghost small" type="button" onclick={() => (search = '')}>✕</button>
				{/if}
			</div>
			<div class="slot-tabs" role="tablist" aria-label="Filter by slot">
				<button
					class="tab"
					class:active={activeSlot === 'all'}
					role="tab"
					aria-selected={activeSlot === 'all'}
					onclick={() => (activeSlot = 'all')}
				>All <span class="tab-count">{totalCount}</span></button>
				{#each SLOTS as slot (slot)}
					{@const count = COSMETICS.filter((c) => c.slot === slot).length}
					<button
						class="tab"
						class:active={activeSlot === slot}
						role="tab"
						aria-selected={activeSlot === slot}
						onclick={() => (activeSlot = slot)}
					>
						{SLOT_EMOJI[slot]} {SLOT_LABEL[slot]} <span class="tab-count">{count}</span>
					</button>
				{/each}
			</div>
			{#if hasFilter || hasAnyPreview}
				<div class="controls-foot">
					<span class="faint">{filteredCount} {filteredCount === 1 ? 'item' : 'items'}{hasFilter ? ' — filtered' : ''}</span>
					{#if hasFilter}
						<button class="btn ghost small" onclick={() => { search=''; activeSlot='all'; }}>Clear filters</button>
					{/if}
					{#if hasAnyPreview}
						<button class="btn secondary small" onclick={clearAll}>↺ Clear preview</button>
					{/if}
				</div>
			{/if}
		</div>

		<!-- catalog -->
		{#if filteredCount === 0}
			<div class="empty" use:animateIn>
				<span class="big">🔍</span>
				<span>No matches.</span>
				<button class="btn secondary small" onclick={() => { search=''; activeSlot='all'; }}>Show all {totalCount}</button>
			</div>
		{:else}
			{#each sections as section, idx (section.slot)}
				<section class="slot-section" use:animateIn={{ delay: 60 + idx * 18 }}>
					<div class="slot-head">
						<h2>{SLOT_EMOJI[section.slot]} {SLOT_LABEL[section.slot]} <span class="faint">· {section.items.length}</span></h2>
					</div>
					<div class="shop-grid">
						{#each section.items as item (item.id)}
							{@const r = rarity(item)}
							{@const selected = isSelected(item)}
							<div
								id={`item-${item.id}`}
								class="shop-card card"
								class:selected
								class:frame-card={item.slot === 'frame'}
								role="button"
								tabindex="0"
								aria-pressed={selected}
								title={item.description}
								onclick={() => togglePreview(item)}
								onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePreview(item); } }}
							>
								<div class="card-top">
									<span class="card-emoji">{item.emoji}</span>
									<span class="rarity" style:background={`${r.color}18`} style:color={r.color} style:border-color={`${r.color}35`}>{r.label}</span>
									{#if selected}<span class="sel-badge" title="Previewing">✓</span>{/if}
									<button
										type="button"
										class="share-btn"
										onclick={(e) => shareItem(item, e)}
										title="Copy link to this item"
										aria-label="Copy link to {item.name}"
									>
										{copiedId === item.id ? '✓' : '🔗'}
									</button>
								</div>
								<div class="card-name">{item.name}</div>

								<!-- per-slot visual -->
								{#if item.slot === 'color' && item.palette}
									<div class="swatch" style:background={`linear-gradient(135deg, ${item.palette[0]}, ${item.palette[1]})`} aria-hidden="true"></div>
								{:else if item.slot === 'banner' && item.palette}
									<div class="banner-mini {item.cssClass ?? ''}" style:background={`linear-gradient(135deg, ${item.palette[0]}, ${item.palette[1]})`}></div>
								{:else if item.slot === 'frame' && item.cssClass}
									<div class="frame-mini {item.cssClass}"><span class="frame-mini-label">Frame preview</span></div>
								{:else if item.slot === 'effect' && item.cssClass}
									<div class="effect-mini"><span class="{item.cssClass}">Aa</span></div>
								{:else if item.slot === 'flair' || item.slot === 'badge' || item.slot === 'title'}
									<div class="emoji-big">{item.emoji}</div>
								{/if}

								<div class="card-foot">
									<span class="price">{item.price} 🪙</span>
								</div>
							</div>
						{/each}
					</div>
				</section>
			{/each}
		{/if}

		<div class="card cta-bottom" use:animateIn>
			<h2>See it in Discord</h2>
			<p class="muted">
				Earn gold with <code>/daily</code>, buy in <code>/shop</code>, equip with <code>/equip</code> —
				your style shows up on the leaderboard and your profile card.
			</p>
			<div class="cluster">
				<a class="btn" href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">💬 Join Discord</a>
				<a class="btn secondary" href="/leaderboard{gParam}">🏆 View leaderboard</a>
			</div>
		</div>
	</div>

	<!-- sticky preview (desktop only — static on mobile) -->
	<aside class="preview-col" aria-label="Live preview">
		<div class="preview-sticky">
			<div class="preview-head between">
				<h2 style="margin:0">👁️ Live preview</h2>
				{#if hasAnyPreview}
					<button class="btn ghost small" onclick={clearAll}>Clear</button>
				{/if}
			</div>

			{#if hasAnyPreview}
				<div class="preview-chips">
					{#each Object.entries(preview) as [slot, id] (slot)}
						{@const it = COSMETICS.find(c=>c.id===id)}
						{#if it}
							<button class="chip preview-chip" type="button" onclick={() => clearSlot(slot)} title="Remove {it.name}">
								<span>{it.emoji} {it.name}</span>
								<span aria-hidden="true">✕</span>
							</button>
						{/if}
					{/each}
				</div>
			{/if}

			<!-- mock profile card — same markup as u/[id] but with preview cosmetics -->
			<div class="card preview-card {previewCos.frame ?? ''}" style:overflow="hidden">
				<div
					class="banner {previewCos.banner?.cssClass ?? 'banner-default'}"
					style:background={previewCos.banner?.palette ? `linear-gradient(135deg, ${previewCos.banner.palette[0]}, ${previewCos.banner.palette[1]})` : undefined}
				>
					{#if previewCos.color}
						<div class="banner-wash" style:background={`linear-gradient(90deg, ${previewCos.color.from}55, ${previewCos.color.to}55)`}></div>
					{/if}
					{#if previewCos.badge}
						<div class="profile-badge">{previewCos.badge}</div>
					{/if}
					<div class="banner-pattern"></div>
				</div>
				<div class="avatar-wrap">
					<div class="avatar-ring {previewCos.frame ? '' : 'no-frame'}" style:box-shadow={previewCos.color ? `0 0 0 3px ${previewCos.color.from}, 0 8px 24px rgba(0,0,0,0.3)` : undefined}>
						<Avatar src="" name={previewName} seed="preview-user" size={88} />
					</div>
					{#if previewCos.flair}
						<span class="flair-bubble">{previewCos.flair}</span>
					{/if}
				</div>
				<div class="preview-body">
					<div class="p-name {previewCos.effect ?? ''}">{previewName}</div>
					{#if previewCos.title}
						<div class="title-pill"><span>{previewCos.titleEmoji ?? '🏷️'}</span> {previewCos.title}</div>
					{/if}
					<div class="pills">
						<span class="rank-pill">#42</span>
						<span class="lvl-chip" style:background={accentStyle ?? undefined} style:color={accentStyle ? '#fff' : undefined}>Level 12</span>
					</div>
					<div class="progress big" style:height="10px">
						<span style:width="64%" style:background={accentStyle ?? undefined}></span>
					</div>
					<div class="faint" style="font-size:0.78rem;margin-top:0.3rem">2 480 / 3 200 XP to Level 13</div>
					<div class="stats-row" style="margin-top:0.7rem">
						<span class="stat-pill">🔥 7 days</span>
						<span class="stat-pill">🎒 {Object.keys(preview).length} slots</span>
					</div>
				</div>
			</div>

			<p class="faint hint">
				{#if hasAnyPreview}Tap a chip to remove it — one item per slot.{:else}Tap any cosmetic card to try it on — one item per slot.{/if}
			</p>
		</div>
	</aside>
</div>

<style>
	.shop-hero {
		padding: clamp(1.3rem, 3vw, 1.9rem);
		margin-bottom: 1.25rem;
		display: grid;
		gap: 0.55rem;
		justify-items: start;
	}
	.shop-hero h1 {
		margin: 0;
		font-size: clamp(1.5rem, 3vw, 1.8rem);
	}
	.shop-hero p { margin: 0; max-width: 62ch; }
	.hero-cta {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
		margin-top: 0.35rem;
	}
	.shop-layout {
		display: grid;
		grid-template-columns: 1fr 340px;
		gap: 1.1rem;
		align-items: start;
	}
	.shop-main { min-width: 0; display: grid; gap: 1.1rem; }

	/* controls */
	.controls {
		padding: 0.9rem;
		display: grid;
		gap: 0.7rem;
		position: sticky;
		top: var(--shop-sticky-top, 64px);
		z-index: 5;
		backdrop-filter: blur(8px);
		transition: top 360ms var(--ease-out);
	}
	.search-wrap {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: var(--bg);
		border: 1px solid var(--border-strong);
		border-radius: 10px;
		padding: 0.35rem 0.6rem 0.35rem 0.7rem;
	}
	.search-icon { opacity: 0.6; }
	.search-wrap input {
		border: none;
		background: transparent;
		padding: 0.35rem 0;
		box-shadow: none;
		flex: 1;
		min-width: 0;
	}
	.search-wrap input:focus { box-shadow: none; transform: none; }
	.slot-tabs {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
	}
	.tab {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.4rem 0.7rem;
		border-radius: var(--pill);
		border: 1px solid var(--border);
		background: var(--bg-inset);
		color: var(--text-muted);
		font-weight: 600;
		font-size: 0.84rem;
		cursor: pointer;
		transition: background var(--t), color var(--t), border-color var(--t), transform var(--t);
	}
	.tab:hover { border-color: var(--border-strong); transform: translateY(-1px); }
	.tab.active {
		background: var(--accent-grad);
		color: #fff;
		border-color: transparent;
		box-shadow: var(--accent-glow);
	}
	.tab-count {
		display: inline-grid;
		place-items: center;
		min-width: 20px;
		height: 20px;
		padding: 0 5px;
		border-radius: var(--pill);
		background: rgba(255,255,255,0.18);
		font-size: 0.72rem;
		font-weight: 800;
	}
	.tab.active .tab-count { background: rgba(255,255,255,0.22); }
	.controls-foot {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
		justify-content: space-between;
	}

	/* catalog */
	.slot-section { display: grid; gap: 0.7rem; }
	.slot-head {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		flex-wrap: wrap;
		padding: 0 0.15rem;
	}
	.slot-head h2 { margin: 0; display: flex; gap: 0.4rem; align-items: center; }
	.shop-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
		gap: 0.75rem;
	}
	.shop-card {
		text-align: left;
		padding: 0.95rem;
		display: grid;
		gap: 0.5rem;
		cursor: pointer;
		transition: transform var(--t-spring), box-shadow var(--t), border-color var(--t);
		border: 1px solid var(--border);
	}
	.shop-card:hover {
		transform: translateY(-2px);
		border-color: var(--border-strong);
		box-shadow: var(--shadow);
	}
	.shop-card.selected {
		border-color: var(--accent);
		box-shadow: 0 0 0 2px rgba(0,165,148,0.18), var(--shadow);
		background: color-mix(in srgb, var(--accent-soft) 6%, var(--bg-elev));
	}
	.card-top {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		flex-wrap: wrap;
	}
	.card-emoji { font-size: 1.35rem; line-height: 1; }
	.rarity {
		display: inline-flex;
		padding: 0.12rem 0.5rem;
		border-radius: var(--pill);
		border: 1px solid;
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.sel-badge {
		font-size: 0.72rem;
		font-weight: 800;
		color: var(--accent-soft);
		background: var(--accent-grad-soft);
		padding: 0.18rem 0.5rem;
		border-radius: var(--pill);
	}
	.share-btn {
		margin-left: auto;
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border-radius: var(--pill);
		border: 1px solid var(--border);
		background: transparent;
		color: var(--text-muted);
		font-size: 0.78rem;
		cursor: pointer;
		transition: color var(--t), border-color var(--t), background var(--t);
	}
	.share-btn:hover {
		color: var(--text);
		border-color: var(--border-strong);
		background: var(--bg-inset);
	}
	.card-name { font-weight: 800; font-size: 0.98rem; letter-spacing: -0.01em; }
	.swatch {
		height: 18px;
		border-radius: var(--pill);
		border: 1px solid var(--border);
		margin-top: 0.15rem;
	}
	.banner-mini {
		height: 38px;
		border-radius: 8px;
		border: 1px solid var(--border);
		position: relative;
		overflow: hidden;
	}
	.frame-mini {
		height: 54px;
		border-radius: 10px;
		border: 2px solid var(--border);
		display: grid;
		place-items: center;
		background: var(--bg);
		position: relative;
		overflow: hidden;
	}
	.frame-mini-label { font-size: 0.72rem; font-weight: 700; color: var(--text-muted); position: relative; z-index: 1; }
	.effect-mini {
		height: 36px;
		display: grid;
		place-items: center;
		border-radius: 8px;
		background: var(--bg-inset);
		border: 1px solid var(--border);
		font-weight: 800;
		font-size: 1rem;
	}
	.effect-mini span {
		display: inline-block;
		line-height: 1;
		padding: 0.1rem 0.25rem;
	}
	.emoji-big { font-size: 1.9rem; text-align: center; padding: 0.15rem 0; }
	.card-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-top: 0.15rem;
		padding-top: 0.55rem;
		border-top: 1px solid var(--border);
	}
	.price { font-weight: 800; font-size: 0.9rem; letter-spacing: -0.01em; }
	.shop-card:focus-visible {
		outline: none;
		box-shadow: var(--ring);
	}

	.cta-bottom {
		text-align: center;
		display: grid;
		justify-items: center;
		gap: 0.6rem;
		padding: 1.5rem;
	}
	.cta-bottom h2 { margin: 0; }
	.cta-bottom p { margin: 0; max-width: 56ch; }
	.cta-bottom .cluster { justify-content: center; }

	/* preview */
	.preview-col {
		position: relative;
		min-width: 0;
		/* stretch to the full row height so the sticky panel can travel with the scroll */
		align-self: stretch;
	}
	.preview-sticky {
		position: sticky;
		top: var(--shop-sticky-top, 64px);
		display: grid;
		gap: 0.8rem;
		transition: top 360ms var(--ease-out);
	}
	.preview-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.preview-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.3rem 0.6rem;
		border-radius: var(--pill);
		background: var(--bg-elev);
		border: 1px solid var(--border-strong);
		font-size: 0.78rem;
		font-weight: 600;
		cursor: pointer;
	}
	.preview-chip:hover { border-color: #f87171; color: #f87171; }
	.hint { font-size: 0.82rem; margin: 0; text-align: center; }
	.preview-card {
		width: 100%;
		padding: 0;
		text-align: center;
		border-radius: var(--radius-lg);
	}
	.banner {
		height: 96px;
		position: relative;
		background: var(--accent-grad);
		overflow: hidden;
	}
	.banner-default { background: var(--accent-grad) !important; }
	.banner-wash { position: absolute; inset: 0; mix-blend-mode: soft-light; opacity: 0.9; pointer-events: none; }
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
		margin-top: -44px;
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
	.avatar-ring.no-frame { box-shadow: 0 8px 32px rgba(0,0,0,0.2), 0 0 0 4px var(--bg-elev); }
	.flair-bubble {
		position: absolute;
		bottom: 2px;
		right: calc(50% - 48px);
		width: 26px;
		height: 26px;
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: var(--bg-elev);
		border: 1px solid var(--border);
		box-shadow: var(--shadow-sm);
		font-size: 0.9rem;
		z-index: 3;
	}
	.preview-body {
		padding: 0.8rem 1.15rem 1.15rem;
		display: grid;
		justify-items: center;
		gap: 0.45rem;
	}
	.p-name {
		margin: 0.1rem 0 0;
		font-size: 1.35rem;
		font-weight: 800;
		letter-spacing: -0.02em;
		line-height: 1.15;
	}
	.title-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.22rem 0.65rem;
		border-radius: var(--pill);
		background: var(--bg-inset);
		border: 1px solid var(--border);
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--text-muted);
	}
	.pills {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		flex-wrap: wrap;
		margin-top: 0.1rem;
	}
	.rank-pill {
		padding: 0.22rem 0.65rem;
		border-radius: var(--pill);
		background: linear-gradient(135deg, #f5a623, #f7c95e);
		color: #412d00;
		font-weight: 800;
		font-size: 0.76rem;
	}
	.lvl-chip {
		display: inline-block;
		padding: 0.22rem 0.65rem;
		border-radius: var(--pill);
		background: var(--accent-grad-soft);
		color: var(--accent-soft);
		font-weight: 800;
		font-size: 0.76rem;
		border: 1px solid transparent;
	}
	.progress.big { width: 100%; }
	.stats-row {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.35rem;
	}
	.stat-pill {
		padding: 0.2rem 0.55rem;
		border-radius: var(--pill);
		background: var(--bg-inset);
		border: 1px solid var(--border);
		font-size: 0.74rem;
		font-weight: 600;
		color: var(--text-muted);
	}

	/* responsive */
	@media (max-width: 880px) {
		.shop-layout { grid-template-columns: 1fr; }
		.preview-sticky { position: static; }
		.controls { position: static; }
		.shop-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
	}
	@media (max-width: 480px) {
		.shop-grid { grid-template-columns: 1fr 1fr; gap: 0.6rem; }
		.shop-card { padding: 0.8rem; }
		.card-name { font-size: 0.9rem; }
	}
	@media (prefers-reduced-motion: reduce) {
		.shop-card { transition: none; }
	}
</style>
