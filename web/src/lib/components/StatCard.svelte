<script lang="ts">
	let {
		label,
		value,
		icon,
		tone = 'accent',
		hint
	}: {
		label: string;
		value: string | number;
		icon: string;
		tone?: 'accent' | 'green' | 'blue' | 'gold';
		hint?: string;
	} = $props();
</script>

<div class="stat card card-hover">
	<div class="ico tone-{tone}">{icon}</div>
	<div class="body">
		<div class="value">{value}</div>
		<div class="label">{label}</div>
		{#if hint}<div class="hint faint">{hint}</div>{/if}
	</div>
</div>

<style>
	.stat {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1.2rem 1.25rem;
	}
	.ico {
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		border-radius: 13px;
		font-size: 1.4rem;
		flex: 0 0 auto;
		color: #fff;
	}
	.tone-accent {
		background: var(--accent-grad);
		box-shadow: var(--accent-glow);
	}
	.tone-green {
		background: linear-gradient(135deg, #16a34a, #22c55e);
	}
	.tone-blue {
		background: linear-gradient(135deg, #2563eb, #3b82f6);
	}
	.tone-gold {
		background: linear-gradient(135deg, #d97706, #f59e0b);
	}
	.value {
		font-size: 1.85rem;
		font-weight: 800;
		line-height: 1.1;
		letter-spacing: -0.02em;
	}
	.label {
		color: var(--text-muted);
		font-size: 0.88rem;
		font-weight: 500;
	}
	.hint {
		font-size: 0.75rem;
		margin-top: 0.1rem;
	}
</style>
