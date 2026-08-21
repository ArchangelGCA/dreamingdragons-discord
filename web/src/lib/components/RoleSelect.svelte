<script lang="ts">
	import type { RoleDTO } from '$lib/server/bot';

	let {
		name,
		roles,
		value = '',
		assignableOnly = false,
		required = false,
		id = name
	}: {
		name: string;
		roles: RoleDTO[];
		value?: string;
		assignableOnly?: boolean;
		required?: boolean;
		id?: string;
	} = $props();

	const options = $derived(assignableOnly ? roles.filter((r) => r.assignable) : roles);
</script>

{#if roles.length > 0}
	<select {id} {name} {required} {value}>
		<option value="" disabled={required}>— select a role —</option>
		{#each options as r (r.id)}
			<option value={r.id} disabled={assignableOnly && !r.assignable} style={r.color ? `color:${r.color}` : ''}>
				{r.name}{r.assignable ? '' : ' (not assignable)'}
			</option>
		{/each}
	</select>
{:else}
	<!-- Bot offline / no data: fall back to a raw ID input so the admin isn't blocked. -->
	<input {id} {name} {required} {value} placeholder="Role ID (bot offline)" />
{/if}
