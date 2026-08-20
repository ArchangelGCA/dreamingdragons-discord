<script lang="ts">
	import { enhance } from '$app/forms';
	import Banner from '$lib/components/Banner.svelte';
	import RoleSelect from '$lib/components/RoleSelect.svelte';
	import ChannelSelect from '$lib/components/ChannelSelect.svelte';

	let { data, form } = $props();

	const guild = $derived(data.guild);
	const gid = $derived(data.gid);

	const roleName = $derived(new Map(data.roles.map((r) => [r.id, r.name])));
	const channelName = $derived(new Map(data.channels.map((c) => [c.id, c.name])));
	const s = $derived(data.settings);
</script>

<div class="topbar">
	<div>
		<h1>Leveling</h1>
		<p class="muted">XP settings, role rewards and recovery for the selected server.</p>
	</div>
</div>

{#if !gid}
	<Banner kind="warn">Select a server from the sidebar to manage its leveling.</Banner>
{:else if guild && !guild.botOnline}
	<Banner kind="warn">Bot is offline — showing raw IDs and Discord actions are unavailable.</Banner>
{/if}

{#if form?.success}<div class="alert success">{form.success}</div>{/if}
{#if form?.error}<div class="alert error">{form.error}</div>{/if}

{#if gid}
	<div class="section">
		<h2>Settings</h2>
		<form method="POST" action="?/saveSettings" use:enhance class="card">
			<input type="hidden" name="guild_id" value={gid} />
			<label for="nc">Notification channel</label>
			<ChannelSelect id="nc" name="notification_channel_id" channels={data.channels}
				value={s?.notification_channel_id ?? ''} />

			<div class="row" style="margin-top:0.75rem">
				<div>
					<label for="xpm">XP per message</label>
					<input id="xpm" name="xp_per_message" type="number" min="1" max="1000" value={s?.xp_per_message ?? 20} />
				</div>
				<div>
					<label for="cd">Cooldown (seconds)</label>
					<input id="cd" name="xp_cooldown" type="number" min="1" max="86400" value={s?.xp_cooldown ?? 60} />
				</div>
			</div>

			<label style="display:flex;align-items:center;gap:0.5rem;margin-top:0.75rem">
				<input type="checkbox" name="enabled" checked={s?.enabled ?? false} style="width:auto" /> Enabled
			</label>
			<button class="btn" style="margin-top:0.75rem">Save settings</button>
		</form>
	</div>

	<!-- APPEND-REWARDS -->

	<div class="section">
		<h2>Role rewards</h2>
		<form method="POST" action="?/addReward" use:enhance class="card" style="margin-bottom:1rem">
			<input type="hidden" name="guild_id" value={gid} />
			<div class="row">
				<div style="flex:2">
					<label for="rw-role">Role</label>
					<RoleSelect id="rw-role" name="role_id" roles={data.roles} assignableOnly required />
				</div>
				<div>
					<label for="rw-level">Level</label>
					<input id="rw-level" name="level" type="number" min="1" required />
				</div>
				<div style="flex:0">
					<button class="btn">Add / update</button>
				</div>
			</div>
		</form>

		{#if data.rewards.length === 0}
			<div class="card muted">No role rewards defined.</div>
		{:else}
			<table>
				<thead><tr><th>Level</th><th>Role</th><th></th></tr></thead>
				<tbody>
					{#each data.rewards as r (r.id)}
						<tr>
							<td>{r.level}</td>
							<td>
								{#if roleName.has(r.role_id)}@{roleName.get(r.role_id)}{:else}<code>{r.role_id}</code>{/if}
							</td>
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

	<div class="section">
		<h2>Maintenance</h2>
		<div class="card">
			<div class="row" style="align-items:center">
				<form method="POST" action="?/previewRecover" use:enhance>
					<input type="hidden" name="guild_id" value={gid} />
					<button class="btn secondary" disabled={!guild?.botOnline}>Recover XP from roles…</button>
				</form>
				<form method="POST" action="?/syncRoles" use:enhance>
					<input type="hidden" name="guild_id" value={gid} />
					<button class="btn secondary" disabled={!guild?.botOnline}>Sync roles to levels</button>
				</form>
			</div>
			<p class="muted" style="font-size:0.82rem;margin:0.75rem 0 0">
				<strong>Recover XP</strong> grants members the XP tied to reward roles they already hold (fixes a lost
				database). <strong>Sync roles</strong> re-awards reward roles based on current XP. Both need the bot online.
			</p>

			{#if form?.recover}
				{@const rec = form.recover}
				<div class="section" style="margin-top:1rem">
					{#if rec.applied}
						<div class="alert success">
							Applied: {rec.updated} updated, {rec.skipped} skipped, {rec.errors} errors.
						</div>
					{:else if rec.changes.length === 0}
						<div class="alert success">Nothing to recover — everyone already has enough XP.</div>
					{:else}
						<div class="alert">Preview: {rec.changes.length} member(s) would be updated, {rec.skipped} skipped. Review, then apply.</div>
						<table>
							<thead><tr><th>Member</th><th>From</th><th>→ To</th></tr></thead>
							<tbody>
								{#each rec.changes as c (c.userId)}
									<tr>
										<td>{c.name ?? c.userId}</td>
										<td class="muted">Lv {c.fromLevel} · {c.fromXp} XP</td>
										<td>Lv {c.toLevel} · {c.toXp} XP</td>
									</tr>
								{/each}
							</tbody>
						</table>
						<form method="POST" action="?/applyRecover" use:enhance style="margin-top:0.75rem">
							<input type="hidden" name="guild_id" value={gid} />
							<button class="btn">Apply recovery to {rec.changes.length} member(s)</button>
						</form>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}

