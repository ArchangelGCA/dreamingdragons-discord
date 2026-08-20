<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();
</script>

<div class="login">
	<div class="card login-card">
		<div class="logo">🐉</div>
		<h1>dd-bot admin</h1>
		<p class="muted">Sign in with your PocketBase superuser account.</p>

		{#if form?.error}
			<div class="alert error">{form.error}</div>
		{/if}

		<form method="POST" use:enhance>
			<label for="email">Email</label>
			<input id="email" name="email" type="email" value={form?.email ?? ''} required autocomplete="username" />

			<label for="password">Password</label>
			<input id="password" name="password" type="password" required autocomplete="current-password" />

			<button class="btn" style="width:100%;margin-top:1.25rem;justify-content:center">Sign in</button>
		</form>
	</div>
</div>

<style>
	.login {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 1rem;
	}
	.login-card {
		width: 100%;
		max-width: 360px;
		text-align: center;
	}
	.logo {
		font-size: 2.5rem;
	}
	form {
		text-align: left;
		margin-top: 1rem;
	}
</style>
