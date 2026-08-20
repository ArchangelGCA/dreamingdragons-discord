import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const form = await request.formData();
		const email = String(form.get('email') || '').trim();
		const password = String(form.get('password') || '');

		if (!email || !password) {
			return fail(400, { error: 'Email and password are required.', email });
		}

		try {
			await locals.pb.collection('_superusers').authWithPassword(email, password);
		} catch {
			return fail(401, { error: 'Invalid credentials.', email });
		}

		// The auth cookie is written by the server hook after this response.
		throw redirect(303, '/');
	}
};
