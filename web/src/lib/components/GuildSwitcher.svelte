<script lang="ts">
	import { page } from '$app/state';
	import type { GuildDTO } from '$lib/server/bot';

	let { guilds, currentGuildId }: { guilds: GuildDTO[]; currentGuildId: string | null } = $props();

	function onChange(e: Event) {
		(e.currentTarget as HTMLSelectElement).form?.requestSubmit();
	}
</script>

<form method="POST" action="/set-guild" class="guild-switcher">
	<input type="hidden" name="redirectTo" value={page.url.pathname + page.url.search} />
	<label for="guild-select">Server</label>
	{#if guilds.length === 0}
		<div class="muted" style="font-size:0.8rem">No servers available.</div>
	{:else}
		<select id="guild-select" name="guild_id" value={currentGuildId} onchange={onChange}>
			{#each guilds as g (g.id)}
				<option value={g.id}>{g.name}</option>
			{/each}
		</select>
		<noscript><button class="btn small" style="margin-top:0.4rem">Switch</button></noscript>
	{/if}
</form>

<style>
	.guild-switcher {
		padding: 0.5rem 0.5rem 0.75rem;
	}
	.guild-switcher label {
		margin-top: 0;
	}
</style>
