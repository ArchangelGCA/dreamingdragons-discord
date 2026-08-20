import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

// Direct GET navigation just bounces home.
export const load: PageServerLoad = () => {
	throw redirect(303, '/');
};

export const actions: Actions = {
	default: async ({ locals }) => {
		locals.pb.authStore.clear();
		throw redirect(303, '/login');
	}
};
