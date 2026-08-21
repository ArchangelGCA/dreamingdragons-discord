<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Banner from '$lib/components/Banner.svelte';
	import RoleSelect from '$lib/components/RoleSelect.svelte';
	import ChannelSelect from '$lib/components/ChannelSelect.svelte';
	import RoleBadge from '$lib/components/RoleBadge.svelte';
	import CopyId from '$lib/components/CopyId.svelte';
	import type { RoleDTO } from '$lib/server/bot';

	let { data } = $props();

	const guild = $derived(data.guild);
	const gid = $derived(data.gid);
	const online = $derived(!!guild?.botOnline);
	const roleById = $derived(new Map<string, RoleDTO>(data.roles.map((r) => [r.id, r])));
	const channelName = $derived(new Map(data.channels.map((c) => [c.id, c.name])));
	const styles = ['primary', 'secondary', 'success', 'danger'];

	// Which builder panel is open. Auto-opens "reuse" when a channel is being browsed.
	// Intentional one-time capture of the initial prop (URL query) — panel is user-controlled after.
	let panel = $state<'closed' | 'new' | 'reuse'>(
		untrack(() => data.adoptChannel) ? 'reuse' : 'closed'
	);

	// New-message builder state.
	let createMode = $state<'button' | 'reaction'>('button');
	let createRows = $state([{ key: 1 }]);
	let createKey = 2;
	const addCreateRow = () => (createRows = [...createRows, { key: createKey++ }]);
	const removeCreateRow = (k: number) => (createRows = createRows.filter((r) => r.key !== k));

	// Reuse-existing builder state.
	let adoptMode = $state<'button' | 'reaction'>('button');
	let adoptRows = $state([{ key: 1 }]);
	let adoptKey = 2;
	let adoptMessageId = $state('');
	const addAdoptRow = () => (adoptRows = [...adoptRows, { key: adoptKey++ }]);
	const removeAdoptRow = (k: number) => (adoptRows = adoptRows.filter((r) => r.key !== k));

	// Busy tracking so each submitting form can show a spinner.
	let busy = $state<string | null>(null);
	function track(key: string, onSuccess?: () => void): SubmitFunction {
		return () => {
			busy = key;
			return async ({ result, update }) => {
				await update();
				busy = null;
				if (onSuccess && result.type === 'success') onSuccess();
			};
		};
	}
	function resetCreate() {
		createRows = [{ key: createKey++ }];
	}
	function resetAdopt() {
		adoptMessageId = '';
		adoptRows = [{ key: adoptKey++ }];
	}

	// Deterministic (UTC) timestamp so SSR and client render identically.
	function fmtDate(ts: number) {
		return new Date(ts).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
	}
</script>

