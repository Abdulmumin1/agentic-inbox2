// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button, Loader, Tabs } from "@cloudflare/kumo";
import { SparkleIcon, XIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import MCPPanel from "./MCPPanel";

type AgentPanelComponent = React.ComponentType<{ headerActions: HTMLElement | null }>;

function LazyAgentPanel({ headerActions }: { headerActions: HTMLElement | null }) {
	const [AgentChat, setAgentChat] = useState<AgentPanelComponent | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);

	useEffect(() => {
		import("~/components/AgentPanel")
			.then((mod) => setAgentChat(() => mod.default))
			.catch((err) => {
				console.error("Failed to load AgentPanel:", err);
				setLoadError("Couldn't load the agent. Reload to try again.");
			});
	}, []);

	if (loadError) {
		return (
			<div className="flex h-full items-center justify-center px-6 text-center">
				<span className="text-[13px] text-kumo-danger">{loadError}</span>
			</div>
		);
	}
	if (!AgentChat) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-2">
				<Loader size="sm" />
				<span className="text-xs text-kumo-subtle">Loading agent…</span>
			</div>
		);
	}
	return <AgentChat headerActions={headerActions} />;
}

export default function AgentSidebar({ onClose }: { onClose?: () => void }) {
	const [activeTab, setActiveTab] = useState<"agent" | "mcp">("agent");
	const [headerActions, setHeaderActions] = useState<HTMLDivElement | null>(null);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex h-13 shrink-0 items-center gap-2 border-b border-kumo-hairline pr-2 pl-3">
				<span className="flex size-7 items-center justify-center rounded-lg ai-mark">
					<SparkleIcon size={15} weight="fill" />
				</span>
				<Tabs
					variant="segmented"
					size="sm"
					value={activeTab}
					onValueChange={(value) => setActiveTab(value as "agent" | "mcp")}
					tabs={[
						{ value: "agent", label: "Agent" },
						{ value: "mcp", label: "MCP" },
					]}
				/>
				<div className="flex-1" />
				<div
					ref={setHeaderActions}
					className={activeTab === "agent" ? "flex items-center gap-0.5" : "hidden"}
				/>
				{onClose && (
					<Button
						variant="ghost"
						shape="square"
						size="sm"
						className="size-8 text-kumo-subtle"
						title="Close agent (⌘J)"
						icon={<XIcon size={16} />}
						onClick={onClose}
					/>
				)}
			</div>

			{/* Keep the chat mounted so switching tabs doesn't drop the conversation. */}
			<div className="min-h-0 flex-1 overflow-hidden">
				<div className={activeTab === "agent" ? "h-full" : "hidden"}>
					<LazyAgentPanel headerActions={headerActions} />
				</div>
				{activeTab === "mcp" && <MCPPanel />}
			</div>
		</div>
	);
}
