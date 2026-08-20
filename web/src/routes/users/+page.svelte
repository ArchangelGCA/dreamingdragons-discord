<script lang="ts">
	import { enhance } from '$app/forms';
	import Banner from '$lib/components/Banner.svelte';

	let { data, form } = $props();
	const guild = $derived(data.guild);
	const gid = $derived(data.gid);
	const members = $derived(data.members);
</script>

<div class="topbar">
	<div>
		<h1>Users</h1>
		<p class="muted">{data.totalItems} tracked member(s). Editing XP re-syncs reward roles when the bot is online.</p>
	</div>
</div>

{#if !gid}
	<Banner kind="warn">Select a server from the sidebar to manage its members.</Banner>
{:else if guild && !guild.botOnline}
	<Banner kind="warn">Bot is offline — names/avatars and role re-sync are unavailable.</Banner>
{/if}

{#if form?.success}<div class="alert success">{form.success}</div>{/if}
{#if form?.error}<div class="alert error">{form.error}</div>{/if}

{#if gid}
	{#if guild?.botOnline}
		<div class="section">
			<h2>Find a member</h2>
			<form method="GET" class="card" style="margin-bottom:0.5rem">
				<div class="row">
					<div style="flex:2">
						<label for="q">Search by name</label>
						<input id="q" name="q" value={data.q} placeholder="username or nickname" />
					</div>
					<div style="flex:0"><button class="btn">Search</button></div>
				</div>
			</form>
			{#if data.search.length > 0}
				<table>
					<thead><tr><th>Member</th><th>Set level</th></tr></thead>
					<tbody>
						{#each data.search as m (m.id)}
							<tr>
								<td>
									<div style="display:flex;align-items:center;gap:0.5rem">
										<img src={m.avatar} alt="" width="24" height="24" style="border-radius:50%" />
										<span>{m.displayName}</span>
										<code>{m.id}</code>
									</div>
								</td>
								<td>
									<form method="POST" action="?/setLevel" use:enhance style="display:flex;gap:0.4rem">
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
			{/if}
		</div>
	{/if}

	<!-- APPEND-TABLE -->

	<div class="section">
		<h2>Tracked members</h2>
		{#if data.users.length === 0}
			<div class="card muted">No user level data yet for this server.</div>
		{:else}
			<table>
				<thead>
					<tr><th>Member</th><th>Level</th><th>XP</th><th>Set level</th><th></th></tr>
				</thead>
				<tbody>
					{#each data.users as u (u.id)}
						{@const m = members[u.user_id]}
						<tr>
							<td>
								<div style="display:flex;align-items:center;gap:0.5rem">
									{#if m}
										<img src={m.avatar} alt="" width="24" height="24" style="border-radius:50%" />
										<span>{m.displayName}{m.left ? ' (left)' : ''}</span>
									{:else}
										<code>{u.user_id}</code>
									{/if}
								</div>
							</td>
							<td>{u.level}</td>
							<td>
								<form method="POST" action="?/setXp" use:enhance style="display:flex;gap:0.4rem;align-items:center">
									<input type="hidden" name="guild_id" value={gid} />
									<input type="hidden" name="user_id" value={u.user_id} />
									<input name="xp" type="number" min="0" value={u.xp} style="width:110px" />
									<button class="btn small">Save</button>
								</form>
							</td>
							<td>
								<form method="POST" action="?/setLevel" use:enhance style="display:flex;gap:0.4rem">
									<input type="hidden" name="guild_id" value={gid} />
									<input type="hidden" name="user_id" value={u.user_id} />
									<input name="level" type="number" min="0" placeholder="lvl" style="width:80px" required />
									<button class="btn small secondary">Set</button>
								</form>
							</td>
							<td style="text-align:right">
								<form method="POST" action="?/resetUser" use:enhance>
									<input type="hidden" name="guild_id" value={gid} />
									<input type="hidden" name="user_id" value={u.user_id} />
									<button class="btn danger small">Reset</button>
								</form>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>

			{#if data.totalPages > 1}
				<div class="row" style="margin-top:1rem;justify-content:center;align-items:center">
					{#if data.page > 1}<a class="btn secondary small" href="?page={data.page - 1}">← Prev</a>{/if}
					<span class="muted">Page {data.page} / {data.totalPages}</span>
					{#if data.page < data.totalPages}<a class="btn secondary small" href="?page={data.page + 1}">Next →</a>{/if}
				</div>
			{/if}
		{/if}
	</div>
{/if}

