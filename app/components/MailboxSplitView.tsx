// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button, cn, useSidebar } from "@cloudflare/kumo";
import { EnvelopeSimpleOpenIcon, ListIcon, SparkleIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import ComposePanel from "~/components/ComposePanel";
import EmailPanel from "~/components/EmailPanel";
import MailSearch from "~/components/MailSearch";
import { useUIStore } from "~/hooks/useUIStore";

/** Opens the navigation sheet on phones. */
export function MobileNavButton() {
	const { isMobile, toggleSidebar } = useSidebar();
	if (!isMobile) return null;
	return (
		<Button
			variant="ghost"
			shape="square"
			size="sm"
			className="-ml-1.5 size-8"
			icon={<ListIcon size={18} />}
			aria-label="Open navigation"
			onClick={toggleSidebar}
		/>
	);
}

interface ListPaneHeaderProps {
	title: ReactNode;
	subtitle?: ReactNode;
	leading?: ReactNode;
	actions?: ReactNode;
}

export function ListPaneHeader({ title, subtitle, leading, actions }: ListPaneHeaderProps) {
	return (
		<div className="shrink-0 space-y-2.5 px-4 pt-3 pb-3">
			<div className="flex h-8 items-center gap-1.5">
				<MobileNavButton />
				{leading}
				<div className="flex min-w-0 flex-1 items-baseline gap-2">
					<h1 className="truncate text-[15px] font-semibold tracking-tight text-kumo-strong">
						{title}
					</h1>
					{subtitle && (
						<span className="shrink-0 text-xs tabular-nums text-kumo-subtle">{subtitle}</span>
					)}
				</div>
				{actions && <div className="flex shrink-0 items-center gap-0.5">{actions}</div>}
			</div>
			<MailSearch />
		</div>
	);
}

function ReadingPaneEmpty() {
	const { askAgent } = useUIStore();
	return (
		<div className="flex h-full flex-col items-center justify-center px-8 text-center">
			<div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-kumo-tint ring-1 ring-kumo-hairline">
				<EnvelopeSimpleOpenIcon size={22} className="text-kumo-subtle" />
			</div>
			<p className="text-sm font-medium text-kumo-default">No conversation selected</p>
			<p className="mt-1 max-w-64 text-[13px] text-kumo-subtle">
				Pick an email from the list, or let the agent catch you up.
			</p>
			<Button
				variant="secondary"
				size="sm"
				className="mt-4"
				icon={<SparkleIcon size={14} weight="fill" className="text-kumo-brand" />}
				onClick={() => askAgent("Catch me up: what's new in my inbox and what needs a reply?")}
			>
				Summarize my inbox
			</Button>
			<div className="mt-8 hidden items-center gap-4 text-xs text-kumo-subtle md:flex">
				<Shortcut keys={["j", "k"]} label="Navigate" />
				<Shortcut keys={["c"]} label="Compose" />
				<Shortcut keys={["/"]} label="Search" />
				<Shortcut keys={["⌘", "J"]} label="Agent" />
			</div>
		</div>
	);
}

function Shortcut({ keys, label }: { keys: string[]; label: string }) {
	return (
		<span className="flex items-center gap-1.5">
			<span className="flex gap-0.5">
				{keys.map((k) => (
					<kbd
						key={k}
						className="min-w-5 rounded border border-kumo-line bg-kumo-base px-1 text-center font-sans text-[11px] leading-5 text-kumo-default"
					>
						{k}
					</kbd>
				))}
			</span>
			{label}
		</span>
	);
}

interface MailboxSplitViewProps {
	selectedEmailId: string | null;
	isComposing: boolean;
	children: ReactNode;
}

export default function MailboxSplitView({
	selectedEmailId,
	isComposing,
	children,
}: MailboxSplitViewProps) {
	const isPanelOpen = selectedEmailId !== null || isComposing;
	const isReply = isComposing && selectedEmailId !== null;

	return (
		<div className="flex h-full min-h-0">
			<section
				aria-label="Messages"
				className={cn(
					"min-h-0 min-w-0 shrink-0 flex-col border-kumo-hairline md:flex md:w-[320px] md:border-r lg:w-[360px] 2xl:w-[400px]",
					isPanelOpen ? "hidden" : "flex w-full",
				)}
			>
				{children}
			</section>
			<section
				aria-label="Reading pane"
				className={cn(
					"min-h-0 min-w-0 flex-1 flex-col",
					isPanelOpen ? "flex" : "hidden md:flex",
				)}
			>
				{isComposing && !isReply ? (
					<ComposePanel />
				) : selectedEmailId ? (
					<EmailPanel key={selectedEmailId} emailId={selectedEmailId} composing={isReply} />
				) : (
					<ReadingPaneEmpty />
				)}
			</section>
		</div>
	);
}
