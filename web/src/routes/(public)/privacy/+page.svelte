<script lang="ts">
	let { data } = $props();
	const siteName = $derived(data.pub?.guild?.name ?? 'this community');
</script>

<svelte:head>
	<title>Privacy — {siteName}</title>
	<meta name="description" content="What data {siteName} stores about its members and your rights (GDPR)." />
</svelte:head>

<article class="card paper">
	<h1>🛡️ Privacy</h1>
	<p class="muted">Short version: we store almost nothing, and what we store you can see on your public card.</p>

	<h2>What this website stores</h2>
	<p>
		The Discord bot behind <strong>{siteName}</strong> keeps minimal records per active member
		for leveling and daily rewards:
	</p>
	<ul>
		<li>your <strong>Discord user ID</strong> (a public snowflake),</li>
		<li>your <strong>XP and level</strong>, derived from message activity in the server,</li>
		<li>the <strong>day of your last counted message</strong>,</li>
		<li>your <strong>daily streak / claims &amp; cosmetics</strong> — which flair, title, banner, frame, badge or name effect you've equipped (via <code>/daily</code> &amp; <code>/shop</code>). Gold balances are <em>never</em> shown publicly.</li>
	</ul>
	<p>
		That's all. We do <strong>not</strong> store message contents, email addresses, IPs, or any tracking data.
	</p>

	<h2>Who can see it</h2>
	<p>
		The public pages show your display name, avatar, level, rank, XP, daily streak &amp; equipped cosmetics — the same
		information any member can already see via the bot in Discord (<code>/level</code>, <code>/balance</code>). Your public card and leaderboard rows showcase your style (colours, banners, frames, badges etc.) so cosmetics matter! If the bot is
		offline, names appear only as anonymous placeholders (<em>Member #xxxx</em>).
	</p>

	<h2>Cookies &amp; tracking</h2>
	<p>
		Visitors get <strong>no cookies and no analytics</strong>. The only thing saved in your browser is the
		light/dark theme choice (stored locally via <code>localStorage</code>, never sent anywhere).
		The admin area uses one technical session cookie, for admins only.
	</p>

	<h2>Legal basis (GDPR)</h2>
	<p>
		Processing is based on <strong>Art. 6(1)(f) GDPR</strong> (legitimate interest): a lightweight community
		gamification feature that members benefit from. Data is stored on infrastructure controlled by the
		server operator and is never sold or shared with third parties.
	</p>

	<h2>Your rights</h2>
	<ul>
		<li><strong>Access:</strong> your personal stats page shows the full record we hold about you.</li>
		<li><strong>Deletion (right to erasure, Art. 17):</strong> ask any server admin — they can delete your
			entry in seconds from the dashboard (or with <code>/leveladmin resetuser</code>). Your public card
			disappears immediately.</li>
		<li><strong>Objection:</strong> you can object to the storage at any time; deletion follows the same path.</li>
		<li>You also have the right to lodge a complaint with your local data protection authority.</li>
	</ul>

	<h2>Retention</h2>
	<p>
		Level records are kept while the leveling feature exists. Deleted entries are removed permanently and
		do not leave backups on this website.
	</p>

	<h2>Contact</h2>
	<p class="muted">
		Questions or deletion requests → ask a moderator/admin on the Discord server directly.
		This site is not affiliated with Discord Inc.
	</p>
</article>

<style>
	.paper {
		padding: clamp(1.4rem, 4vw, 2.4rem);
		max-width: 640px;
		margin: 0 auto;
	}
	.paper h1 {
		margin-bottom: 0.4rem;
	}
	.paper h2 {
		margin-top: 1.4rem;
		font-size: 1.02rem;
	}
	.paper p,
	.paper li {
		font-size: 0.92rem;
	}
	.paper ul {
		margin: 0.3rem 0 0.8rem;
		padding-left: 1.2rem;
	}
	.paper li {
		margin-bottom: 0.25rem;
	}
</style>
