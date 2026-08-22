<script lang="ts">
	import type { RoleDTO, ChannelDTO } from '$lib/server/bot';
	import { safeColor } from '$lib/format';
	import { floating } from '$lib/actions/popover';

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

	type Suggestion =
		| { kind: 'role'; id: string; label: string; color: string | null }
		| { kind: 'channel'; id: string; label: string };

	let ta = $state<HTMLTextAreaElement | null>(null);

	// Autocomplete state. `trigger` is the '@'/'#' char position; `query` is the
	// text typed after it. A non-null trigger means the dropdown is open.
	let trigger = $state<{ char: '@' | '#'; start: number } | null>(null);
	let query = $state('');
	let active = $state(0);

	const roleName = $derived(new Map(roles.map((r) => [r.id, r])));
	const channelName = $derived(new Map(channels.map((c) => [c.id, c.name])));

	// Filtered, ranked suggestions for the current trigger + query.
	const suggestions = $derived.by<Suggestion[]>(() => {
		if (!trigger) return [];
		const q = query.toLowerCase();
		if (trigger.char === '@') {
			return roles
				.filter((r) => r.assignable !== false)
				.map((r) => ({ r, score: rank(r.name.toLowerCase(), q) }))
				.filter((x) => x.score >= 0)
				.sort((a, b) => a.score - b.score || a.r.name.localeCompare(b.r.name))
				.slice(0, 8)
				.map(({ r }) => ({ kind: 'role' as const, id: r.id, label: r.name, color: r.color }));
		}
		return channels
			.map((c) => ({ c, score: rank(c.name.toLowerCase(), q) }))
			.filter((x) => x.score >= 0)
			.sort((a, b) => a.score - b.score || a.c.name.localeCompare(b.c.name))
			.slice(0, 8)
			.map(({ c }) => ({ kind: 'channel' as const, id: c.id, label: c.name }));
	});

	// Lower score = better match. -1 means "no match".
	function rank(hay: string, q: string): number {
		if (!q) return 2;
		if (hay.startsWith(q)) return 0; // prefix match ranks first
		const i = hay.indexOf(q);
		return i === -1 ? -1 : 1; // substring match ranks second
	}

	// Re-evaluate whether we're inside a mention token as the caret moves/types.
	function refresh() {
		const el = ta;
		if (!el) return;
		const caret = el.selectionStart ?? value.length;
		const upto = value.slice(0, caret);
		// Look backwards for the nearest '@' or '#' that starts a token: it must be
		// at the start or preceded by whitespace, and the text between it and the
		// caret must contain no whitespace (so we stop matching once a space is typed).
		const m = upto.match(/(^|\s)([@#])([^\s@#]*)$/);
		if (m) {
			const char = m[2] as '@' | '#';
			trigger = { char, start: caret - m[3].length - 1 };
			query = m[3];
			active = 0;
		} else {
			trigger = null;
		}
	}

	function close() {
		trigger = null;
		query = '';
	}

	// Replace the in-progress `@query`/`#query` with a real Discord mention token.
	function choose(s: Suggestion) {
		const el = ta;
		const t = trigger;
		if (!el || !t) return;
		const caret = el.selectionStart ?? value.length;
		const token = s.kind === 'role' ? `<@&${s.id}>` : `<#${s.id}>`;
		const before = value.slice(0, t.start);
		const after = value.slice(caret);
		const insert = token + ' ';
		value = before + insert + after;
		const pos = before.length + insert.length;
		close();
		requestAnimationFrame(() => {
			el.focus();
			el.setSelectionRange(pos, pos);
		});
	}

	function onKeydown(e: KeyboardEvent) {
		if (!trigger || suggestions.length === 0) return;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			active = (active + 1) % suggestions.length;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			active = (active - 1 + suggestions.length) % suggestions.length;
		} else if (e.key === 'Enter' || e.key === 'Tab') {
			e.preventDefault();
			choose(suggestions[active]);
		} else if (e.key === 'Escape') {
			e.preventDefault();
			close();
		}
	}

	// Render the stored value with mention tokens replaced by readable pills so
	// the admin can see what Discord will actually show.
	type Segment = { text: string } | { role: RoleDTO } | { channel: string; id: string } | { unknownRole: string } | { unknownChannel: string };
	const preview = $derived.by<Segment[]>(() => {
		const out: Segment[] = [];
		const re = /<@&(\d+)>|<#(\d+)>/g;
		let last = 0;
		let m: RegExpExecArray | null;
		while ((m = re.exec(value))) {
			if (m.index > last) out.push({ text: value.slice(last, m.index) });
			if (m[1]) {
				const r = roleName.get(m[1]);
				out.push(r ? { role: r } : { unknownRole: m[1] });
			} else if (m[2]) {
				const c = channelName.get(m[2]);
				out.push(c ? { channel: c, id: m[2] } : { unknownChannel: m[2] });
			}
			last = re.lastIndex;
		}
		if (last < value.length) out.push({ text: value.slice(last) });
		return out;
	});
	const hasMentions = $derived(preview.some((s) => 'role' in s || 'channel' in s || 'unknownRole' in s || 'unknownChannel' in s));
</script>

<div class="mention-field">
	<div class="ta-wrap">
		<textarea
			{id}
			{name}
			{rows}
			{required}
			{placeholder}
			bind:this={ta}
			bind:value
			oninput={refresh}
			onkeydown={onKeydown}
			onclick={refresh}
			onkeyup={(e) => {
				if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) refresh();
			}}
			onblur={() => setTimeout(close, 120)}
			autocomplete="off"
		></textarea>

		{#if trigger && suggestions.length > 0}
			<ul class="ac" role="listbox" use:floating={{ anchor: ta, open: !!trigger, gap: 6, align: 'left' }}>
				{#each suggestions as s, i (s.kind + s.id)}
					<li>
						<button
							type="button"
							class="ac-opt"
							class:active={i === active}
							role="option"
							aria-selected={i === active}
							onmousedown={(e) => {
								e.preventDefault();
								choose(s);
							}}
							onmouseenter={() => (active = i)}
						>
							{#if s.kind === 'role'}
								<span class="dot" style="--c:{safeColor(s.color, 'var(--text-faint)')}"></span>
								<span class="ac-label">{s.label}</span>
								<span class="ac-tag">role</span>
							{:else}
								<span class="hash">#</span>
								<span class="ac-label">{s.label}</span>
								<span class="ac-tag">channel</span>
							{/if}
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<p class="mention-help">
		Type <kbd>@</kbd> to ping a role or <kbd>#</kbd> to link a channel — pick with ↑↓ and Enter.
	</p>

	{#if hasMentions}
		<div class="mention-preview" aria-label="Preview">
			<span class="pv-label">Preview:</span>
			{#each preview as seg}
				{#if 'role' in seg}
					<span class="pv-role" style="--c:{safeColor(seg.role.color, 'var(--accent-soft)')}">@{seg.role.name}</span>
				{:else if 'channel' in seg}
					<span class="pv-chan">#{seg.channel}</span>
				{:else if 'unknownRole' in seg}
					<span class="pv-role unknown">@unknown-role</span>
				{:else if 'unknownChannel' in seg}
					<span class="pv-chan unknown">#unknown-channel</span>
				{:else if 'text' in seg}<span class="pv-text">{seg.text}</span>{/if}
			{/each}
		</div>
	{/if}
</div>

<style>
	.mention-field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.ta-wrap {
		position: relative;
	}
	.ac {
		position: absolute;
		z-index: 40;
		left: 0;
		right: 0;
		margin: 0.3rem 0 0;
		padding: 0.3rem;
		list-style: none;
		background: var(--bg-elev);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow-lg);
		max-height: 230px;
		overflow-y: auto;
		animation: rise 0.14s var(--ease);
	}
	.ac li {
		margin: 0;
	}
	.ac-opt {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		width: 100%;
		padding: 0.4rem 0.55rem;
		border: none;
		border-radius: 7px;
		background: transparent;
		color: var(--text);
		font-size: 0.86rem;
		text-align: left;
		cursor: pointer;
	}
	.ac-opt.active {
		background: var(--accent-grad-soft);
	}
	.ac-opt .dot {
		width: 11px;
		height: 11px;
		border-radius: 50%;
		background: var(--c);
		box-shadow: 0 0 6px color-mix(in srgb, var(--c) 60%, transparent);
		flex: 0 0 auto;
	}
	.ac-opt .hash {
		width: 11px;
		text-align: center;
		color: var(--text-faint);
		font-weight: 700;
		flex: 0 0 auto;
	}
	.ac-label {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.ac-tag {
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-faint);
		flex: 0 0 auto;
	}
	.mention-help {
		font-size: 0.76rem;
		color: var(--text-muted);
		margin: 0;
	}
	.mention-help kbd {
		font-family: var(--font);
		font-size: 0.72rem;
		font-weight: 700;
		padding: 0.02rem 0.32rem;
		border-radius: 5px;
		background: var(--bg-inset);
		border: 1px solid var(--border);
	}
	.mention-preview {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem 0.35rem;
		padding: 0.5rem 0.6rem;
		background: var(--bg-inset);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-size: 0.85rem;
		line-height: 1.5;
	}
	.pv-label {
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-faint);
		margin-right: 0.15rem;
	}
	.pv-text {
		white-space: pre-wrap;
		color: var(--text);
	}
	.pv-role,
	.pv-chan {
		font-weight: 600;
		padding: 0.02rem 0.4rem;
		border-radius: 5px;
		white-space: nowrap;
	}
	.pv-role {
		color: color-mix(in srgb, var(--c) 70%, var(--text));
		background: color-mix(in srgb, var(--c) 15%, transparent);
	}
	.pv-chan {
		color: var(--accent-soft);
		background: var(--accent-grad-soft);
	}
	.pv-role.unknown,
	.pv-chan.unknown {
		color: var(--red);
		background: rgba(239, 68, 68, 0.12);
	}
</style>
