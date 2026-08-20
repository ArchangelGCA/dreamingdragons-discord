<script lang="ts">
	let { data } = $props();

	const stats = $derived([
		{ label: 'Reaction roles', value: data.counts.reactionRoles, icon: '🏷️' },
		{ label: 'Guilds configured', value: data.counts.levelSettings, icon: '⚙️' },
		{ label: 'Level rewards', value: data.counts.levelRewards, icon: '🎁' },
		{ label: 'Tracked users', value: data.counts.userLevels, icon: '👥' }
	]);
</script>

<div class="topbar">
	<div>
		<h1>Dashboard</h1>
		<p class="muted">Overview of your bot's data.</p>
	</div>
</div>

{#if !data.ok}
	<div class="alert error">Could not reach PocketBase. Check the bot's database service.</div>
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
				<tr><th>#</th><th>User ID</th><th>Guild ID</th><th>Level</th><th>XP</th></tr>
			</thead>
			<tbody>
				{#each data.topUsers as u, i (u.id)}
					<tr>
						<td>{i + 1}</td>
						<td><code>{u.user_id}</code></td>
						<td><code>{u.guild_id}</code></td>
						<td>{u.level}</td>
						<td>{u.xp}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>
