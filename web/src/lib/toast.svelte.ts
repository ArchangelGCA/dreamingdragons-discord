/** Lightweight toast notifications, driven mostly by form action results. */
import { browser } from '$app/environment';

export type ToastKind = 'success' | 'error' | 'info';
export interface Toast {
	id: number;
	kind: ToastKind;
	text: string;
}

let nextId = 1;
export const toasts = $state<Toast[]>([]);

export function dismissToast(id: number): void {
	const i = toasts.findIndex((t) => t.id === id);
	if (i >= 0) toasts.splice(i, 1);
}

export function pushToast(kind: ToastKind, text: string, timeout = 4200): number {
	const id = nextId++;
	toasts.push({ id, kind, text });
	if (browser && timeout > 0) setTimeout(() => dismissToast(id), timeout);
	return id;
}
