import type { Action } from 'svelte/action';

/**
 * Escapes the classic `overflow: hidden/auto` clipping trap for `details > .popover`
 * menus that live inside `.table-wrap.scroll`, `.card`, or any scroll container.
 *
 * Native `position: absolute` is clipped by the nearest ancestor with non-visible
 * overflow. Switching to `position: fixed` (viewport-anchored) plus a runtime
 * anchor measurement lets the panel paint above sibling cards / the next section —
 * which is the reported "lower z-axis than the parent" effect — and avoids being
 * swallowed by `overflow: hidden` on `.table-wrap` or `overflow-y: auto` on
 * `.sidebar`.
 *
 * - Right-aligned by default (matches the existing `details:not(.drop-left) .popover { right: 0 }`).
 * - Flips above the trigger when there is not enough space below.
 * - Clamps into the viewport with a 12px safe inset.
 * - Re-positions on scroll/resize (including table scroll containers).
 * - Closes on outside click and Escape, restoring normal document flow.
 */
export const popover: Action<HTMLDetailsElement> = (node) => {
	const summaryEl = node.querySelector('summary') as HTMLElement | null;
	const panelEl = node.querySelector('.popover') as HTMLElement | null;
	if (!summaryEl || !panelEl) return {};
	const summary: HTMLElement = summaryEl;
	const panel: HTMLElement = panelEl;

	// Preserve inline styles so we can restore when closed / destroyed.
	const original = {
		position: panel.style.position,
		top: panel.style.top,
		left: panel.style.left,
		right: panel.style.right,
		bottom: panel.style.bottom,
		width: panel.style.width,
		maxWidth: panel.style.maxWidth,
		zIndex: panel.style.zIndex,
		visibility: panel.style.visibility
	};

	const GAP = 8;
	const INSET = 12;
	let raf = 0;

	function place() {
		// Panel must be measurable — force a layout pass while keeping it invisible.
		panel.style.visibility = 'hidden';
		// Ensure the panel is laid out to measure its natural width/height. When the
		// details is open the panel is in the flow; when closed it is display:none so
		// we temporarily force display.
		const prevDisplay = panel.style.display;
		if (getComputedStyle(panel).display === 'none') panel.style.display = 'block';

		const trig = summary.getBoundingClientRect();
		// Use natural size (up to the CSS min-width / max constraints).
		const pw = Math.ceil(panel.offsetWidth) || 260;
		const ph = Math.ceil(panel.offsetHeight) || 120;

		panel.style.display = prevDisplay;

		const vw = window.innerWidth;
		const vh = window.innerHeight;

		// Prefer below the trigger, flip above when needed.
		let top = trig.bottom + GAP;
		const spaceBelow = vh - trig.bottom - GAP - INSET;
		const spaceAbove = trig.top - GAP - INSET;
		if (ph > spaceBelow && spaceAbove > spaceBelow) {
			top = trig.top - ph - GAP;
		}
		top = Math.max(INSET, Math.min(top, vh - ph - INSET));

		// Right-aligned to the trigger's right edge by default.
		let left = trig.right - pw;
		// If a details opts into left-alignment keep it left-aligned.
		if (node.classList.contains('drop-left')) left = trig.left;
		left = Math.max(INSET, Math.min(left, vw - pw - INSET));

		panel.style.position = 'fixed';
		panel.style.top = `${Math.round(top)}px`;
		panel.style.left = `${Math.round(left)}px`;
		panel.style.right = 'auto';
		panel.style.bottom = 'auto';
		// Keep panel usable on narrow viewports without exceeding the screen.
		panel.style.maxWidth = `min(92vw, ${Math.max(pw, 260)}px)`;
		panel.style.zIndex = '80';
		panel.style.visibility = '';
	}

	function schedulePlace() {
		cancelAnimationFrame(raf);
		raf = requestAnimationFrame(place);
	}

	function onToggle() {
		if (node.open) {
			// Next frame the panel has its open dimensions.
			schedulePlace();
			window.addEventListener('resize', schedulePlace);
			window.addEventListener('scroll', schedulePlace, true);
		} else {
			restore();
		}
	}

	function restore() {
		cancelAnimationFrame(raf);
		window.removeEventListener('resize', schedulePlace);
		window.removeEventListener('scroll', schedulePlace, true);
		panel.style.position = original.position;
		panel.style.top = original.top;
		panel.style.left = original.left;
		panel.style.right = original.right;
		panel.style.bottom = original.bottom;
		panel.style.width = original.width;
		panel.style.maxWidth = original.maxWidth;
		panel.style.zIndex = original.zIndex;
		panel.style.visibility = original.visibility;
	}

	function onDocPointer(e: MouseEvent) {
		if (!node.open) return;
		const t = e.target as Node;
		if (node.contains(t)) return;
		// Also treat the floating fixed panel as inside when we click its content
		// (panel remains a descendant, but after going fixed the containment check
		//  still passes — this is just defensive).
		if (panel.contains(t)) return;
		node.open = false;
		restore();
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape' && node.open) {
			node.open = false;
			restore();
			summary.focus();
		}
	}

	node.addEventListener('toggle', onToggle);
	document.addEventListener('mousedown', onDocPointer, true);
	window.addEventListener('keydown', onKey);

	// If server-rendered open (not expected but safe).
	if (node.open) schedulePlace();

	return {
		destroy() {
			cancelAnimationFrame(raf);
			node.removeEventListener('toggle', onToggle);
			document.removeEventListener('mousedown', onDocPointer, true);
			window.removeEventListener('keydown', onKey);
			window.removeEventListener('resize', schedulePlace);
			window.removeEventListener('scroll', schedulePlace, true);
			restore();
		}
	};
};

