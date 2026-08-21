<script lang="ts">
	import { enhance } from '$app/forms';
	import Banner from '$lib/components/Banner.svelte';
	import RoleSelect from '$lib/components/RoleSelect.svelte';
	import ChannelSelect from '$lib/components/ChannelSelect.svelte';
	import RoleBadge from '$lib/components/RoleBadge.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import type { RoleDTO } from '$lib/server/bot';

	let { data, form } = $props();

	const guild = $derived(data.guild);
	const gid = $derived(data.gid);

	const roleById = $derived(new Map<string, RoleDTO>(data.roles.map((r) => [r.id, r])));
	const s = $derived(data.settings);

	// Track which form is submitting so its button can show a spinner.
	let busy = $state<string | null>(null);
	function track(key: string) {
		return () => {
			busy = key;
			return async ({ update }: { update: () => Promise<void> }) => {
				await update();
				busy = null;
			};
		};
	}
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

{#if gid}
	<div class="section">
		<h2>⚙️ Settings</h2>
		<form method="POST" action="?/saveSettings" use:enhance={track('settings')} class="card pad-lg">
			<input type="hidden" name="guild_id" value={gid} />
			<label for="nc">Notification channel</label>
			<ChannelSelect id="nc" name="notification_channel_id" channels={data.channels}
				value={s?.notification_channel_id ?? ''} />

			<div class="row" style="margin-top:0.85rem">
				<div>
					<label for="xpm">XP per message</label>
					<input id="xpm" name="xp_per_message" type="number" min="1" max="1000" value={s?.xp_per_message ?? 20} />
				</div>
				<div>
					<label for="cd">Cooldown (seconds)</label>
					<input id="cd" name="xp_cooldown" type="number" min="1" max="86400" value={s?.xp_cooldown ?? 60} />
				</div>
			</div>

			<div class="between" style="margin-top:1.1rem">
				<label class="switch" style="margin:0">
					<input type="checkbox" name="enabled" checked={s?.enabled ?? false} />
					<span class="track"></span>
					Leveling enabled
				</label>
				<button class="btn" disabled={busy === 'settings'}>
					{#if busy === 'settings'}<span class="spinner"></span>{/if} Save settings
				</button>
			</div>
		</form>
	</div>

	<!-- APPEND-REWARDS -->

	<div class="section">
		<h2>🎁 Role rewards</h2>
		<form method="POST" action="?/addReward" use:enhance={track('reward')} class="card" style="margin-bottom:1rem">
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
					<button class="btn" disabled={busy === 'reward'}>
						{#if busy === 'reward'}<span class="spinner"></span>{/if} Add / update
					</button>
				</div>
			</div>
		</form>

		{#if data.rewards.length === 0}
			<div class="empty"><span class="big">🎁</span><span>No role rewards defined yet.</span></div>
		{:else}
			<div class="table-wrap scroll">
				<table>
					<thead><tr><th style="width:90px">Level</th><th>Role</th><th></th></tr></thead>
					<tbody>
						{#each data.rewards as r (r.id)}
							{@const role = roleById.get(r.role_id)}
							<tr>
								<td><span class="lvl-chip">Lv {r.level}</span></td>
								<td><RoleBadge name={role?.name ?? null} color={role?.color ?? null} id={r.role_id} /></td>
								<td class="right">
									<form method="POST" action="?/deleteReward" use:enhance>
										<input type="hidden" name="id" value={r.id} />
										<button class="btn danger secondary small">Delete</button>
									</form>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>

	<!-- APPEND-MAINTENANCE -->

	<div class="section">
		<h2>🛠️ Maintenance</h2>
		<div class="card pad-lg">
			<div class="cluster">
				<form method="POST" action="?/previewRecover" use:enhance={track('recover')}>
					<input type="hidden" name="guild_id" value={gid} />
					<button class="btn secondary" disabled={!guild?.botOnline || busy === 'recover'}>
						{#if busy === 'recover'}<span class="spinner"></span>{/if} 🔄 Recover XP from roles…
					</button>
				</form>
				<form method="POST" action="?/syncRoles" use:enhance={track('sync')}>
					<input type="hidden" name="guild_id" value={gid} />
					<button class="btn secondary" disabled={!guild?.botOnline || busy === 'sync'}>
						{#if busy === 'sync'}<span class="spinner"></span>{/if} 🎭 Sync roles to levels
					</button>
				</form>
			</div>
			<p class="muted" style="font-size:0.82rem;margin:0.85rem 0 0">
				<strong>Recover XP</strong> grants members the XP tied to reward roles they already hold (fixes a lost
				database). <strong>Sync roles</strong> re-awards reward roles based on current XP. Both need the bot online.
			</p>

			{#if form?.recover}
				{@const rec = form.recover}
				<div style="margin-top:1.1rem">
					{#if rec.applied}
						<div class="alert success">Applied: {rec.updated} updated, {rec.skipped} skipped, {rec.errors} errors.</div>
					{:else if rec.changes.length === 0}
						<div class="alert success">Nothing to recover — everyone already has enough XP.</div>
					{:else}
						<div class="alert">Preview: {rec.changes.length} member(s) would be updated, {rec.skipped} skipped. Review, then apply.</div>
						<div class="table-wrap scroll">
							<table>
								<thead><tr><th>Member</th><th>From</th><th>→ To</th></tr></thead>
								<tbody>
									{#each rec.changes as c (c.userId)}
										<tr>
											<td>
												<div class="cluster" style="gap:0.5rem">
													<Avatar name={c.name ?? c.userId} seed={c.userId} size={26} />
													<span>{c.name ?? c.userId}</span>
												</div>
											</td>
											<td class="muted">Lv {c.fromLevel} · {c.fromXp} XP</td>
											<td><strong>Lv {c.toLevel}</strong> · {c.toXp} XP</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
						<form method="POST" action="?/applyRecover" use:enhance={track('apply')} style="margin-top:0.85rem">
							<input type="hidden" name="guild_id" value={gid} />
							<button class="btn" disabled={busy === 'apply'}>
								{#if busy === 'apply'}<span class="spinner"></span>{/if} Apply recovery to {rec.changes.length} member(s)
							</button>
						</form>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.lvl-chip {
		display: inline-block;
		padding: 0.16rem 0.6rem;
		border-radius: var(--pill);
		background: var(--accent-grad-soft);
		color: var(--accent-soft);
		font-weight: 700;
		font-size: 0.8rem;
	}
</style>
