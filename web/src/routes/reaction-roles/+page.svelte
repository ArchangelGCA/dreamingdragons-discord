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
	const styles = ['primary', 'secondary', 'success', 'danger'];

	let showCreate = $state(false);
	let mode = $state<'button' | 'reaction'>('button');
	let rows = $state([{ key: 1 }]);
	let nextKey = 2;

	function addRow() {
		rows = [...rows, { key: nextKey++ }];
	}
	function removeRow(key: number) {
		rows = rows.filter((r) => r.key !== key);
	}
</script>

<div class="topbar">
	<div>
		<h1>Reaction Roles</h1>
		<p class="muted">{data.total} entr(ies) across {data.groups.length} message(s).</p>
	</div>
	{#if gid && guild?.botOnline}
		<button class="btn" onclick={() => (showCreate = !showCreate)}>
			{showCreate ? 'Close' : '+ New message'}
		</button>
	{/if}
</div>

{#if !gid}
	<Banner kind="warn">Select a server from the sidebar to manage its reaction roles.</Banner>
{:else if guild && !guild.botOnline}
	<Banner kind="warn">Bot is offline — creating/editing reaction roles is unavailable (it posts to Discord). You can still view existing ones below.</Banner>
{/if}

{#if form?.success}<div class="alert success">{form.success}</div>{/if}
{#if form?.error}<div class="alert error">{form.error}</div>{/if}

<!-- APPEND-CREATE -->

{#if gid && showCreate && guild?.botOnline}
	<div class="card section">
		<h2>New reaction-role message</h2>
		<form method="POST" action="?/createMessage" use:enhance>
			<input type="hidden" name="guild_id" value={gid} />
			<div class="row">
				<div style="flex:2">
					<label for="c-channel">Channel</label>
					<ChannelSelect id="c-channel" name="channel_id" channels={data.channels} required />
				</div>
				<div>
					<label for="c-mode">Type</label>
					<select id="c-mode" name="mode" bind:value={mode}>
						<option value="button">Buttons (recommended)</option>
						<option value="reaction">Emoji reactions</option>
					</select>
				</div>
			</div>

			<label for="c-title">Embed title (optional)</label>
			<input id="c-title" name="title" />
			<label for="c-desc">Message / description</label>
			<textarea id="c-desc" name="description" rows="3" required></textarea>
			<label for="c-color">Embed color hex (optional, e.g. #5865f2)</label>
			<input id="c-color" name="color" placeholder="#5865f2" />

			<h3 style="margin:1rem 0 0.5rem;font-size:1rem">Roles</h3>
			{#each rows as row (row.key)}
				<div class="entry-row">
					<div style="flex:2">
						<RoleSelect name="role_id" roles={data.roles} assignableOnly required />
					</div>
					<input name="emoji" placeholder={mode === 'reaction' ? 'emoji (required)' : 'emoji (optional)'} style="flex:1" />
					{#if mode === 'button'}
						<input name="label" placeholder="button label" style="flex:1" />
						<select name="style" style="flex:0 0 120px">
							{#each styles as st (st)}<option value={st}>{st}</option>{/each}
						</select>
					{:else}
						<input type="hidden" name="label" value="" />
						<input type="hidden" name="style" value="" />
					{/if}
					<button type="button" class="btn danger small" onclick={() => removeRow(row.key)} disabled={rows.length === 1}>✕</button>
				</div>
			{/each}
			<button type="button" class="btn secondary small" onclick={addRow} style="margin-top:0.5rem">+ Add role</button>

			<div style="margin-top:1rem">
				<button class="btn">Create & post to Discord</button>
			</div>
		</form>
	</div>
{/if}

<!-- APPEND-GROUPS -->

{#if gid}
	{#if data.groups.length === 0}
		<div class="card muted">No reaction roles configured for this server yet.</div>
	{:else}
		{#each data.groups as g (g.message_id)}
			<div class="card section">
				<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:0.5rem">
					<div>
						<strong>#{channelName.get(g.channel_id) ?? g.channel_id}</strong>
						<span class="badge {g.type === 'button' ? 'on' : 'off'}" style="margin-left:0.5rem">{g.type}</span>
						<div class="muted" style="font-size:0.8rem">Message <code>{g.message_id}</code></div>
					</div>
					<details>
						<summary class="btn danger small">Delete…</summary>
						<form method="POST" action="?/deleteMessage" use:enhance class="card" style="margin-top:0.5rem">
							<input type="hidden" name="guild_id" value={gid} />
							<input type="hidden" name="message_id" value={g.message_id} />
							<label style="display:flex;gap:0.4rem;align-items:center">
								<input type="checkbox" name="delete_discord" style="width:auto" /> Also delete the Discord message
							</label>
							<button class="btn danger small" style="margin-top:0.5rem" disabled={!guild?.botOnline}>Confirm delete</button>
						</form>
					</details>
				</div>

				<table style="margin-top:0.75rem">
					<thead><tr><th>Emoji / Label</th><th>Style</th><th>Role</th><th></th></tr></thead>
					<tbody>
						{#each g.entries as e (e.id)}
							<tr>
								<td>{e.emoji_identifier || '—'} {e.label ? `"${e.label}"` : ''}</td>
								<td>{e.button_style || '—'}</td>
								<td>{#if roleName.has(e.role_id)}@{roleName.get(e.role_id)}{:else}<code>{e.role_id}</code>{/if}</td>
								<td style="text-align:right">
									<div style="display:flex;gap:0.4rem;justify-content:flex-end">
										<details>
											<summary class="btn secondary small">Edit</summary>
											<form method="POST" action="?/editEntry" use:enhance class="card edit-pop">
												<input type="hidden" name="guild_id" value={gid} />
												<input type="hidden" name="record_id" value={e.id} />
												<label for="edit-role-{e.id}">Role</label>
												<RoleSelect id="edit-role-{e.id}" name="role_id" roles={data.roles} assignableOnly value={e.role_id} />
												<label for="edit-emoji-{e.id}">Emoji</label>
												<input id="edit-emoji-{e.id}" name="emoji" value={e.emoji_identifier} />
												{#if g.type === 'button'}
													<label for="edit-label-{e.id}">Label</label>
													<input id="edit-label-{e.id}" name="label" value={e.label} />
													<label for="edit-style-{e.id}">Style</label>
													<select id="edit-style-{e.id}" name="style" value={e.button_style || 'secondary'}>
														{#each styles as st (st)}<option value={st}>{st}</option>{/each}
													</select>
												{/if}
												<button class="btn small" style="margin-top:0.5rem" disabled={!guild?.botOnline}>Save</button>
											</form>
										</details>
										<form method="POST" action="?/removeEntry" use:enhance>
											<input type="hidden" name="guild_id" value={gid} />
											<input type="hidden" name="record_id" value={e.id} />
											<button class="btn danger small" disabled={!guild?.botOnline}>✕</button>
										</form>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>

				<div class="row" style="margin-top:0.75rem;gap:1rem">
					<details style="flex:1">
						<summary class="btn secondary small">+ Add role</summary>
						<form method="POST" action="?/addEntry" use:enhance class="card" style="margin-top:0.5rem">
							<input type="hidden" name="guild_id" value={gid} />
							<input type="hidden" name="message_id" value={g.message_id} />
							<label for="add-role-{g.message_id}">Role</label>
							<RoleSelect id="add-role-{g.message_id}" name="role_id" roles={data.roles} assignableOnly required />
							<label for="add-emoji-{g.message_id}">Emoji {g.type === 'reaction' ? '(required)' : '(optional)'}</label>
							<input id="add-emoji-{g.message_id}" name="emoji" />
							{#if g.type === 'button'}
								<label for="add-label-{g.message_id}">Label</label>
								<input id="add-label-{g.message_id}" name="label" />
								<label for="add-style-{g.message_id}">Style</label>
								<select id="add-style-{g.message_id}" name="style">{#each styles as st (st)}<option value={st}>{st}</option>{/each}</select>
							{/if}
							<button class="btn small" style="margin-top:0.5rem" disabled={!guild?.botOnline}>Add</button>
						</form>
					</details>
					<details style="flex:1">
						<summary class="btn secondary small">Edit message text</summary>
						<form method="POST" action="?/updateEmbed" use:enhance class="card" style="margin-top:0.5rem">
							<input type="hidden" name="guild_id" value={gid} />
							<input type="hidden" name="message_id" value={g.message_id} />
							<p class="muted" style="font-size:0.8rem;margin:0 0 0.5rem">Leave a field blank to keep its current value.</p>
							<label for="embed-title-{g.message_id}">Title</label>
							<input id="embed-title-{g.message_id}" name="title" />
							<label for="embed-desc-{g.message_id}">Description</label>
							<textarea id="embed-desc-{g.message_id}" name="description" rows="2"></textarea>
							<label for="embed-color-{g.message_id}">Color hex</label>
							<input id="embed-color-{g.message_id}" name="color" placeholder="#5865f2" />
							<button class="btn small" style="margin-top:0.5rem" disabled={!guild?.botOnline}>Update</button>
						</form>
					</details>
				</div>
			</div>
		{/each}
	{/if}
{/if}

<style>
	.entry-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		margin-top: 0.5rem;
	}
	.edit-pop {
		margin-top: 0.5rem;
		min-width: 240px;
		text-align: left;
	}
	details > summary {
		list-style: none;
		display: inline-flex;
		cursor: pointer;
	}
	details > summary::-webkit-details-marker {
		display: none;
	}
</style>