<!-- Shared role-entry row for both the "new" and "reuse" builders. -->
{#snippet entryRow(mode: 'button' | 'reaction', canRemove: boolean, onRemove: () => void)}
	<div class="entry-row">
		<div class="grow2">
			<RoleSelect name="role_id" roles={data.roles} assignableOnly required />
		</div>
		<input
			name="emoji"
			class="grow"
			placeholder={mode === 'reaction' ? 'emoji (required)' : 'emoji (optional)'}
		/>
		{#if mode === 'button'}
			<input name="label" class="grow" placeholder="button label" />
			<select name="style" class="style-sel">
				{#each styles as st (st)}<option value={st}>{st}</option>{/each}
			</select>
		{:else}
			<input type="hidden" name="label" value="" />
			<input type="hidden" name="style" value="" />
		{/if}
		<button
			type="button"
			class="btn danger secondary small"
			onclick={onRemove}
			disabled={!canRemove}
			aria-label="Remove role">✕</button
		>
	</div>
{/snippet}

<div class="topbar">
	<div>
		<h1>Reaction Roles</h1>
		<p class="muted">
			{data.total} entr{data.total === 1 ? 'y' : 'ies'} across {data.groups.length} message{data
				.groups.length === 1
				? ''
				: 's'}.
		</p>
	</div>
	{#if gid && online}
		<div class="cluster">
			<button
				class="btn secondary"
				class:active={panel === 'reuse'}
				onclick={() => (panel = panel === 'reuse' ? 'closed' : 'reuse')}>♻️ Reuse existing</button
			>
			<button
				class="btn"
				class:active={panel === 'new'}
				onclick={() => (panel = panel === 'new' ? 'closed' : 'new')}>＋ New message</button
			>
		</div>
	{/if}
</div>

{#if !gid}
	<Banner kind="warn">Select a server from the sidebar to manage its reaction roles.</Banner>
{:else if guild && !online}
	<Banner kind="warn"
		>Bot is offline — creating and editing reaction roles is unavailable (they post to Discord).
		Existing configuration is still shown below.</Banner
	>
{/if}

{#if gid && online && panel === 'new'}
	<div class="card section builder">
		<h2>✨ New reaction-role message</h2>
		<form method="POST" action="?/createMessage" use:enhance={track('create', resetCreate)}>
			<input type="hidden" name="guild_id" value={gid} />
			<div class="row">
				<div class="grow2">
					<label for="c-channel">Channel</label>
					<ChannelSelect id="c-channel" name="channel_id" channels={data.channels} required />
				</div>
				<div>
					<label for="c-mode">Type</label>
					<select id="c-mode" name="mode" bind:value={createMode}>
						<option value="button">Buttons (recommended)</option>
						<option value="reaction">Emoji reactions</option>
					</select>
				</div>
			</div>

			<div class="row">
				<div class="grow2">
					<label for="c-title">Embed title (optional)</label>
					<input id="c-title" name="title" placeholder="Pick your roles" />
				</div>
				<div>
					<label for="c-color">Color (optional)</label>
					<input id="c-color" name="color" placeholder="#8b5cf6" />
				</div>
			</div>
			<label for="c-desc">Message / description</label>
			<textarea id="c-desc" name="description" rows="3" required placeholder="Select your roles below:"
			></textarea>

			<div class="entries-head">
				<h3>Roles</h3>
				<span class="muted hint"
					>{createMode === 'reaction'
						? 'Emoji required for each role.'
						: 'Emoji optional; label shown on the button.'}</span
				>
			</div>
			{#each createRows as row (row.key)}
				{@render entryRow(createMode, createRows.length > 1, () => removeCreateRow(row.key))}
			{/each}
			<button type="button" class="btn ghost small add-row" onclick={addCreateRow}>＋ Add role</button>

			<div class="builder-actions">
				<button class="btn" disabled={busy === 'create'}>
					{#if busy === 'create'}<span class="spinner"></span>{/if} Create &amp; post to Discord
				</button>
			</div>
		</form>
	</div>
{/if}

{#if gid && online && panel === 'reuse'}
	<div class="card section builder">
		<h2>♻️ Reuse an existing message</h2>
		<p class="muted hint reuse-lead">
			Turn a message the bot has already posted into a reaction-role message — handy for restoring
			roles after a lost database. Only messages authored by the bot can be reused.
		</p>

		<form method="GET" class="row browse">
			<div class="grow2">
				<label for="adopt-channel">Channel to browse</label>
				<ChannelSelect
					id="adopt-channel"
					name="adoptChannel"
					channels={data.channels}
					value={data.adoptChannel}
					required
				/>
			</div>
			<button class="btn secondary">🔍 Browse messages</button>
		</form>

		{#if data.adoptChannel}
			{#if data.botMessages.length === 0}
				<div class="empty">
					<span class="big">📭</span>
					<span>No bot-authored messages found in #{channelName.get(data.adoptChannel) ?? data.adoptChannel}.</span>
				</div>
			{:else}
				<form method="POST" action="?/adoptMessage" use:enhance={track('adopt', resetAdopt)}>
					<input type="hidden" name="guild_id" value={gid} />
					<input type="hidden" name="channel_id" value={data.adoptChannel} />

					<h3 class="step">1 · Pick a message</h3>
					<div class="msg-list">
						{#each data.botMessages as m (m.id)}
							<label class="msg-opt" class:disabled={m.managed} class:sel={adoptMessageId === m.id}>
								<input
									type="radio"
									name="message_id"
									value={m.id}
									bind:group={adoptMessageId}
									disabled={m.managed}
									required
								/>
								<div class="msg-body">
									<div class="msg-preview">{m.preview || '(no text content)'}</div>
									<div class="msg-meta">
										{#if m.hasEmbed}<span class="badge neutral">embed</span>{/if}
										{#if m.hasComponents}<span class="badge neutral">buttons</span>{/if}
										{#if m.reactionCount > 0}<span class="badge neutral"
												>{m.reactionCount} reaction{m.reactionCount === 1 ? '' : 's'}</span
											>{/if}
										{#if m.managed}<span class="badge accent">already reaction-role</span>{/if}
										<span class="muted tiny">{fmtDate(m.createdTimestamp)}</span>
										<CopyId value={m.id} short />
									</div>
								</div>
							</label>
						{/each}
					</div>

					<div class="row" style="margin-top:1rem">
						<div>
							<label for="adopt-mode">Type</label>
							<select id="adopt-mode" name="mode" bind:value={adoptMode}>
								<option value="button">Buttons</option>
								<option value="reaction">Emoji reactions</option>
							</select>
						</div>
						<p class="muted hint grow" style="align-self:center;margin:0">
							{adoptMode === 'button'
								? 'Buttons are added to the message (it must be bot-authored).'
								: 'Emoji reactions are added directly to the message.'}
						</p>
					</div>

					<div class="entries-head">
						<h3 class="step">2 · Attach roles</h3>
						<span class="muted hint"
							>{adoptMode === 'reaction'
								? 'Emoji required for each role.'
								: 'Emoji optional; label shown on the button.'}</span
						>
					</div>
					{#each adoptRows as row (row.key)}
						{@render entryRow(adoptMode, adoptRows.length > 1, () => removeAdoptRow(row.key))}
					{/each}
					<button type="button" class="btn ghost small add-row" onclick={addAdoptRow}>＋ Add role</button>

					<div class="builder-actions">
						<button class="btn" disabled={busy === 'adopt' || !adoptMessageId}>
							{#if busy === 'adopt'}<span class="spinner"></span>{/if} Attach roles to this message
						</button>
					</div>
				</form>
			{/if}
		{/if}
	</div>
{/if}

{#if gid}
	<div class="section">
		<div class="between">
			<h2>📋 Configured messages</h2>
			{#if data.groups.length > 0}<span class="chip">{data.groups.length}</span>{/if}
		</div>

		{#if data.groups.length === 0}
			<div class="empty">
				<span class="big">🏷️</span>
				<span>No reaction roles configured for this server yet.</span>
			</div>
		{:else}
			<div class="stack">
				{#each data.groups as g (g.message_id)}
					<div class="card group" class:missing={g.exists === false}>
						<div class="group-head">
							<div class="stack" style="gap:0.35rem">
								<div class="cluster">
									<strong class="chan">#{channelName.get(g.channel_id) ?? g.channel_id}</strong>
									<span class="badge {g.type === 'button' ? 'accent' : 'neutral'}">{g.type}</span>
									{#if g.exists === false}<span class="badge off">missing on Discord</span>{/if}
								</div>
								<div class="cluster tiny muted">
									<span>Message</span><CopyId value={g.message_id} short />
								</div>
							</div>
							<details class="del">
								<summary class="btn danger secondary small">Delete…</summary>
								<form
									method="POST"
									action="?/deleteMessage"
									use:enhance={track('delete-' + g.message_id)}
									class="card popover"
								>
									<input type="hidden" name="guild_id" value={gid} />
									<input type="hidden" name="message_id" value={g.message_id} />
									<label class="switch">
										<input type="checkbox" name="delete_discord" />
										<span class="track"></span>
										Also delete the Discord message
									</label>
									<button
										class="btn danger small block"
										style="margin-top:0.6rem"
										disabled={!online || busy === 'delete-' + g.message_id}
									>
										{#if busy === 'delete-' + g.message_id}<span class="spinner"></span>{/if} Confirm delete
									</button>
								</form>
							</details>
						</div>

						{#if g.exists === false}
							<div class="resend">
								<div class="resend-note">
									⚠️ This message no longer exists on Discord. Re-post it to restore its {g.type} roles{#if g.type === 'reaction'}
										(emoji reactions){/if}. The embed text isn't stored, so set it below.
								</div>
								<details>
									<summary class="btn small">Re-post message…</summary>
									<form
										method="POST"
										action="?/resendMessage"
										use:enhance={track('resend-' + g.message_id)}
										class="card popover"
									>
										<input type="hidden" name="guild_id" value={gid} />
										<input type="hidden" name="message_id" value={g.message_id} />
										<label for="rs-chan-{g.message_id}">Channel</label>
										<ChannelSelect
											id="rs-chan-{g.message_id}"
											name="channel_id"
											channels={data.channels}
											value={g.channel_id}
										/>
										<label for="rs-title-{g.message_id}">Embed title (optional)</label>
										<input id="rs-title-{g.message_id}" name="title" placeholder="Pick your roles" />
										<label for="rs-desc-{g.message_id}">Description</label>
										<textarea
											id="rs-desc-{g.message_id}"
											name="description"
											rows="2"
											placeholder="Select your roles below:"
										></textarea>
										<label for="rs-color-{g.message_id}">Color hex</label>
										<input id="rs-color-{g.message_id}" name="color" placeholder="#8b5cf6" />
										<button
											class="btn small block"
											style="margin-top:0.6rem"
											disabled={!online || busy === 'resend-' + g.message_id}
										>
											{#if busy === 'resend-' + g.message_id}<span class="spinner"></span>{/if} Re-post to Discord
										</button>
									</form>
								</details>
							</div>
						{/if}

						<div class="table-wrap scroll">
							<table>
								<thead>
									<tr><th>Emoji / Label</th><th>Style</th><th>Role</th><th></th></tr>
								</thead>
								<tbody>
									{#each g.entries as e (e.id)}
										{@const role = roleById.get(e.role_id)}
										<tr>
											<td>
												<span class="emoji">{e.emoji_identifier || '—'}</span>
												{#if e.label}<span class="lbl">"{e.label}"</span>{/if}
											</td>
											<td>
												{#if e.button_style}<span class="badge neutral">{e.button_style}</span>{:else}<span
														class="muted">—</span
													>{/if}
											</td>
											<td><RoleBadge name={role?.name ?? null} color={role?.color ?? null} id={e.role_id} /></td>
											<td class="right">
												<div class="cluster" style="justify-content:flex-end;gap:0.4rem">
													<details>
														<summary class="btn secondary small">Edit</summary>
														<form
															method="POST"
															action="?/editEntry"
															use:enhance={track('edit-' + e.id)}
															class="card popover"
														>
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
															<button class="btn small block" style="margin-top:0.6rem" disabled={!online || busy === 'edit-' + e.id}>
																{#if busy === 'edit-' + e.id}<span class="spinner"></span>{/if} Save
															</button>
														</form>
													</details>
													<form method="POST" action="?/removeEntry" use:enhance={track('remove-' + e.id)}>
														<input type="hidden" name="guild_id" value={gid} />
														<input type="hidden" name="record_id" value={e.id} />
														<button class="btn danger secondary small" disabled={!online || busy === 'remove-' + e.id} aria-label="Remove role">✕</button>
													</form>
												</div>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>

						<div class="group-actions">
							<details class="grow">
								<summary class="btn ghost small">＋ Add role</summary>
								<form
									method="POST"
									action="?/addEntry"
									use:enhance={track('add-' + g.message_id)}
									class="card popover"
								>
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
										<select id="add-style-{g.message_id}" name="style"
											>{#each styles as st (st)}<option value={st}>{st}</option>{/each}</select
										>
									{/if}
									<button class="btn small block" style="margin-top:0.6rem" disabled={!online || busy === 'add-' + g.message_id}>
										{#if busy === 'add-' + g.message_id}<span class="spinner"></span>{/if} Add role
									</button>
								</form>
							</details>
							<details class="grow">
								<summary class="btn ghost small">✎ Edit message text</summary>
								<form
									method="POST"
									action="?/updateEmbed"
									use:enhance={track('embed-' + g.message_id)}
									class="card popover"
								>
									<input type="hidden" name="guild_id" value={gid} />
									<input type="hidden" name="message_id" value={g.message_id} />
									<p class="muted hint" style="margin:0 0 0.5rem">Leave a field blank to keep its current value.</p>
									<label for="embed-title-{g.message_id}">Title</label>
									<input id="embed-title-{g.message_id}" name="title" />
									<label for="embed-desc-{g.message_id}">Description</label>
									<textarea id="embed-desc-{g.message_id}" name="description" rows="2"></textarea>
									<label for="embed-color-{g.message_id}">Color hex</label>
									<input id="embed-color-{g.message_id}" name="color" placeholder="#8b5cf6" />
									<button class="btn small block" style="margin-top:0.6rem" disabled={!online || busy === 'embed-' + g.message_id}>
										{#if busy === 'embed-' + g.message_id}<span class="spinner"></span>{/if} Update
									</button>
								</form>
							</details>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	.btn.active {
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 55%, transparent);
	}
	.hint {
		font-size: 0.82rem;
	}
	.tiny {
		font-size: 0.75rem;
	}

	/* Builder panels (new / reuse) */
	.builder h2 {
		margin-top: 0;
	}
	.reuse-lead {
		max-width: 62ch;
		margin: -0.2rem 0 0.9rem;
	}
	.browse {
		align-items: flex-end;
		margin-bottom: 0.4rem;
	}
	.grow2 {
		flex: 2;
		min-width: 160px;
	}
	.style-sel {
		flex: 0 0 120px;
	}
	.entry-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		margin-top: 0.5rem;
		flex-wrap: wrap;
	}
	.entries-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin: 1.15rem 0 0.15rem;
	}
	.entries-head h3 {
		margin: 0;
		font-size: 1rem;
	}
	.add-row {
		margin-top: 0.6rem;
	}
	.builder-actions {
		margin-top: 1.15rem;
	}
	/* Reuse: message picker */
	.step {
		font-size: 0.95rem;
		margin: 1.1rem 0 0.5rem;
	}
	.msg-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.msg-opt {
		display: flex;
		gap: 0.6rem;
		align-items: flex-start;
		padding: 0.6rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: border-color var(--t), background var(--t);
	}
	.msg-opt:hover {
		border-color: var(--border-strong);
	}
	.msg-opt.sel {
		border-color: color-mix(in srgb, var(--accent) 55%, transparent);
		background: var(--accent-grad-soft);
	}
	.msg-opt.disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.msg-opt input[type='radio'] {
		margin-top: 0.2rem;
		width: auto;
		flex: 0 0 auto;
	}
	.msg-body {
		min-width: 0;
		flex: 1;
	}
	.msg-preview {
		font-size: 0.88rem;
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.msg-meta {
		display: flex;
		gap: 0.4rem;
		align-items: center;
		flex-wrap: wrap;
		margin-top: 0.35rem;
	}
	/* Group cards */
	.group-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.group.missing {
		border-color: rgba(239, 68, 68, 0.4);
	}
	.chan {
		font-size: 1rem;
	}
	.resend {
		margin-top: 0.75rem;
	}
	.resend-note {
		background: rgba(245, 158, 11, 0.12);
		border: 1px solid rgba(245, 158, 11, 0.4);
		border-radius: var(--radius-sm);
		padding: 0.6rem 0.8rem;
		font-size: 0.85rem;
		margin-bottom: 0.5rem;
	}
	.group-actions {
		display: flex;
		gap: 0.75rem;
		margin-top: 0.75rem;
		flex-wrap: wrap;
	}
	.emoji {
		font-size: 1rem;
	}
	.lbl {
		color: var(--text-muted);
		font-size: 0.85rem;
		margin-left: 0.3rem;
	}
	details {
		position: relative;
	}
	details > summary {
		display: inline-flex;
	}
</style>
