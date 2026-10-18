// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { create } from "zustand";
import type { Email } from "~/types";

export type ComposeMode = "new" | "reply" | "reply-all" | "forward";

export interface ComposeOptions {
	mode: ComposeMode;
	originalEmail?: Email | null;
	/** When editing a draft, this holds the draft email to pre-fill the composer */
	draftEmail?: Email | null;
}

const AGENT_PANEL_KEY = "agentic-inbox:agent-panel";

function readAgentPanelPreference(): boolean | null {
	if (typeof window === "undefined") return null;
	const stored = window.localStorage.getItem(AGENT_PANEL_KEY);
	if (stored === "open") return true;
	if (stored === "closed") return false;
	return null;
}

function persistAgentPanel(open: boolean) {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(AGENT_PANEL_KEY, open ? "open" : "closed");
}

interface UIState {
	// Reading pane
	selectedEmailId: string | null;
	isComposing: boolean;
	_previousEmailId: string | null;
	selectEmail: (id: string | null) => void;
	startCompose: (options?: ComposeOptions) => void;
	closePanel: () => void;
	closeCompose: () => void;

	// Compose options
	composeOptions: ComposeOptions;

	// Agent panel
	isAgentPanelOpen: boolean;
	/** Resolve the initial panel state from storage / viewport (client only). */
	hydrateAgentPanel: () => void;
	setAgentPanelOpen: (open: boolean) => void;
	toggleAgentPanel: () => void;

	/** A prompt queued from elsewhere in the UI for the agent to run. */
	pendingAgentPrompt: string | null;
	askAgent: (prompt: string) => void;
	consumeAgentPrompt: () => string | null;
}

export const useUIStore = create<UIState>((set, get) => ({
	selectedEmailId: null,
	isComposing: false,
	_previousEmailId: null,
	composeOptions: { mode: "new", originalEmail: null },
	isAgentPanelOpen: false,
	pendingAgentPrompt: null,

	selectEmail: (id) => set({ selectedEmailId: id, isComposing: false }),

	startCompose: (options) =>
		set((state) => {
			const mode = options?.mode || "new";
			const isReplyOrForward = mode === "reply" || mode === "reply-all" || mode === "forward";
			return {
				isComposing: true,
				_previousEmailId: state.selectedEmailId,
				// Keep selectedEmailId when replying/forwarding so the thread stays visible
				selectedEmailId: isReplyOrForward ? state.selectedEmailId : null,
				composeOptions: options || { mode: "new", originalEmail: null },
			};
		}),

	closePanel: () =>
		set({
			selectedEmailId: null,
			isComposing: false,
			_previousEmailId: null,
			composeOptions: { mode: "new" as const, originalEmail: null },
		}),

	closeCompose: () =>
		set((state) => ({
			isComposing: false,
			selectedEmailId: state._previousEmailId,
			_previousEmailId: null,
			composeOptions: { mode: "new" as const, originalEmail: null },
		})),

	hydrateAgentPanel: () => {
		const stored = readAgentPanelPreference();
		// Default: open only when there is room to dock it beside the reader.
		const open = stored ?? window.matchMedia("(min-width: 1600px)").matches;
		set({ isAgentPanelOpen: open });
	},

	setAgentPanelOpen: (open) => {
		persistAgentPanel(open);
		set({ isAgentPanelOpen: open });
	},

	toggleAgentPanel: () => {
		const next = !get().isAgentPanelOpen;
		persistAgentPanel(next);
		set({ isAgentPanelOpen: next });
	},

	askAgent: (prompt) => {
		persistAgentPanel(true);
		set({ pendingAgentPrompt: prompt, isAgentPanelOpen: true });
	},

	consumeAgentPrompt: () => {
		const prompt = get().pendingAgentPrompt;
		if (prompt) set({ pendingAgentPrompt: null });
		return prompt;
	},
}));
