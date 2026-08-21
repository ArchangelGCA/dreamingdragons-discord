<script lang="ts">
	let { value, short = false }: { value: string; short?: boolean } = $props();

	let copied = $state(false);
	let timer: ReturnType<typeof setTimeout>;

	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			copied = true;
			clearTimeout(timer);
			timer = setTimeout(() => (copied = false), 1400);
		} catch {
			/* clipboard blocked — ignore */
		}
	}

	const shown = $derived(short && value.length > 10 ? value.slice(0, 6) + '…' : value);
</script>

<button type="button" class="copy-id mono" onclick={copy} title="Copy {value}">
	<span>{copied ? 'Copied!' : shown}</span>
	<span class="ic" aria-hidden="true">{copied ? '✓' : '⧉'}</span>
</button>

<style>
	.copy-id {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.12rem 0.45rem;
		border-radius: 6px;
		background: var(--bg-inset);
		border: 1px solid var(--border);
		color: var(--text-muted);
		font-size: 0.78rem;
		cursor: pointer;
		transition: color var(--t), border-color var(--t);
	}
	.copy-id:hover {
		color: var(--text);
		border-color: var(--border-strong);
	}
	.ic {
		opacity: 0.6;
		font-size: 0.72rem;
	}
</style>
