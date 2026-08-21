<script lang="ts">
	import { monogram, gradientFor } from '$lib/format';

	let {
		src = '',
		name = '',
		seed = '',
		size = 28,
		rounded = 'circle',
		title
	}: {
		src?: string;
		name?: string;
		seed?: string;
		size?: number;
		rounded?: 'circle' | 'square';
		title?: string;
	} = $props();

	let failed = $state(false);
	const radius = $derived(rounded === 'circle' ? '50%' : `${Math.round(size * 0.28)}px`);
</script>

<span
	class="avatar"
	title={title ?? name}
	style="width:{size}px;height:{size}px;border-radius:{radius};font-size:{Math.round(
		size * 0.4
	)}px;{!src || failed ? `background:${gradientFor(seed || name || '?')}` : ''}"
>
	{#if src && !failed}
		<img
			{src}
			alt={name}
			width={size}
			height={size}
			style="border-radius:{radius}"
			loading="lazy"
			onerror={() => (failed = true)}
		/>
	{:else}
		{monogram(name)}
	{/if}
</span>

<style>
	.avatar {
		display: inline-grid;
		place-items: center;
		flex: 0 0 auto;
		overflow: hidden;
		color: #fff;
		font-weight: 700;
		line-height: 1;
		user-select: none;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
	}
	.avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
</style>
