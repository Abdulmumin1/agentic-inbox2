// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { ClipboardText } from "@cloudflare/kumo";
import { PlugsConnectedIcon, ShieldCheckIcon } from "@phosphor-icons/react";

const TOOLS = [
	{ name: "list_mailboxes", desc: "List all mailboxes" },
	{ name: "list_emails", desc: "List emails in a folder" },
	{ name: "get_email", desc: "Read a full email" },
	{ name: "get_thread", desc: "Load a conversation" },
	{ name: "search_emails", desc: "Search by query" },
	{ name: "draft_reply", desc: "Draft a reply" },
	{ name: "send_reply", desc: "Send a reply" },
	{ name: "send_email", desc: "Send a new email" },
	{ name: "mark_email_read", desc: "Mark read or unread" },
	{ name: "move_email", desc: "Move to a folder" },
];

export default function MCPPanel() {
	const baseUrl =
		typeof window !== "undefined" ? window.location.origin : "https://your-app.workers.dev";
	const mcpUrl = `${baseUrl}/mcp`;

	return (
		<div className="h-full overflow-y-auto">
			<div className="space-y-6 px-4 py-5">
				<div>
					<div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-kumo-tint text-kumo-default ring-1 ring-kumo-hairline">
						<PlugsConnectedIcon size={20} />
					</div>
					<h3 className="text-base font-semibold tracking-tight text-kumo-strong">Connect over MCP</h3>
					<p className="mt-1 text-[13px] leading-relaxed text-kumo-subtle">
						Point Claude, Cursor or any MCP client at this server to read, search and reply to mail
						from your own tools.
					</p>
				</div>

				<div className="space-y-2">
					<div className="text-xs font-medium text-kumo-default">Server URL</div>
					<ClipboardText text={mcpUrl} size="base" className="w-full" />
					<p className="flex items-start gap-1.5 text-xs leading-relaxed text-kumo-subtle">
						<ShieldCheckIcon size={13} className="mt-0.5 shrink-0" />
						Protected by the same Cloudflare Access policy as this app, and can act on every
						mailbox.
					</p>
				</div>

				<div className="space-y-2">
					<div className="text-xs font-medium text-kumo-default">Tools</div>
					<div className="divide-y divide-kumo-hairline overflow-hidden rounded-lg ring-1 ring-kumo-hairline">
						{TOOLS.map((tool) => (
							<div key={tool.name} className="flex items-center justify-between gap-3 px-3 py-2">
								<code className="font-mono text-xs text-kumo-default">{tool.name}</code>
								<span className="truncate text-xs text-kumo-subtle">{tool.desc}</span>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
