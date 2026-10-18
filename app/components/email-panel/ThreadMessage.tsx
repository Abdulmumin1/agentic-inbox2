// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button, cn, DropdownMenu } from "@cloudflare/kumo";
import {
	ArrowBendDoubleUpLeftIcon,
	ArrowBendUpLeftIcon,
	ArrowBendUpRightIcon,
	CodeIcon,
	DotsThreeIcon,
	PaperPlaneTiltIcon,
	PencilSimpleIcon,
	TrashIcon,
} from "@phosphor-icons/react";
import { formatDetailDate, formatListDate } from "shared/dates";
import EmailAttachmentList from "~/components/EmailAttachmentList";
import EmailIframe from "~/components/EmailIframe";
import Avatar from "~/components/ui/Avatar";
import { extractAddress, getSender, nameFromAddress } from "~/lib/people";
import { getSnippetText, rewriteInlineImages, splitEmailList } from "~/lib/utils";
import type { Email } from "~/types";

interface ThreadMessageProps {
	email: Email;
	mailboxId?: string;
	mailboxEmail?: string;
	isDraft?: boolean;
	isSending?: boolean;
	isExpanded: boolean;
	/** When false the message can't be collapsed (single-message threads). */
	collapsible?: boolean;
	onToggleExpand: () => void;
	onReply?: () => void;
	onReplyAll?: () => void;
	onForward?: () => void;
	onSendDraft?: () => void;
	onEditDraft?: () => void;
	onDeleteDraft?: () => void;
	onViewSource?: () => void;
	onPreviewImage?: (url: string, filename: string) => void;
}

function describeRecipients(email: Email, self?: string): string {
	const selfAddress = self?.toLowerCase();
	const label = (value: string) => {
		const address = extractAddress(value);
		return address === selfAddress ? "me" : nameFromAddress(address);
	};
	const to = splitEmailList(email.recipient).map(label);
	const cc = splitEmailList(email.cc).map(label);
	const parts = [`to ${to.join(", ") || "undisclosed recipients"}`];
	if (cc.length > 0) parts.push(`cc ${cc.join(", ")}`);
	return parts.join(", ");
}

/** One-line preview of what's new in a message, without the quoted history. */
function previewOf(email: Email): string {
	return getSnippetText(email.body, 400)
		.replace(/\s*On\s.{0,200}?\swrote:.*$/s, "")
		.trim();
}

