<script lang="ts">
	import { enhance } from '$app/forms';
	let { data, form } = $props();
</script>

<div class="topbar">
	<div>
		<h1>Users</h1>
		<p class="muted">{data.totalItems} tracked member(s). Editing XP recalculates the level automatically.</p>
	</div>
</div>

{#if form?.success}<div class="alert success">{form.success}</div>{/if}
{#if form?.error}<div class="alert error">{form.error}</div>{/if}

{#if data.users.length === 0}
	<div class="card muted">No user level data yet.</div>
{:else}
	<table>
		<thead>
			<tr><th>User ID</th><th>Guild ID</th><th>Level</th><th>XP</th><th>Actions</th></tr>
		</thead>
		<tbody>
			{#each data.users as u (u.id)}
				<tr>
					<td><code>{u.user_id}</code></td>
					<td><code>{u.guild_id}</code></td>
					<td>{u.level}</td>
					<td>
						<form method="POST" action="?/updateUser" use:enhance style="display:flex;gap:0.4rem;align-items:center">
							<input type="hidden" name="id" value={u.id} />
							<input name="xp" type="number" min="0" value={u.xp} style="width:110px" />
							<button class="btn small">Save</button>
						</form>
					</td>
					<td>
						<form method="POST" action="?/deleteUser" use:enhance>
							<input type="hidden" name="id" value={u.id} />
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
