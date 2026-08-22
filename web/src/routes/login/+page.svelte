<script lang="ts">
	import { enhance } from '$app/forms';
	import { fade, fly, scale } from 'svelte/transition';
	import { animateIn } from '$lib/actions/animate';

	let { form } = $props();
</script>

<div class="login">
	<div class="ambient ambient-a"></div>
	<div class="ambient ambient-b"></div>

	<div class="card login-card" use:animateIn>
		<div class="logo" in:scale={{ duration: 420, start: 0.86, delay: 80 }}>🐉</div>
		<h1>dd-bot admin</h1>
		<p class="muted">Sign in with your PocketBase superuser account.</p>

		{#if form?.error}
			<div class="alert error" in:fly={{ y: -8, duration: 220 }}>{form.error}</div>
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
		position: relative;
		overflow: hidden;
	}
	.ambient {
		position: absolute;
		border-radius: 50%;
		filter: blur(80px);
		opacity: 0.35;
		pointer-events: none;
		z-index: 0;
	}
	.ambient-a {
		width: 380px;
		height: 380px;
		background: radial-gradient(circle, rgba(0, 165, 148, 0.5), transparent 65%);
		top: -80px;
		right: -60px;
		animation: drift 14s ease-in-out infinite;
	}
	.ambient-b {
		width: 320px;
		height: 320px;
		background: radial-gradient(circle, rgba(32, 221, 224, 0.35), transparent 65%);
		bottom: -70px;
		left: -40px;
		animation: drift 16s ease-in-out -6s infinite;
	}
	@keyframes drift {
		0%,
		100% {
			transform: translate(0, 0) scale(1);
		}
		50% {
			transform: translate(14px, 10px) scale(1.04);
		}
	}

	.login-card {
		width: 100%;
		max-width: 380px;
		text-align: center;
		position: relative;
		z-index: 1;
		border: 1px solid var(--border-strong);
		box-shadow: var(--shadow-lg);
	}
	.logo {
		font-size: 2.5rem;
	}
		form {
		text-align: left;
		margin-top: 1rem;
	}
	form button {
		padding: 0.7rem 1.1rem;
		font-size: 0.95rem;
	}

	@media (max-width: 480px) {
		.ambient {
			display: none;
		}
		.login-card {
			max-width: 100%;
			padding: 1.4rem 1.2rem;
		}
	}
</style>
