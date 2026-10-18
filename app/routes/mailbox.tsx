// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Sidebar, useSidebar } from "@cloudflare/kumo";
import { useEffect, useRef } from "react";
import { Outlet, useParams } from "react-router";
import AgentDock from "~/components/AgentDock";
import MailSidebar from "~/components/MailSidebar";
import { useKeyboardShortcuts } from "~/hooks/useKeyboardShortcuts";
import { useUIStore } from "~/hooks/useUIStore";
import { useMailbox } from "~/queries/mailboxes";

const SIDEBAR_KEY = "agentic-inbox:sidebar";

/**
 * Restores the desktop sidebar state after hydration. The server always
 * renders it expanded; on narrower laptops we start collapsed to give the
 * reading pane room, unless the user has chosen otherwise.
 */
function SidebarStateSync({ skipPersist }: { skipPersist: React.MutableRefObject<boolean> }) {
	const { setOpen } = useSidebar();
	const synced = useRef(false);

	useEffect(() => {
		if (synced.current) return;
		synced.current = true;
		// Phones use the slide-over sheet; the rail state doesn't apply.
		if (window.matchMedia("(max-width: 767px)").matches) return;
		const stored = window.localStorage.getItem(SIDEBAR_KEY);
		const open = stored ? stored === "open" : window.innerWidth >= 1280;
		skipPersist.current = true;
		setOpen(open);
		skipPersist.current = false;
	}, [setOpen, skipPersist]);

	return null;
}

export default function MailboxRoute() {
	const { mailboxId } = useParams<{ mailboxId: string }>();
	// Prefetch mailbox data for child components
	useMailbox(mailboxId);
	const prevMailboxIdRef = useRef<string | undefined>(undefined);
	const skipPersist = useRef(false);
	const { closePanel, hydrateAgentPanel } = useUIStore();

	useKeyboardShortcuts();

	useEffect(() => {
		hydrateAgentPanel();
	}, [hydrateAgentPanel]);

	useEffect(() => {
		if (
			prevMailboxIdRef.current &&
			mailboxId &&
			prevMailboxIdRef.current !== mailboxId
		) {
			closePanel();
		}
		prevMailboxIdRef.current = mailboxId;
	}, [mailboxId, closePanel]);

	return (
		<Sidebar.Provider
			defaultOpen
			variant="inset"
			collapsible="icon"
			peekable={false}
			className="h-dvh min-h-0! overflow-hidden"
			style={
				{
					"--sidebar-bg": "var(--color-kumo-recessed)",
					"--sidebar-active-bg":
						"color-mix(in oklab, var(--color-kumo-fill) 75%, transparent)",
				} as React.CSSProperties
			}
			onOpenChange={(open) => {
				if (!skipPersist.current) {
					window.localStorage.setItem(SIDEBAR_KEY, open ? "open" : "closed");
				}
			}}
		>
			<SidebarStateSync skipPersist={skipPersist} />
			<MailSidebar />

			<main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-kumo-base md:my-2 md:mr-2 md:rounded-xl md:border md:border-kumo-hairline md:shadow-xs">
				<Outlet />
			</main>

			<AgentDock />
		</Sidebar.Provider>
	);
}
