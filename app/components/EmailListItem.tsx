// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button, cn } from "@cloudflare/kumo";
import {
	ArchiveIcon,
	ArrowBendUpLeftIcon,
	EnvelopeOpenIcon,
	EnvelopeSimpleIcon,
	PaperclipIcon,
	StarIcon,
	TrashIcon,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { formatListDate } from "shared/dates";
import Avatar from "~/components/ui/Avatar";
import { formatParticipants, nameFromAddress } from "~/lib/people";
import { getSnippetText } from "~/lib/utils";
import type { Email } from "~/types";

export function emailHasUnread(email: Email): boolean {
	if (email.thread_unread_count !== undefined) return email.thread_unread_count > 0;
	return !email.read;
}

interface EmailListItemProps {
	email: Email;
	selected: boolean;
	selfAddress?: string;
	/** Folder name chip, used in search results. */
	folderLabel?: string;
	highlight?: (text: string) => ReactNode;
	onOpen: () => void;
	onToggleStar?: () => void;
	onToggleRead?: () => void;
	onArchive?: () => void;
	onDelete?: () => void;
}

function RowAction({
	label,
	onClick,
	children,
}: {
	label: string;
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<Button
			variant="ghost"
			shape="square"
			size="sm"
			title={label}
			icon={children}
			onClick={(e) => {
				e.stopPropagation();
				onClick();
			}}
			className="size-7 text-kumo-subtle hover:text-kumo-default"
		/>
	);
}

export default function EmailListItem({
	email,
	selected,
	selfAddress,
	folderLabel,
	highlight,
	onOpen,
	onToggleStar,
	onToggleRead,
	onArchive,
	onDelete,
}: EmailListItemProps) {
	const unread = emailHasUnread(email);
	const snippet = getSnippetText(email.snippet, 140);
	const people = formatParticipants(email, selfAddress);
	const threadCount = email.thread_count ?? 1;
	const render = (text: string) => (highlight ? highlight(text) : text);
	const hasAttachment = (email.attachments?.length ?? 0) > 0;

	return (
		<div
			role="button"
			tabIndex={0}
			data-email-id={email.id}
			aria-current={selected ? "true" : undefined}
			onClick={onOpen}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onOpen();
				}
			}}
			className={cn(
				"group relative mx-2 flex cursor-pointer gap-3 rounded-lg px-3 py-2.5 outline-none transition-colors",
				"focus-visible:ring-2 focus-visible:ring-kumo-brand/40",
				selected ? "bg-kumo-fill/60" : "hover:bg-kumo-tint",
			)}
		>
			{/* Unread marker */}
			<span
				aria-hidden="true"
				className={cn(
					"absolute top-[22px] left-1 size-1.5 rounded-full bg-kumo-brand transition-opacity",
					unread ? "opacity-100" : "opacity-0",
				)}
			/>

			<Avatar name={nameFromAddress(email.sender)} seed={email.sender} size="md" className="mt-0.5" />

			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-1.5">
					<span
						className={cn(
							"truncate text-sm",
							unread ? "font-semibold text-kumo-strong" : "text-kumo-default",
						)}
					>
						{render(people)}
					</span>
					{threadCount > 1 && (
						<span className="shrink-0 text-xs font-medium tabular-nums text-kumo-subtle">
							{threadCount}
						</span>
					)}
					<span className="ml-auto flex shrink-0 items-center gap-1 pl-2 text-xs tabular-nums text-kumo-subtle">
						{email.starred && (
							<StarIcon size={12} weight="fill" className="text-kumo-warning" />
						)}
						<span className={cn(unread && "font-medium text-kumo-default")}>
							{formatListDate(email.date)}
						</span>
					</span>
				</div>

				<div
					className={cn(
						"mt-0.5 truncate text-[13px]",
						unread ? "font-medium text-kumo-default" : "text-kumo-default",
					)}
				>
					{render(email.subject || "(no subject)")}
				</div>

				<div className="mt-0.5 flex items-center gap-1.5">
					<span className="min-w-0 flex-1 truncate text-[13px] text-kumo-subtle">
						{snippet ? render(snippet) : "\u00a0"}
					</span>
					{hasAttachment && (
						<PaperclipIcon size={13} className="shrink-0 text-kumo-subtle" />
					)}
				</div>

				{(email.has_draft || email.needs_reply || folderLabel) && (
					<div className="mt-1.5 flex items-center gap-1.5">
						{folderLabel && (
							<span className="rounded-sm bg-kumo-tint px-1.5 py-px text-[11px] font-medium text-kumo-subtle ring-1 ring-kumo-hairline">
								{folderLabel}
							</span>
						)}
						{email.has_draft && (
							<span className="rounded-sm bg-kumo-danger-tint px-1.5 py-px text-[11px] font-medium text-kumo-danger">
								Draft
							</span>
						)}
						{email.needs_reply && !email.has_draft && (
							<span className="inline-flex items-center gap-1 rounded-sm bg-kumo-warning-tint px-1.5 py-px text-[11px] font-medium text-kumo-warning">
								<ArrowBendUpLeftIcon size={10} weight="bold" />
								Needs reply
							</span>
						)}
					</div>
				)}
			</div>

			{/* Quick actions */}
			{(onArchive || onToggleRead || onDelete || onToggleStar) && (
				<div
					className={cn(
						"absolute top-1.5 right-2 hidden items-center gap-px rounded-lg bg-kumo-base p-0.5 shadow-sm ring-1 ring-kumo-line",
						// Hover for the mouse; keyboard focus only (a clicked row keeps focus).
						"group-hover:flex group-focus-visible:flex group-has-[:focus-visible]:flex",
					)}
				>
					{onArchive && (
						<RowAction label="Archive" onClick={onArchive}>
							<ArchiveIcon size={15} />
						</RowAction>
					)}
					{onToggleRead && (
						<RowAction label={unread ? "Mark as read" : "Mark as unread"} onClick={onToggleRead}>
							{unread ? <EnvelopeOpenIcon size={15} /> : <EnvelopeSimpleIcon size={15} />}
						</RowAction>
					)}
					{onToggleStar && (
						<RowAction label={email.starred ? "Unstar" : "Star"} onClick={onToggleStar}>
							<StarIcon
								size={15}
								weight={email.starred ? "fill" : "regular"}
								className={email.starred ? "text-kumo-warning" : undefined}
							/>
						</RowAction>
					)}
					{onDelete && (
						<RowAction label="Delete" onClick={onDelete}>
							<TrashIcon size={15} />
						</RowAction>
					)}
				</div>
			)}
		</div>
	);
}

export function EmailListSkeleton({ rows = 8 }: { rows?: number }) {
	return (
		<div className="space-y-1 px-2 py-2" aria-hidden="true">
			{Array.from({ length: rows }).map((_, i) => (
				<div key={i} className="flex gap-3 rounded-lg px-3 py-2.5">
					<div className="size-8 shrink-0 animate-pulse rounded-full bg-kumo-fill" />
					<div className="flex-1 space-y-2 pt-1">
						<div className="flex items-center gap-2">
							<div className="h-3 w-28 animate-pulse rounded bg-kumo-fill" />
							<div className="ml-auto h-2.5 w-10 animate-pulse rounded bg-kumo-fill" />
						</div>
						<div className="h-2.5 w-3/4 animate-pulse rounded bg-kumo-fill" />
						<div className="h-2.5 w-1/2 animate-pulse rounded bg-kumo-tint" />
					</div>
				</div>
			))}
		</div>
	);
}