export default function ThreadMessage({
	email,
	mailboxId,
	mailboxEmail,
	isDraft,
	isSending,
	isExpanded,
	collapsible = true,
	onToggleExpand,
	onReply,
	onReplyAll,
	onForward,
	onSendDraft,
	onEditDraft,
	onDeleteDraft,
	onViewSource,
	onPreviewImage,
}: ThreadMessageProps) {
	const sender = getSender(email);
	const isSelf = extractAddress(email.sender) === mailboxEmail?.toLowerCase();
	const displayName = isSelf || isDraft ? "You" : sender.name;
	const expanded = isExpanded || !collapsible;

	if (!expanded) {
		return (
			<button
				type="button"
				onClick={onToggleExpand}
				className="-mx-3 flex w-[calc(100%+1.5rem)] items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-kumo-tint"
			>
				<Avatar name={displayName} seed={sender.email} size="sm" className="ml-1" />
				<span className="flex w-36 shrink-0 items-baseline gap-1.5 truncate sm:w-44">
					<span className="truncate text-sm font-medium text-kumo-default">{displayName}</span>
					{isDraft && <span className="shrink-0 text-xs text-kumo-danger">Draft</span>}
				</span>
				<span className="min-w-0 flex-1 truncate text-[13px] text-kumo-subtle">{previewOf(email)}</span>
				<span className="shrink-0 text-xs tabular-nums text-kumo-subtle">{formatListDate(email.date)}</span>
			</button>
		);
	}

	return (
		<article className="py-4">
			<header className="flex items-start gap-3">
				<button
					type="button"
					onClick={collapsible ? onToggleExpand : undefined}
					className={cn("shrink-0 rounded-full", collapsible && "cursor-pointer")}
					aria-label={collapsible ? "Collapse message" : undefined}
					tabIndex={collapsible ? 0 : -1}
				>
					<Avatar name={displayName} seed={sender.email} size="lg" className="size-9" />
				</button>
				<div
					className={cn("min-w-0 flex-1 pt-0.5", collapsible && "cursor-pointer")}
					onClick={collapsible ? onToggleExpand : undefined}
				>
					<div className="flex min-w-0 items-baseline gap-1.5">
						<span className="truncate text-sm font-semibold text-kumo-strong">{displayName}</span>
						{isDraft ? (
							<span className="shrink-0 text-xs font-medium text-kumo-danger">Draft</span>
						) : (
							<span className="hidden min-w-0 truncate text-xs text-kumo-subtle sm:inline">
								&lt;{sender.email}&gt;
							</span>
						)}
					</div>
					<div className="mt-0.5 truncate text-xs text-kumo-subtle">
						{describeRecipients(email, mailboxEmail)}
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-0.5">
					<span className="mr-1 hidden text-xs tabular-nums text-kumo-subtle sm:inline">
						{formatDetailDate(email.date)}
					</span>
					{!isDraft && onReply && (
						<Button
							variant="ghost"
							shape="square"
							size="sm"
							className="size-8 text-kumo-subtle"
							title="Reply"
							icon={<ArrowBendUpLeftIcon size={16} />}
							onClick={onReply}
						/>
					)}
					<DropdownMenu>
						<DropdownMenu.Trigger
							render={
								<Button
									variant="ghost"
									shape="square"
									size="sm"
									className="size-8 text-kumo-subtle"
									icon={<DotsThreeIcon size={18} weight="bold" />}
									aria-label="More actions"
								/>
							}
						/>
						<DropdownMenu.Content align="end" sideOffset={4}>
							{!isDraft && onReply && (
								<DropdownMenu.Item icon={ArrowBendUpLeftIcon} onClick={onReply}>
									Reply
								</DropdownMenu.Item>
							)}
							{!isDraft && onReplyAll && (
								<DropdownMenu.Item icon={ArrowBendDoubleUpLeftIcon} onClick={onReplyAll}>
									Reply all
								</DropdownMenu.Item>
							)}
							{!isDraft && onForward && (
								<DropdownMenu.Item icon={ArrowBendUpRightIcon} onClick={onForward}>
									Forward
								</DropdownMenu.Item>
							)}
							{!isDraft && (onReply || onForward) && <DropdownMenu.Separator />}
							{onViewSource && (
								<DropdownMenu.Item icon={CodeIcon} onClick={onViewSource}>
									View headers
								</DropdownMenu.Item>
							)}
						</DropdownMenu.Content>
					</DropdownMenu>
				</div>
			</header>

			<div className="mt-3 sm:pl-12">
				<div className="email-sheet">
					<EmailIframe
						body={rewriteInlineImages(email.body || "", mailboxId || "", email.id, email.attachments)}
						autoSize
					/>
				</div>

				<EmailAttachmentList
					mailboxId={mailboxId}
					emailId={email.id}
					attachments={email.attachments}
					onPreviewImage={onPreviewImage}
					className="mt-4"
				/>

				{isDraft && (onSendDraft || onEditDraft || onDeleteDraft) && (
					<div className="mt-4 flex flex-wrap items-center gap-2">
						{onSendDraft && (
							<Button
								variant="primary"
								size="sm"
								className="h-8 px-3"
								icon={<PaperPlaneTiltIcon size={14} weight="fill" />}
								onClick={onSendDraft}
								loading={isSending}
							>
								{isSending ? "Sending…" : "Send"}
							</Button>
						)}
						{onEditDraft && (
							<Button
								variant="secondary"
								size="sm"
								className="h-8 px-3"
								icon={<PencilSimpleIcon size={14} />}
								onClick={onEditDraft}
								disabled={isSending}
							>
								Edit
							</Button>
						)}
						{onDeleteDraft && (
							<Button
								variant="ghost"
								size="sm"
								className="h-8 px-3 text-kumo-subtle"
								icon={<TrashIcon size={14} />}
								onClick={onDeleteDraft}
								disabled={isSending}
							>
								Discard
							</Button>
						)}
					</div>
				)}
			</div>
		</article>
	);
}
