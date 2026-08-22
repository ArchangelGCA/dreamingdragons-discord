<script lang="ts">
	import { fly, scale } from 'svelte/transition';
	import { toasts, dismissToast } from '$lib/toast.svelte';

	const glyph = { success: '✓', error: '⛔', info: 'ℹ' } as const;
</script>

<div class="toasts" aria-live="polite">
	{#each toasts as t (t.id)}
		<div
			class="toast {t.kind}"
			in:fly={{ x: 28, y: 12, duration: 300, delay: 40 }}
			out:scale={{ duration: 180 }}
			role="status"
		>
			<span class="ico">{glyph[t.kind]}</span>
			<span class="msg">{t.text}</span>
			<button class="x" aria-label="Dismiss" onclick={() => dismissToast(t.id)}>✕</button>
		</div>
	{/each}
</div>

<style>
	.toasts {
		position: fixed;
		bottom: 1.25rem;
		right: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		z-index: 100;
		max-width: min(380px, calc(100vw - 2rem));
	}
	.toast {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		padding: 0.75rem 0.85rem;
		border-radius: var(--radius);
		background: var(--bg-elev);
		border: 1px solid var(--border);
		box-shadow: var(--shadow-lg);
		font-size: 0.88rem;
	}
	.ico {
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		font-size: 0.75rem;
		font-weight: 700;
		color: #fff;
		flex: 0 0 auto;
	}
	.toast.success .ico {
		background: var(--green);
	}
	.toast.error .ico {
		background: var(--red);
	}
	.toast.info .ico {
		background: var(--accent);
	}
	.msg {
		flex: 1;
		padding-top: 1px;
	}
	.x {
		background: none;
		border: none;
		color: var(--text-faint);
		cursor: pointer;
		font-size: 0.8rem;
		padding: 0 0.15rem;
		transition: color var(--t);
	}
	.x:hover {
		color: var(--text);
	}
</style>
