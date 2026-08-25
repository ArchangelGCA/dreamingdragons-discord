<script lang="ts">
	import { page } from '$app/state';
	import { onNavigate } from '$app/navigation';
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import Avatar from '$lib/components/Avatar.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	let { data, children } = $props();

	const pub = $derived(data.pub);
	const siteName = $derived(pub?.guild?.name ?? 'DreamingDragons');
	const DISCORD_INVITE = 'https://discord.gg/HreQWPgQ6n';

	/** Keep the ?g= guild selection while navigating between public pages. */
	function hrefFor(path: string): string {
		const g = pub?.guild?.id;
		const multi = (pub?.guilds?.length ?? 0) > 1;
		return multi && g ? `${path}?g=${g}` : path;
	}

	const links = [
		{ path: '/', label: 'Home' },
		{ path: '/leaderboard', label: 'Leaderboard' },
		{ path: '/shop', label: 'Shop' },
		{ path: '/privacy', label: 'Privacy' }
	];

	const isWideRoute = $derived(page.url.pathname === '/shop');

	// ── Topbar auto-hide ────────────────────────────────────────────────
	let navHidden = $state(false);
	let navScrolled = $state(false);
	let hoverNearTop = $state(false);
	let navHasFocus = $state(false);
	let navHeight = $state(56);
	let navEl: HTMLElement | null = $state(null);

	function syncStickyTop() {
		if (typeof document === 'undefined') return;
		const top = navHidden ? 12 : navHeight + 12;
		document.documentElement.style.setProperty('--shop-sticky-top', `${top}px`);
		document.documentElement.style.setProperty('--pub-nav-h', `${navHeight}px`);
	}

	// keep sticky offset in sync with nav state / height
	$effect(() => {
		void navHidden;
		void navHeight;
		syncStickyTop();
	});

	onMount(() => {
		// measure nav height and keep --shop-sticky-top synced
		const measure = () => {
			if (navEl) {
				const h = Math.round(navEl.getBoundingClientRect().height);
				if (h && Math.abs(h - navHeight) > 1) navHeight = h;
				else if (h) navHeight = h;
			}
		};
		measure();
		requestAnimationFrame(measure);
		syncStickyTop();

		const ro = typeof ResizeObserver !== 'undefined' && navEl ? new ResizeObserver(measure) : null;
		if (ro && navEl) ro.observe(navEl);
		const onResize = () => measure();
		window.addEventListener('resize', onResize);

		let lastY = window.scrollY;
		let ticking = false;

		const onScroll = () => {
			if (ticking) return;
			ticking = true;
			requestAnimationFrame(() => {
				const y = window.scrollY;
				const dy = y - lastY;
				navScrolled = y > 8;

				if (y < 80) {
					navHidden = false;
				} else if (!navHasFocus && !hoverNearTop) {
					if (dy > 8 && y > 120) navHidden = true;
					else if (dy < -8) navHidden = false;
				}
				lastY = y;
				ticking = false;
			});
		};

		const onMouseMove = (e: MouseEvent) => {
			const near = e.clientY < 80;
			hoverNearTop = near;
			if (near && navHidden) navHidden = false;
		};

		const onFocusIn = (e: FocusEvent) => {
			const nav = document.querySelector('.pub-nav');
			if (nav && nav.contains(e.target as Node)) {
				navHasFocus = true;
				navHidden = false;
			}
		};
		const onFocusOut = (e: FocusEvent) => {
			// delay to allow focus to settle
			requestAnimationFrame(() => {
				const nav = document.querySelector('.pub-nav');
				const active = document.activeElement;
				if (nav && active && nav.contains(active)) return;
				navHasFocus = false;
			});
		};

		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('mousemove', onMouseMove, { passive: true });
		document.addEventListener('focusin', onFocusIn);
		document.addEventListener('focusout', onFocusOut);
		onScroll();

		return () => {
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('mousemove', onMouseMove);
			document.removeEventListener('focusin', onFocusIn);
			document.removeEventListener('focusout', onFocusOut);
			window.removeEventListener('resize', onResize);
			if (ro) ro.disconnect();
		};
	});

	// ── View Transitions (progressive enhancement) ──────────────────────
	// Native View Transitions API for buttery cross-page morph when available.
	// Falls back to the CSS pageEnter animation via the keyed #key block below.
	if (typeof document !== 'undefined' && 'startViewTransition' in document) {
		onNavigate((navigation) => {
			// don't intercept same-page hash / search-only changes that stay in place
			const from = navigation.from?.url.pathname;
			const to = navigation.to?.url.pathname;
			if (from === to) return;
			// @ts-ignore — startViewTransition is still behind a flag in some TS libs
			if (!document.startViewTransition) return;
			return new Promise((resolve) => {
				// @ts-ignore
				document.startViewTransition(async () => {
					resolve();
					await navigation.complete;
				});
			});
		});
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="description" content="{siteName} — community leaderboard and stats, powered by the dd-bot DreamingDragons's leveling system." />
</svelte:head>

<!-- invisible top sensor — catches pointer when nav is hidden so mousemove still fires reliably -->
<div class="pub-sensor" aria-hidden="true"></div>

<div class="pub">
	<header
		bind:this={navEl}
		class="pub-nav"
		class:hidden={navHidden}
		class:scrolled={navScrolled}
	>
		<a class="pub-brand" href={hrefFor('/')}>
			{#if pub?.guild?.icon}
				<Avatar src={pub.guild.icon} name={siteName} seed={pub.guild.id} size={30} rounded="square" />
			{:else}
				<span class="pub-mark">🐉</span>
			{/if}
			<span class="pub-name">{siteName}</span>
		</a>

		<nav class="pub-links" aria-label="Primary">
			{#each links as l (l.path)}
				{@const active = page.url.pathname === l.path}
				<a href={hrefFor(l.path)} class:active aria-current={active ? 'page' : undefined}>{l.label}</a>
			{/each}
		</nav>

		<div class="pub-tools">
			<a
				class="btn discord-cta small"
				href={DISCORD_INVITE}
				target="_blank"
				rel="noopener noreferrer"
				title="Join our Discord"
			>
				<span class="discord-dot" aria-hidden="true"></span>
				Discord
			</a>
			<ThemeToggle />
			<a class="btn secondary small admin-link" href="/dashboard" title="Admin area">⚙️ Admin</a>
		</div>
	</header>

	<main class="pub-main" class:wide={isWideRoute}>
		{#key page.url.pathname}
			<div class="pub-page">
				{@render children()}
			</div>
		{/key}
	</main>

	<footer class="pub-footer">
		<div class="footer-inner">
			<div class="footer-brand">
				<span class="footer-mark">🐉</span>
				<div>
					<div class="footer-title">{siteName}</div>
					<div class="faint tiny">Community leveling & cosmetics — powered by dd-bot</div>
				</div>
			</div>
			<div class="footer-links">
				<a href={hrefFor('/leaderboard')}>Leaderboard</a>
				<a href={hrefFor('/shop')}>Shop</a>
				<a href={hrefFor('/privacy')}>Privacy</a>
				<a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" class="discord-link">Join Discord ↗</a>
			</div>
		</div>
		<div class="footer-bottom">
			<span class="muted small">
				Stats come from public server activity · Not affiliated with Discord Inc. ·
				<a href={hrefFor('/privacy')}>Privacy</a>
			</span>
			<a class="btn small discord-cta" href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">
				<span class="discord-dot" aria-hidden="true"></span>
				Join {siteName} on Discord
			</a>
		</div>
	</footer>
</div>

<style>
	.pub {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}
	/* top hover sensor — 12px strip that catches mouse when nav is hidden */
	.pub-sensor {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 12px;
		z-index: 41;
		pointer-events: auto;
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
		backdrop-filter: blur(10px) saturate(1.05);
		-webkit-backdrop-filter: blur(10px) saturate(1.05);
		border-bottom: 1px solid var(--border);
		transition:
			transform 360ms var(--ease-out),
			box-shadow var(--t),
			background-color var(--t),
			border-color var(--t);
		will-change: transform;
	}
	.pub-nav.scrolled {
		box-shadow: 0 4px 20px -6px rgba(0, 0, 0, 0.18);
		background: color-mix(in srgb, var(--bg-elev) 92%, transparent);
	}
	.pub-nav.hidden {
		transform: translateY(-100%);
		pointer-events: none;
	}
	/* keep hover/ focus accessible: when hidden, sensor + mouse near top will unhide via JS;
	   nav itself stays inert while hidden to avoid trapping focus */
	.pub-nav.hidden:focus-within {
		transform: none;
		pointer-events: auto;
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

	/* Discord CTA */
	.discord-cta {
		background: #5865f2;
		border-color: #5865f2;
		color: #fff;
		font-weight: 700;
		gap: 0.45rem;
	}
	.discord-cta:hover {
		background: #4752c4;
		border-color: #4752c4;
		color: #fff;
		box-shadow: 0 6px 18px -6px rgba(88, 101, 242, 0.55);
		filter: none;
	}
	.discord-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 0 0 6px rgba(255, 255, 255, 0.18);
		display: inline-block;
		flex: 0 0 auto;
	}

	.pub-main {
		flex: 1;
		width: 100%;
		max-width: 780px;
		margin: 0 auto;
		padding: clamp(1.25rem, 4vw, 2.5rem) clamp(0.9rem, 4vw, 1.5rem) 3rem;
	}
	.pub-main.wide {
		max-width: 1080px;
	}

	/* Page transition — keyed block animates on pathname change. */
	.pub-page {
		animation: pubEnter 380ms var(--ease-out) both;
		view-transition-name: pub-page;
	}
	@keyframes pubEnter {
		from {
			opacity: 0;
			transform: translateY(10px) scale(0.992);
			filter: blur(2px);
		}
		to {
			opacity: 1;
			transform: none;
			filter: none;
		}
	}

	/* View Transitions — native morph when supported (progressive) */
	:global(::view-transition-old(pub-page)),
	:global(::view-transition-new(pub-page)) {
		animation-duration: 300ms;
		animation-timing-function: var(--ease-out);
	}
	:global(::view-transition-old(root)),
	:global(::view-transition-new(root)) {
		animation-duration: 260ms;
	}

	.pub-footer {
		padding: 1.6rem clamp(0.9rem, 4vw, 2rem) 2rem;
		border-top: 1px solid var(--border);
		display: grid;
		gap: 1.1rem;
		background: color-mix(in srgb, var(--bg-elev) 55%, transparent);
	}
	.footer-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		max-width: 780px;
		width: 100%;
		margin: 0 auto;
	}
	.footer-brand {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
	}
	.footer-mark {
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border-radius: 10px;
		background: var(--accent-grad);
		box-shadow: var(--accent-glow);
		font-size: 1.1rem;
		flex: 0 0 auto;
	}
	.footer-title {
		font-weight: 800;
		font-size: 0.95rem;
		letter-spacing: -0.01em;
	}
	.footer-links {
		display: flex;
		gap: 0.9rem;
		align-items: center;
		flex-wrap: wrap;
		font-size: 0.88rem;
		font-weight: 600;
	}
	.footer-links a {
		color: var(--text-muted);
	}
	.footer-links a:hover {
		color: var(--text);
	}
	.discord-link {
		color: #5865f2 !important;
	}
	.footer-bottom {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		max-width: 780px;
		width: 100%;
		margin: 0 auto;
		padding-top: 1rem;
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
		.pub-tools .admin-link {
			display: none;
		}
		.footer-inner {
			flex-direction: column;
			align-items: flex-start;
		}
		.footer-bottom {
			flex-direction: column;
			align-items: center;
			text-align: center;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pub-nav {
			transition: none;
		}
		.pub-page {
			animation: none;
		}
	}
</style>
