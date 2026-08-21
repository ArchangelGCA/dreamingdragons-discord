<script lang="ts">
	import type { RoleDTO, ChannelDTO } from '$lib/server/bot';

	let {
		name,
		roles = [],
		channels = [],
		value = $bindable(''),
		rows = 3,
		required = false,
		placeholder = '',
		id = name
	}: {
		name: string;
		roles?: RoleDTO[];
		channels?: ChannelDTO[];
		value?: string;
		rows?: number;
		required?: boolean;
		placeholder?: string;
		id?: string;
	} = $props();

	let ta = $state<HTMLTextAreaElement | null>(null);

	/**
	 * Insert a mention token (`<@&id>` for roles, `<#id>` for channels — the
	 * syntax Discord renders as a real ping/link) at the current caret, or at
	 * the end if the field isn't focused. Keeps the surrounding text intact.
	 */
	function insert(token: string) {
		const el = ta;
		if (!el) {
			value = (value ? value + ' ' : '') + token + ' ';
			return;
		}
		const start = el.selectionStart ?? value.length;
		const end = el.selectionEnd ?? value.length;
		const before = value.slice(0, start);
		const after = value.slice(end);
		// Add a space before the token if the preceding char isn't whitespace.
		const pad = before && !/\s$/.test(before) ? ' ' : '';
		const insertText = pad + token + ' ';
		value = before + insertText + after;
		const caret = start + insertText.length;
		// Restore focus/caret after Svelte updates the value.
		requestAnimationFrame(() => {
			el.focus();
			el.setSelectionRange(caret, caret);
		});
	}

	// A single <select> that inserts on change, then resets to its placeholder.
	function onRolePick(e: Event) {
		const sel = e.currentTarget as HTMLSelectElement;
		if (sel.value) insert(`<@&${sel.value}>`);
		sel.value = '';
	}
	function onChannelPick(e: Event) {
		const sel = e.currentTarget as HTMLSelectElement;
		if (sel.value) insert(`<#${sel.value}>`);
		sel.value = '';
	}
</script>

<div class="mention-field">
	<textarea {id} {name} {rows} {required} {placeholder} bind:this={ta} bind:value></textarea>
	{#if roles.length > 0 || channels.length > 0}
		<div class="mention-tools">
			<span class="mention-hint">Insert:</span>
			{#if roles.length > 0}
				<select class="mention-sel" aria-label="Mention a role" onchange={onRolePick}>
					<option value="">＠ role…</option>
					{#each roles as r (r.id)}
						<option value={r.id}>{r.name}</option>
					{/each}
				</select>
			{/if}
			{#if channels.length > 0}
				<select class="mention-sel" aria-label="Mention a channel" onchange={onChannelPick}>
					<option value="">＃ channel…</option>
					{#each channels as c (c.id)}
						<option value={c.id}>#{c.name}</option>
					{/each}
				</select>
			{/if}
		</div>
	{/if}
</div>

<style>
	.mention-field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.mention-tools {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.mention-hint {
		font-size: 0.78rem;
		color: var(--text-muted);
		font-weight: 600;
	}
	.mention-sel {
		width: auto;
		min-width: 130px;
		padding: 0.35rem 1.8rem 0.35rem 0.6rem;
		font-size: 0.82rem;
	}
</style>
