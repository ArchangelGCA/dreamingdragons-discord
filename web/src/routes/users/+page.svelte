<script lang="ts">
	import { enhance } from '$app/forms';
	import Banner from '$lib/components/Banner.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import CopyId from '$lib/components/CopyId.svelte';
	import { formatNumber, levelProgress } from '$lib/leveling';

	let { data } = $props();
	const guild = $derived(data.guild);
	const gid = $derived(data.gid);
	const members = $derived(data.members);

	function confirmReset(e: SubmitEvent, name: string) {
		if (!confirm(`Reset all level data for ${name}? This cannot be undone.`)) e.preventDefault();
	}
</script>

<div class="topbar">
	<div>
		<h1>Users</h1>
		<p class="muted">
			{data.totalItems} tracked member(s). Editing XP re-syncs reward roles when the bot is online.
		</p>
	</div>
</div>

{#if !gid}
	<Banner kind="warn">Select a server from the sidebar to manage its members.</Banner>
{:else if guild && !guild.botOnline}
	<Banner kind="warn">Bot is offline — names/avatars and role re-sync are unavailable.</Banner>
{/if}

{#if gid}
	{#if guild?.botOnline}
		<div class="section">
			<h2>🔍 Find a member</h2>
			<form method="GET" class="card">
				<div class="row">
					<div style="flex:2">
						<label for="q">Search by name</label>
						<input id="q" name="q" value={data.q} placeholder="username or nickname" />
					</div>
					<div style="flex:0"><button class="btn">Search</button></div>
				</div>
			</form>
			{#if data.search.length > 0}
				<div class="table-wrap scroll" style="margin-top:0.75rem">
					<table>
						<thead><tr><th>Member</th><th style="width:220px">Set level</th></tr></thead>
						<tbody>
							{#each data.search as m (m.id)}
								<tr>
									<td>
										<div class="cluster" style="gap:0.6rem">
											<Avatar src={m.avatar} name={m.displayName} seed={m.id} size={34} />
											<div>
												<div style="font-weight:600">{m.displayName}</div>
												<CopyId value={m.id} short />
											</div>
										</div>
									</td>
									<td>
										<form method="POST" action="?/setLevel" use:enhance class="cluster" style="gap:0.4rem">
											<input type="hidden" name="guild_id" value={gid} />
											<input type="hidden" name="user_id" value={m.id} />
											<input name="level" type="number" min="0" placeholder="level" style="width:90px" required />
											<button class="btn small">Set</button>
										</form>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}

	<!-- APPEND-TABLE -->

	<div class="section">
		<h2>👥 Tracked members</h2>
		{#if data.users.length === 0}
			<div class="empty"><span class="big">👥</span><span>No user level data yet for this server.</span></div>
		{:else}
			<div class="table-wrap scroll">
				<table>
					<thead>
						<tr><th>Member</th><th style="width:230px">Level & progress</th><th style="width:190px">XP</th><th class="right">Actions</th></tr>
					</thead>
					<tbody>
						{#each data.users as u (u.id)}
							{@const m = members[u.user_id]}
							{@const p = levelProgress(u.xp)}
							<tr>
								<td>
									<div class="cluster" style="gap:0.6rem">
										<Avatar src={m?.avatar ?? ''} name={m?.displayName ?? u.user_id} seed={u.user_id} size={34} />
										<div style="min-width:0">
											{#if m}
												<div style="font-weight:600">{m.displayName}{#if m.left}<span class="badge neutral" style="margin-left:0.4rem">left</span>{/if}</div>
											{/if}
											<CopyId value={u.user_id} short />
										</div>
									</div>
								</td>
								<td>
									<div class="cluster" style="gap:0.5rem;margin-bottom:0.35rem">
										<span class="lvl-chip">Lv {u.level}</span>
										<span class="faint" style="font-size:0.76rem">{p.into}/{p.span}</span>
									</div>
									<div class="progress"><span style="width:{p.pct}%"></span></div>
								</td>
								<td>
									<form method="POST" action="?/setXp" use:enhance class="cluster" style="gap:0.4rem">
										<input type="hidden" name="guild_id" value={gid} />
										<input type="hidden" name="user_id" value={u.user_id} />
										<input name="xp" type="number" min="0" value={u.xp} style="width:110px" />
										<button class="btn small secondary">Save</button>
									</form>
								</td>
								<td class="right">
									<div class="cluster" style="justify-content:flex-end;gap:0.4rem">
										<details>
											<summary class="btn secondary small">Set level</summary>
											<form method="POST" action="?/setLevel" use:enhance class="card popover" style="min-width:200px">
												<input type="hidden" name="guild_id" value={gid} />
												<input type="hidden" name="user_id" value={u.user_id} />
												<label for="sl-{u.id}">New level</label>
												<input id="sl-{u.id}" name="level" type="number" min="0" placeholder="level" required />
												<button class="btn small block" style="margin-top:0.5rem">Apply</button>
											</form>
										</details>
										<form method="POST" action="?/resetUser" use:enhance onsubmit={(e) => confirmReset(e, m?.displayName ?? u.user_id)}>
											<input type="hidden" name="guild_id" value={gid} />
											<input type="hidden" name="user_id" value={u.user_id} />
											<button class="btn danger secondary small">Reset</button>
										</form>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			{#if data.totalPages > 1}
				<div class="cluster" style="margin-top:1rem;justify-content:center">
					{#if data.page > 1}<a class="btn secondary small" href="?page={data.page - 1}">← Prev</a>{/if}
					<span class="muted">Page {data.page} / {data.totalPages}</span>
					{#if data.page < data.totalPages}<a class="btn secondary small" href="?page={data.page + 1}">Next →</a>{/if}
				</div>
			{/if}
		{/if}
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
