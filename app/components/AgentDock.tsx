// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { cn } from "@cloudflare/kumo";
import { useEffect, useState } from "react";
import AgentSidebar from "~/components/AgentSidebar";
import { useUIStore } from "~/hooks/useUIStore";

const DOCK_QUERY = "(min-width: 1600px)";

/**
 * Hosts the agent. On very wide screens it docks as a third column; below
 * that it floats over the reading pane so the email keeps its width. It stays
 * mounted once opened so the chat connection and any running turn survive
 * closing and reopening.
 */
export default function AgentDock() {
	const { isAgentPanelOpen, setAgentPanelOpen } = useUIStore();
	const [hasOpened, setHasOpened] = useState(false);

	useEffect(() => {
		if (isAgentPanelOpen) setHasOpened(true);
	}, [isAgentPanelOpen]);

	// Escape closes the floating panel (the docked one stays put).
	useEffect(() => {
		if (!isAgentPanelOpen) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || window.matchMedia(DOCK_QUERY).matches) return;
			const panel = document.getElementById("agent-dock");
			if (panel && event.target instanceof Node && panel.contains(event.target)) {
				setAgentPanelOpen(false);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [isAgentPanelOpen, setAgentPanelOpen]);

	if (!hasOpened) return null;

	return (
		<aside
			id="agent-dock"
			aria-label="Agent"
			className={cn(
				"z-40 flex-col overflow-hidden bg-kumo-base",
				// Floating sheet (phones: full screen).
				"fixed inset-0 sm:inset-auto sm:top-2 sm:right-2 sm:bottom-2 sm:w-[400px] sm:rounded-xl sm:shadow-2xl sm:ring-1 sm:ring-kumo-line",
				// Docked column on wide screens.
				"min-[1600px]:static min-[1600px]:my-2 min-[1600px]:mr-2 min-[1600px]:w-[380px] min-[1600px]:shrink-0 min-[1600px]:shadow-xs min-[1600px]:ring-kumo-hairline",
				isAgentPanelOpen ? "flex animate-slide-in-right" : "hidden",
			)}
		>
			<AgentSidebar onClose={() => setAgentPanelOpen(false)} />
		</aside>
	);
}
