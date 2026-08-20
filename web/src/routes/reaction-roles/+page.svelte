<script lang="ts">
	import { enhance } from '$app/forms';
	let { data, form } = $props();
</script>

<div class="topbar">
	<div>
		<h1>Reaction Roles</h1>
		<p class="muted">{data.total} entr(ies) across {data.groups.length} message(s). Create new ones with <code>/reactionrole</code> in Discord.</p>
	</div>
</div>

{#if form?.success}<div class="alert success">{form.success}</div>{/if}
{#if form?.error}<div class="alert error">{form.error}</div>{/if}

{#if data.groups.length === 0}
	<div class="card muted">No reaction roles configured yet.</div>
{:else}
	{#each data.groups as g (g.message_id)}
		<div class="card section">
			<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem">
				<div>
					<strong>Message <code>{g.message_id}</code></strong>
					<span class="badge {g.type === 'button' ? 'on' : 'off'}" style="margin-left:0.5rem">{g.type}</span>
					<div class="muted" style="font-size:0.8rem">Guild <code>{g.guild_id}</code> · Channel <code>{g.channel_id}</code></div>
				</div>
				<form method="POST" action="?/deleteMessage" use:enhance>
					<input type="hidden" name="message_id" value={g.message_id} />
					<button class="btn danger small">Delete all</button>
				</form>
			</div>

			<table style="margin-top:0.75rem">
				<thead>
					<tr><th>Emoji / Label</th><th>Style</th><th>Role ID</th><th></th></tr>
				</thead>
				<tbody>
					{#each g.entries as e (e.id)}
						<tr>
							<td>{e.emoji_identifier || '—'} {e.label ? `"${e.label}"` : ''}</td>
							<td>{e.button_style || '—'}</td>
							<td><code>{e.role_id}</code></td>
							<td style="text-align:right">
								<form method="POST" action="?/deleteEntry" use:enhance>
									<input type="hidden" name="id" value={e.id} />
									<button class="btn danger small">Delete</button>
								</form>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/each}
{/if}
