<script lang="ts">
	import Banner from '$lib/components/Banner.svelte';
	let { data } = $props();

	const guild = $derived(data.guild);
	const members = $derived(data.members);
	const stats = $derived([
		{ label: 'Reaction roles', value: data.counts.reactionRoles, icon: '🏷️' },
		{ label: 'Level rewards', value: data.counts.levelRewards, icon: '🎁' },
		{ label: 'Tracked users', value: data.counts.userLevels, icon: '👥' }
	]);
</script>

<div class="topbar">
	<div>
		<h1>Dashboard</h1>
		<p class="muted">
			{#if guild?.currentGuild}Overview for <strong>{guild.currentGuild.name}</strong>.{:else}Overview of your bot's data.{/if}
		</p>
	</div>
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

<div class="grid section">
	{#each stats as s (s.label)}
		<div class="card stat">
			<div class="label">{s.icon} {s.label}</div>
			<div class="value">{s.value}</div>
		</div>
	{/each}
</div>

<div class="section">
	<h2>Top members by XP</h2>
	{#if data.topUsers.length === 0}
		<div class="card muted">No XP data yet.</div>
	{:else}
		<table>
			<thead>
				<tr><th>#</th><th>Member</th><th>Level</th><th>XP</th></tr>
			</thead>
			<tbody>
				{#each data.topUsers as u, i (u.id)}
					{@const m = members[u.user_id]}
					<tr>
						<td>{i + 1}</td>
						<td>
							{#if m}
								<div style="display:flex;align-items:center;gap:0.5rem">
									<img src={m.avatar} alt="" width="24" height="24" style="border-radius:50%" />
									<span>{m.displayName}</span>
								</div>
							{:else}
								<code>{u.user_id}</code>
							{/if}
						</td>
						<td>{u.level}</td>
						<td>{u.xp}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>
