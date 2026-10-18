// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { useEffect, useRef } from "react";
import { useUIStore } from "~/hooks/useUIStore";

export const SEARCH_INPUT_ID = "mail-search";

/** True when the keystroke belongs to a text field or the rich text editor. */
export function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	if (target.isContentEditable) return true;
	const tag = target.tagName;
	return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/** True when a dialog or menu is open; shortcuts should not fire underneath. */
function overlayIsOpen(): boolean {
	return Boolean(
		document.querySelector('[role="dialog"][data-open], [role="menu"], [role="alertdialog"]'),
	);
}

/**
 * Mailbox-wide shortcuts:
 * - ⌘/Ctrl + J  toggle the agent
 * - c           compose
 * - /           focus search
 */
export function useKeyboardShortcuts() {
	const { toggleAgentPanel, startCompose } = useUIStore();

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
				event.preventDefault();
				toggleAgentPanel();
				return;
			}
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			if (isTypingTarget(event.target) || overlayIsOpen()) return;

			if (event.key === "c") {
				// Never throw away a message that's being written.
				if (useUIStore.getState().isComposing) return;
				event.preventDefault();
				startCompose();
			} else if (event.key === "/") {
				const input = document.getElementById(SEARCH_INPUT_ID);
				if (input) {
					event.preventDefault();
					input.focus();
				}
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [toggleAgentPanel, startCompose]);
}

/**
 * List-level shortcuts (j/k to move, e to archive, # to delete, r to reply,
 * Escape to close). Handlers are read through a ref so callers can pass
 * fresh closures every render without re-binding the listener.
 */
export function useListShortcuts(handlers: {
	/** Off while composing so stray keystrokes never archive or delete. */
	enabled?: boolean;
	next: () => void;
	previous: () => void;
	archive?: () => void;
	remove?: () => void;
	reply?: () => void;
	close: () => void;
}) {
	const ref = useRef(handlers);
	ref.current = handlers;

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			if (isTypingTarget(event.target) || overlayIsOpen()) return;
			const h = ref.current;
			if (h.enabled === false && event.key !== "Escape") return;
			switch (event.key) {
				case "j":
					event.preventDefault();
					h.next();
					break;
				case "k":
					event.preventDefault();
					h.previous();
					break;
				case "e":
					if (h.archive) {
						event.preventDefault();
						h.archive();
					}
					break;
				case "#":
					if (h.remove) {
						event.preventDefault();
						h.remove();
					}
					break;
				case "r":
					if (h.reply) {
						event.preventDefault();
						h.reply();
					}
					break;
				case "Escape":
					h.close();
					break;
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);
}
