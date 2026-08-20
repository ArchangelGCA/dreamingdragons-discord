<script lang="ts">
	import type { ChannelDTO } from '$lib/server/bot';

	let {
		name,
		channels,
		value = '',
		required = false,
		id = name
	}: {
		name: string;
		channels: ChannelDTO[];
		value?: string;
		required?: boolean;
		id?: string;
	} = $props();
</script>

{#if channels.length > 0}
	<select {id} {name} {required} {value}>
		<option value="" disabled={required}>— select a channel —</option>
		{#each channels as c (c.id)}
			<option value={c.id}>#{c.name}</option>
		{/each}
	</select>
{:else}
	<input {id} {name} {required} {value} placeholder="Channel ID (bot offline)" />
{/if}
