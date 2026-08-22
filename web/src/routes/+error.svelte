<script lang="ts">
	import { page } from '$app/state';
	const isPublic = $derived(page.route.id?.startsWith('/(public)') ?? false);
</script>

<div class="error-wrap">
	<div class="card" style="max-width:420px;text-align:center">
		<div style="font-size:2.5rem">🐉</div>
		<h1>{page.status}</h1>
		<p class="muted">{page.error?.message ?? 'Something went wrong.'}</p>
		<a class="btn" href={isPublic ? '/' : '/dashboard'} style="margin-top:1rem">
			{isPublic ? 'Back to home' : 'Back to dashboard'}
		</a>
	</div>
</div>

<style>
	.error-wrap {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 1rem;
	}
</style>
