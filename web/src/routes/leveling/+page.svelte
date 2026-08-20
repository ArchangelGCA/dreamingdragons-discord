<script lang="ts">
	import { enhance } from '$app/forms';
	let { data, form } = $props();
</script>

<div class="topbar">
	<div>
		<h1>Leveling</h1>
		<p class="muted">Configure XP settings and role rewards per guild.</p>
	</div>
</div>

{#if form?.success}<div class="alert success">{form.success}</div>{/if}
{#if form?.error}<div class="alert error">{form.error}</div>{/if}

<div class="section">
	<h2>Guild settings</h2>
	{#if data.settings.length === 0}
		<div class="card muted">
			No guilds configured yet. Use <code>/leveladmin setup</code> in Discord to create settings.
		</div>
	{:else}
		<div class="grid">
			{#each data.settings as s (s.id)}
				<form method="POST" action="?/updateSettings" use:enhance class="card">
					<input type="hidden" name="id" value={s.id} />
					<div style="display:flex;justify-content:space-between;align-items:center">
						<strong>Guild <code>{s.guild_id}</code></strong>
						<span class="badge {s.enabled ? 'on' : 'off'}">{s.enabled ? 'Enabled' : 'Disabled'}</span>
					</div>

					<label for="nc-{s.id}">Notification channel ID</label>
					<input id="nc-{s.id}" name="notification_channel_id" value={s.notification_channel_id} />

					<div class="row">
						<div>
							<label for="xpm-{s.id}">XP per message</label>
							<input id="xpm-{s.id}" name="xp_per_message" type="number" min="1" max="100" value={s.xp_per_message} />
						</div>
						<div>
							<label for="cd-{s.id}">Cooldown (s)</label>
							<input id="cd-{s.id}" name="xp_cooldown" type="number" min="1" max="600" value={s.xp_cooldown} />
						</div>
					</div>

					<label style="display:flex;align-items:center;gap:0.5rem;margin-top:0.75rem">
						<input type="checkbox" name="enabled" checked={s.enabled} style="width:auto" /> Enabled
					</label>

					<button class="btn" style="margin-top:0.75rem">Save</button>
				</form>
			{/each}
		</div>
	{/if}
</div>

<div class="section">
	<h2>Role rewards</h2>

	<form method="POST" action="?/addReward" use:enhance class="card" style="margin-bottom:1rem">
		<div class="row">
			<div>
				<label for="rw-guild">Guild ID</label>
				<input id="rw-guild" name="guild_id" required />
			</div>
			<div>
				<label for="rw-level">Level</label>
				<input id="rw-level" name="level" type="number" min="1" required />
			</div>
			<div>
				<label for="rw-role">Role ID</label>
				<input id="rw-role" name="role_id" required />
			</div>
			<div style="flex:0">
				<button class="btn">Add reward</button>
			</div>
		</div>
	</form>

	{#if data.rewards.length === 0}
		<div class="card muted">No role rewards defined.</div>
	{:else}
		<table>
			<thead>
				<tr><th>Guild ID</th><th>Level</th><th>Role ID</th><th></th></tr>
			</thead>
			<tbody>
				{#each data.rewards as r (r.id)}
					<tr>
						<td><code>{r.guild_id}</code></td>
						<td>{r.level}</td>
						<td><code>{r.role_id}</code></td>
						<td style="text-align:right">
							<form method="POST" action="?/deleteReward" use:enhance>
								<input type="hidden" name="id" value={r.id} />
								<button class="btn danger small">Delete</button>
							</form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>
