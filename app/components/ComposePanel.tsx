// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Banner, Button, cn, TagInput } from "@cloudflare/kumo";
import {
	ArrowLeftIcon,
	FloppyDiskIcon,
	PaperPlaneTiltIcon,
	TrashIcon,
	XIcon,
} from "@phosphor-icons/react";
import { type ReactNode, useMemo } from "react";
import { useParams } from "react-router";
import { RichTextContent, RichTextToolbar, useRichTextEditor } from "~/components/RichTextEditor";
import Avatar from "~/components/ui/Avatar";
import { useComposeForm } from "~/hooks/useComposeForm";
import { useUIStore } from "~/hooks/useUIStore";
import { extractAddress, nameFromAddress } from "~/lib/people";
import { splitEmailList } from "~/lib/utils";

// Accept `addr@x.y` or `Name <addr@x.y>`.
const EMAIL_PATTERN =
	/^(?:[^<>]*<\s*[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+\s*>|[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+)$/;

function FieldRow({
	label,
	children,
	trailing,
}: {
	label: string;
	children: ReactNode;
	trailing?: ReactNode;
}) {
	return (
		<div className="flex min-h-11 items-center gap-3 border-b border-kumo-hairline">
			<span className="w-14 shrink-0 text-[13px] text-kumo-subtle">{label}</span>
			<div className="min-w-0 flex-1">{children}</div>
			{trailing}
		</div>
	);
}

function RecipientInput({
	value,
	onChange,
	label,
	autoFocus,
}: {
	value: string;
	onChange: (value: string) => void;
	label: string;
	autoFocus?: boolean;
}) {
	const values = useMemo(() => splitEmailList(value), [value]);
	return (
		<TagInput
			aria-label={label}
			value={values}
			onValueChange={(next) => onChange(next.join(", "))}
			validateValue={(entry) => EMAIL_PATTERN.test(entry.trim())}
			placeholder={values.length === 0 ? "name@example.com" : undefined}
			autoFocus={autoFocus}
			labels={{ invalidValue: (entry: string) => `“${entry}” isn't a valid email address` }}
			className="min-h-10 rounded-none bg-transparent px-0 py-1.5 shadow-none ring-0! focus-within:ring-0!"
		/>
	);
}

interface ComposePanelProps {
	/** "page" fills the reading pane; "inline" renders as a card under a thread. */
	variant?: "page" | "inline";
}

export default function ComposePanel({ variant = "page" }: ComposePanelProps) {
	const { mailboxId, folder } = useParams<{ mailboxId: string; folder: string }>();
	const { composeOptions } = useUIStore();
	const {
		to,
		setTo,
		cc,
		setCc,
		bcc,
		setBcc,
		showCcBcc,
		setShowCcBcc,
		subject,
		setSubject,
		body,
		setBody,
		quoted,
		expandQuoted,
		error,
		isSavingDraft,
		isSending,
		formTitle,
		handleSaveDraft,
		handleSend,
		closeCompose,
		closePanel,
	} = useComposeForm(mailboxId, folder);

	const isInline = variant === "inline";
	const isReply = composeOptions.mode === "reply" || composeOptions.mode === "reply-all";
	const showSubject = !isInline || !isReply;
	const replyTarget = composeOptions.originalEmail?.sender || composeOptions.draftEmail?.recipient;
	const minHeight = isInline ? "min-h-20" : "min-h-72";

	// Replies already know who they're going to: start in the body.
	const editor = useRichTextEditor({
		value: body,
		onChange: setBody,
		minHeightClassName: minHeight,
		autoFocus: isReply || Boolean(composeOptions.draftEmail),
	});

	const onClose = isInline ? closeCompose : closePanel;

	const ccToggle = !showCcBcc ? (
		<button
			type="button"
			onClick={() => setShowCcBcc(true)}
			className="shrink-0 rounded-md px-1.5 py-1 text-xs font-medium text-kumo-subtle transition-colors hover:bg-kumo-tint hover:text-kumo-default"
		>
			Cc / Bcc
		</button>
	) : null;

	const form = (
		<form
			onSubmit={(e) => handleSend(e, onClose)}
			onKeyDown={(e) => {
				if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
					e.preventDefault();
					e.currentTarget.requestSubmit();
				}
			}}
			className="flex min-h-0 flex-1 flex-col"
		>
			<div className={cn("min-h-0 flex-1", isInline ? "" : "overflow-y-auto px-4 sm:px-6")}>
				<div className={cn(!isInline && "mx-auto max-w-3xl")}>
					{error && (
						<div className="pt-3">
							<Banner variant="error" size="sm" description={error} />
						</div>
					)}
					<FieldRow label="To" trailing={ccToggle}>
						<RecipientInput
							label="To"
							value={to}
							onChange={setTo}
							autoFocus={!isReply && !composeOptions.draftEmail}
						/>
					</FieldRow>
					{showCcBcc && (
						<>
							<FieldRow label="Cc">
								<RecipientInput label="Cc" value={cc} onChange={setCc} />
							</FieldRow>
							<FieldRow label="Bcc">
								<RecipientInput label="Bcc" value={bcc} onChange={setBcc} />
							</FieldRow>
						</>
					)}
					{showSubject && (
						<FieldRow label="Subject">
							<input
								type="text"
								aria-label="Subject"
								value={subject}
								onChange={(e) => setSubject(e.target.value)}
								placeholder="What's this about?"
								className="h-10 w-full bg-transparent text-sm font-medium text-kumo-default outline-none placeholder:font-normal placeholder:text-kumo-placeholder"
								required
							/>
						</FieldRow>
					)}
					<RichTextContent editor={editor} className="pt-4 pb-2" minHeightClassName={minHeight} />
					{quoted && (
						<button
							type="button"
							onClick={expandQuoted}
							title="Show trimmed content"
							aria-label="Show trimmed content"
							className="mb-3 inline-flex h-3.5 items-center rounded-full bg-kumo-fill px-2 text-[10px] font-bold leading-none tracking-widest text-kumo-subtle transition-colors hover:bg-kumo-fill-hover hover:text-kumo-default"
						>
							•••
						</button>
					)}
				</div>
			</div>

			<div
				className={cn(
					"flex shrink-0 items-center gap-2",
					isInline ? "pt-2" : "border-t border-kumo-hairline px-4 py-3 sm:px-6",
				)}
			>
				<Button
					type="submit"
					variant="primary"
					loading={isSending}
					disabled={isSavingDraft || isSending}
					icon={<PaperPlaneTiltIcon size={15} weight="fill" />}
				>
					{isSending ? "Sending…" : "Send"}
				</Button>
				<span className="hidden text-xs text-kumo-subtle lg:inline">⌘↵</span>
				<div className="ml-1 hidden min-w-0 flex-1 overflow-x-auto sm:block">
					<RichTextToolbar editor={editor} />
				</div>
				<div className="flex-1 sm:hidden" />
				<Button
					type="button"
					variant="ghost"
					shape="square"
					className="text-kumo-subtle"
					title={isSavingDraft ? "Saving…" : "Save draft"}
					loading={isSavingDraft}
					disabled={isSending}
					icon={<FloppyDiskIcon size={17} />}
					onClick={handleSaveDraft}
				/>
				<Button
					type="button"
					variant="ghost"
					shape="square"
					className="text-kumo-subtle hover:text-kumo-danger"
					title="Discard"
					disabled={isSending}
					icon={<TrashIcon size={17} />}
					onClick={onClose}
				/>
			</div>
		</form>
	);

	if (isInline) {
		// Reads like the next message in the thread: no card, same avatar column.
		return (
			<div className="flex flex-col">
				<div className="flex items-center gap-3">
					<Avatar name="You" seed={mailboxId} size="lg" className="size-9" />
					<div className="flex min-w-0 flex-1 items-baseline gap-1.5">
						<span className="text-sm font-semibold text-kumo-strong">{formTitle}</span>
						{replyTarget && isReply && (
							<span className="truncate text-xs text-kumo-subtle">
								to {nameFromAddress(extractAddress(replyTarget))}
							</span>
						)}
					</div>
					<Button
						variant="ghost"
						shape="square"
						size="sm"
						className="size-8 text-kumo-subtle"
						title="Close"
						icon={<XIcon size={15} />}
						onClick={onClose}
						disabled={isSending}
					/>
				</div>
				<div className="sm:pl-12">{form}</div>
			</div>
		);
	}

	return (
		<div className="flex h-full min-h-0 flex-col bg-kumo-base">
			<div className="flex h-13 shrink-0 items-center gap-2 border-b border-kumo-hairline px-3 sm:px-4">
				<Button
					variant="ghost"
					shape="square"
					size="sm"
					className="size-8 md:hidden"
					aria-label="Back"
					icon={<ArrowLeftIcon size={18} />}
					onClick={onClose}
				/>
				<h2 className="pl-1 text-[15px] font-semibold tracking-tight text-kumo-strong">{formTitle}</h2>
				<div className="flex-1" />
				<Button
					variant="ghost"
					shape="square"
					size="sm"
					className="hidden size-8 text-kumo-subtle md:inline-flex"
					title="Close"
					icon={<XIcon size={17} />}
					onClick={onClose}
					disabled={isSending}
				/>
			</div>
			{form}
		</div>
	);
}
