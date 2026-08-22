import type { Action } from 'svelte/action';

/**
 * IntersectionObserver-based scroll-in animation.
 * Adds `.in` class when element enters viewport.
 * Removes itself after first trigger to avoid replaying entrance.
 */
export const animateIn: Action<HTMLElement, { threshold?: number; delay?: number } | undefined> = (
	node,
	options = {}
) => {
	const { threshold = 0.12, delay = 0 } = options || {};

	node.style.setProperty('--animate-in-delay', `${delay}ms`);
	node.classList.add('animate-in');

	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					entry.target.classList.add('in');
					observer.unobserve(entry.target);
					// Clean up after animation completes
					setTimeout(() => entry.target.classList.remove('animate-in', 'in'), 800);
				}
			}
		},
		{ threshold, rootMargin: '0px 0px -40px 0px' }
	);

	observer.observe(node);

	return {
		destroy() {
			observer.disconnect();
		}
	};
};