/**
 * Generic viewport-anchored floating layer for non-details triggers (GuildSwitcher
 * menu, MentionField autocomplete, etc.) that would otherwise be clipped by a
 * scroll/overflow parent. Apply to the floating panel itself.
 *
 * Usage (svelte 5): `<div use:floating={{ anchor: triggerEl, open, gap: 8 }}>`
 */
export const floating: Action<HTMLElement, { anchor: HTMLElement | null; open: boolean; gap?: number; align?: 'left' | 'right' }> = (
	node,
	params = { anchor: null, open: false }
) => {
	const original = {
		position: node.style.position,
		top: node.style.top,
		left: node.style.left,
		right: node.style.right,
		width: node.style.width,
		maxWidth: node.style.maxWidth,
		zIndex: node.style.zIndex
	};
	let current: typeof params = params;

	function place() {
		const anchor = current.anchor;
		if (!anchor || !current.open) return;
		const trig = anchor.getBoundingClientRect();
		const pw = Math.ceil(node.offsetWidth) || Math.ceil(trig.width);
		const ph = Math.ceil(node.offsetHeight) || 160;
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const GAP = current.gap ?? 6;
		const INSET = 12;
		let top = trig.bottom + GAP;
		const spaceBelow = vh - trig.bottom - GAP - INSET;
		const spaceAbove = trig.top - GAP - INSET;
		if (ph > spaceBelow && spaceAbove > spaceBelow) top = trig.top - ph - GAP;
		top = Math.max(INSET, Math.min(top, vh - ph - INSET));
		const align = current.align ?? 'left';
		let left = align === 'right' ? trig.right - pw : trig.left;
		left = Math.max(INSET, Math.min(left, vw - pw - INSET));
		node.style.position = 'fixed';
		node.style.top = `${Math.round(top)}px`;
		node.style.left = `${Math.round(left)}px`;
		node.style.right = 'auto';
		node.style.width = `${Math.round(Math.min(pw, vw - INSET * 2))}px`;
		node.style.maxWidth = `min(92vw, ${Math.max(pw, 220)}px)`;
		node.style.zIndex = '81';
	}

	function sync() {
		if (current.open) {
			requestAnimationFrame(place);
			window.addEventListener('resize', place);
			window.addEventListener('scroll', place, true);
		} else {
			window.removeEventListener('resize', place);
			window.removeEventListener('scroll', place, true);
			node.style.position = original.position;
			node.style.top = original.top;
			node.style.left = original.left;
			node.style.right = original.right;
			node.style.width = original.width;
			node.style.maxWidth = original.maxWidth;
			node.style.zIndex = original.zIndex;
		}
	}

	sync();

	return {
		update(next: typeof params) {
			current = next;
			sync();
		},
		destroy() {
			window.removeEventListener('resize', place);
			window.removeEventListener('scroll', place, true);
			node.style.position = original.position;
			node.style.top = original.top;
			node.style.left = original.left;
			node.style.right = original.right;
			node.style.width = original.width;
			node.style.maxWidth = original.maxWidth;
			node.style.zIndex = original.zIndex;
		}
	};
};
