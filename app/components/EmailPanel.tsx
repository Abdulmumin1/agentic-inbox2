// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button, useKumoToastManager } from "@cloudflare/kumo";
import {
	ArrowBendDoubleUpLeftIcon,
	ArrowBendUpLeftIcon,
	ArrowBendUpRightIcon,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import { Folders, getFolderDisplayName } from "shared/folders";
import ComposePanel from "~/components/ComposePanel";
import EmailPanelDialogs from "~/components/email-panel/EmailPanelDialogs";
import EmailPanelToolbar from "~/components/email-panel/EmailPanelToolbar";
import ThreadMessage from "~/components/email-panel/ThreadMessage";
import { useConfirm } from "~/components/ui/useConfirm";
import { useUIStore } from "~/hooks/useUIStore";
import { withEmailContext } from "~/lib/agent-context";
import { extractAddress, getSender } from "~/lib/people";
import { splitEmailList, toEmailListValue } from "~/lib/utils";
import {
	useDeleteEmail,
	useEmail,
	useMoveEmail,
	useReplyToEmail,
	useSendEmail,
	useThreadReplies,
	useUpdateEmail,
} from "~/queries/emails";
import { useFolders } from "~/queries/folders";
import { useMailbox } from "~/queries/mailboxes";
import api from "~/services/api";
import type { Email, Folder, Mailbox } from "~/types";

function EmailPanelSkeleton() {
	return (
		<div className="flex h-full flex-col">
			<div className="h-13 shrink-0 border-b border-kumo-hairline" />
			<div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-8">
				<div className="h-6 w-2/3 animate-pulse rounded bg-kumo-fill" />
				<div className="flex items-center gap-3">
					<div className="size-10 animate-pulse rounded-full bg-kumo-fill" />
					<div className="flex-1 space-y-2">
						<div className="h-3 w-40 animate-pulse rounded bg-kumo-fill" />
						<div className="h-2.5 w-24 animate-pulse rounded bg-kumo-tint" />
					</div>
				</div>
				<div className="space-y-2.5 pt-2">
					<div className="h-2.5 w-full animate-pulse rounded bg-kumo-tint" />
					<div className="h-2.5 w-5/6 animate-pulse rounded bg-kumo-tint" />
					<div className="h-2.5 w-4/6 animate-pulse rounded bg-kumo-tint" />
				</div>
			</div>
		</div>
	);
}

interface EmailPanelProps {
	emailId: string;
	/** Render the reply composer inline at the end of the thread. */
	composing?: boolean;
}

export default function EmailPanel({ emailId, composing = false }: EmailPanelProps) {
	const { mailboxId, folder } = useParams<{ mailboxId: string; folder: string }>();
	const { data: email } = useEmail(mailboxId, emailId) as { data?: Email };
	const { data: threadRepliesRaw } = useThreadReplies(mailboxId, email?.thread_id) as {
		data?: Email[];
	};
	const updateEmail = useUpdateEmail();
	const deleteEmailMut = useDeleteEmail();
	const moveEmailMut = useMoveEmail();
	const sendEmailMut = useSendEmail();
	const replyMut = useReplyToEmail();
	const { data: folders = [] } = useFolders(mailboxId) as { data?: Folder[] };
	const { data: currentMailbox } = useMailbox(mailboxId) as { data?: Mailbox };
	const { closePanel, startCompose, askAgent } = useUIStore();
	const toast = useKumoToastManager();
	const { confirm, dialog } = useConfirm();
	const [sendingId, setSendingId] = useState<string | null>(null);
	const [sourceViewEmail, setSourceViewEmail] = useState<Email | null>(null);
	const [expanded, setExpanded] = useState<Set<string>>(new Set());
	const [previewImage, setPreviewImage] = useState<{ url: string; filename: string } | null>(null);
	const [showAllMessages, setShowAllMessages] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);
	const composerRef = useRef<HTMLDivElement>(null);

	const currentFolder = folder || email?.folder_id || undefined;
	const isDraftFolder = currentFolder === Folders.DRAFT;
	const selfAddress = currentMailbox?.email?.toLowerCase();

	// Oldest first, so the conversation reads top to bottom.
	const messages = useMemo(() => {
		if (!email) return [];
		const others = (threadRepliesRaw ?? []).filter((e) => e.id !== email.id);
		return [email, ...others].sort(
			(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
		);
	}, [email, threadRepliesRaw]);

	const draftIds = useMemo(() => {
		const ids = new Set<string>();
		for (const msg of messages) {
			if (msg.folder_id === Folders.DRAFT || (isDraftFolder && msg.id === emailId)) ids.add(msg.id);
		}
		return ids;
	}, [messages, isDraftFolder, emailId]);

	const latestReceived = useMemo(() => {
		const nonDrafts = messages.filter((m) => !draftIds.has(m.id));
		const received = nonDrafts.filter((m) => extractAddress(m.sender) !== selfAddress);
		return received.at(-1) ?? nonDrafts.at(-1) ?? email;
	}, [messages, draftIds, selfAddress, email]);

	// Expand the newest message and every draft whenever the thread first loads.
	const initializedFor = useRef<string | null>(null);
	useEffect(() => {
		if (messages.length === 0 || initializedFor.current === `${emailId}:${messages.length}`) return;
		initializedFor.current = `${emailId}:${messages.length}`;
		const next = new Set<string>();
		const lastNonDraft = [...messages].reverse().find((m) => !draftIds.has(m.id));
		if (lastNonDraft) next.add(lastNonDraft.id);
		for (const id of draftIds) next.add(id);
		if (next.size === 0) next.add(messages[messages.length - 1].id);
		setExpanded(next);
	}, [messages, draftIds, emailId]);

	// Bring the inline composer into view when replying.
	useEffect(() => {
		if (composing) {
			requestAnimationFrame(() =>
				composerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
			);
		}
	}, [composing]);

	// Like Gmail: in long threads, fold the untouched middle into "N older messages".
	const visibleItems = useMemo(() => {
		type Item = { kind: "message"; message: Email } | { kind: "older"; count: number };
		const all: Item[] = messages.map((message) => ({ kind: "message", message }));
		if (showAllMessages || messages.length <= 4) return all;
		const keepTail = 2;
		const hidden: Email[] = [];
		for (let i = 1; i < messages.length - keepTail; i++) {
			const m = messages[i];
			if (!expanded.has(m.id) && !draftIds.has(m.id)) hidden.push(m);
		}
		if (hidden.length < 2) return all;
		const hiddenIds = new Set(hidden.map((m) => m.id));
		const items: Item[] = [];
		let inserted = false;
		for (const m of messages) {
			if (hiddenIds.has(m.id)) {
				if (!inserted) {
					items.push({ kind: "older", count: hidden.length });
					inserted = true;
				}
				continue;
			}
			items.push({ kind: "message", message: m });
		}
		return items;
	}, [messages, expanded, draftIds, showAllMessages]);

	const moveToFolders = useMemo(
		() => folders.filter((f) => f.id !== currentFolder),
		[folders, currentFolder],
	);

	if (!email) return <EmailPanelSkeleton />;

	const toggle = (id: string) =>
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});

	const handleMove = (folderId: string) => {
		if (!mailboxId) return;
		moveEmailMut.mutate({ mailboxId, id: email.id, folderId });
		toast.add({ title: `Moved to ${getFolderDisplayName(folderId)}` });
		closePanel();
	};

	const handleDelete = async () => {
		if (!mailboxId) return;
		const permanent = currentFolder === Folders.TRASH || currentFolder === Folders.DRAFT;
		if (!permanent) {
			handleMove(Folders.TRASH);
			return;
		}
		const ok = await confirm({
			title: isDraftFolder ? "Discard this draft?" : "Delete forever?",
			description: "This can't be undone.",
			confirmLabel: isDraftFolder ? "Discard" : "Delete forever",
			destructive: true,
		});
		if (!ok) return;
		deleteEmailMut.mutate({ mailboxId, id: email.id });
		toast.add({ title: isDraftFolder ? "Draft discarded" : "Deleted permanently" });
		closePanel();
	};

	const handleEditDraft = (draft: Email) => {
		const original = draft.in_reply_to
			? messages.find((m) => m.id === draft.in_reply_to)
			: undefined;
		startCompose({
			mode: draft.in_reply_to ? "reply" : "new",
			originalEmail: original,
			draftEmail: draft,
		});
	};

	const handleDiscardDraft = async (draft: Email) => {
		if (!mailboxId) return;
		const ok = await confirm({
			title: "Discard this draft?",
			description: "The draft will be removed. This can't be undone.",
			confirmLabel: "Discard",
			destructive: true,
		});
		if (!ok) return;
		deleteEmailMut.mutate({ mailboxId, id: draft.id });
		toast.add({ title: "Draft discarded" });
		if (draft.id === emailId) closePanel();
	};

	const handleSendDraft = async (draft: Email) => {
		let target = draft;
		if (!mailboxId || !currentMailbox) return;
		setSendingId(draft.id);
		try {
			if (!target.recipient || !target.subject) {
				try {
					const fresh = (await api.getEmail(mailboxId, target.id)) as Email;
					if (fresh) target = fresh;
				} catch {
					// Use what we have.
				}
			}
			const toRecipients = splitEmailList(target.recipient);
			if (toRecipients.length === 0) {
				toast.add({ title: "Add a recipient before sending this draft.", variant: "error" });
				return;
			}
			const fromName = currentMailbox.settings?.fromName || currentMailbox.name;
			const from =
				fromName && fromName !== currentMailbox.email
					? { email: currentMailbox.email, name: fromName }
					: currentMailbox.email;
			const original = target.in_reply_to
				? messages.find((m) => m.id === target.in_reply_to)
				: undefined;
			const payload = {
				to: toEmailListValue(toRecipients),
				cc: toEmailListValue(splitEmailList(target.cc)),
				bcc: toEmailListValue(splitEmailList(target.bcc)),
				from,
				subject: target.subject || "(no subject)",
				html: target.body || "",
				text: target.body ? target.body.replace(/<[^>]*>/g, "").trim() : "",
			};
			if (original) {
				await replyMut.mutateAsync({ mailboxId, emailId: original.id, email: payload });
			} else {
				await sendEmailMut.mutateAsync({ mailboxId, email: payload });
			}
			await deleteEmailMut.mutateAsync({ mailboxId, id: target.id });
			toast.add({ title: "Message sent", variant: "success" });
			if (isDraftFolder) closePanel();
		} catch (err) {
			const message = (err instanceof Error ? err.message : null) || "Failed to send email.";
			toast.add({ title: message, variant: "error" });
		} finally {
			setSendingId(null);
		}
	};

	const askAboutThis = (intent: "summarize" | "reply" | "actions") => {
		const target = latestReceived ?? email;
		const sender = getSender(target);
		const prompts = {
			summarize: "Summarize this conversation. Keep it short and call out anything I need to do.",
			reply: `Draft a reply to ${sender.name}'s latest message in this thread.`,
			actions: "List the action items and deadlines in this conversation.",
		};
		askAgent(withEmailContext(prompts[intent], target));
	};

	const recipientsCount = (msg: Email) =>
		new Set(
			[msg.sender, ...splitEmailList(msg.recipient), ...splitEmailList(msg.cc)]
				.map(extractAddress)
				.filter((a) => a !== selfAddress),
		).size;
	const canReplyAll = latestReceived ? recipientsCount(latestReceived) > 1 : false;
	const folderLabel = currentFolder ? getFolderDisplayName(currentFolder) : null;

	return (
		<div className="flex h-full min-h-0 flex-col">
			<EmailPanelToolbar
				email={email}
				currentFolder={currentFolder}
				moveToFolders={moveToFolders}
				onBack={closePanel}
				onArchive={() => handleMove(Folders.ARCHIVE)}
				onMove={handleMove}
				onToggleRead={() => {
					if (mailboxId) updateEmail.mutate({ mailboxId, id: email.id, data: { read: !email.read } });
				}}
				onToggleStar={() => {
					if (mailboxId) updateEmail.mutate({ mailboxId, id: email.id, data: { starred: !email.starred } });
				}}
				onDelete={handleDelete}
				onViewSource={() => setSourceViewEmail(email)}
				onAskAgent={askAboutThis}
			/>

			<div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
				<div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-10 sm:px-6">
					<div className="mb-4">
						<h2 className="text-xl font-semibold leading-snug tracking-tight text-balance text-kumo-strong">
							{email.subject || "(no subject)"}
						</h2>
						<div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-kumo-subtle">
							{folderLabel && (
								<span className="rounded-sm bg-kumo-tint px-1.5 py-px font-medium ring-1 ring-kumo-hairline">
									{folderLabel}
								</span>
							)}
							{messages.length > 1 && <span>{messages.length} messages</span>}
						</div>
					</div>

					<div className="divide-y divide-kumo-hairline border-t border-kumo-hairline">
						{visibleItems.map((item) => {
							if (item.kind === "older") {
								return (
									<div key="older" className="relative py-2">
										<button
											type="button"
											onClick={() => setShowAllMessages(true)}
											className="mx-auto flex items-center gap-2 rounded-full bg-kumo-base px-3 py-1 text-xs font-medium text-kumo-subtle ring-1 ring-kumo-line transition-colors hover:bg-kumo-tint hover:text-kumo-default"
										>
											<span className="flex size-4 items-center justify-center rounded-full bg-kumo-fill text-[10px] tabular-nums text-kumo-default">
												{item.count}
											</span>
											older message{item.count === 1 ? "" : "s"}
										</button>
									</div>
								);
							}
							const msg = item.message;
							const isDraft = draftIds.has(msg.id);
							return (
								<ThreadMessage
									key={msg.id}
									email={msg}
									mailboxId={mailboxId}
									mailboxEmail={currentMailbox?.email}
									isDraft={isDraft}
									isSending={sendingId === msg.id}
									isExpanded={expanded.has(msg.id)}
									collapsible={messages.length > 1}
									onToggleExpand={() => toggle(msg.id)}
									onReply={() => startCompose({ mode: "reply", originalEmail: msg })}
									onReplyAll={() => startCompose({ mode: "reply-all", originalEmail: msg })}
									onForward={() => startCompose({ mode: "forward", originalEmail: msg })}
									onSendDraft={isDraft ? () => handleSendDraft(msg) : undefined}
									onEditDraft={isDraft ? () => handleEditDraft(msg) : undefined}
									onDeleteDraft={isDraft ? () => handleDiscardDraft(msg) : undefined}
									onViewSource={() => setSourceViewEmail(msg)}
									onPreviewImage={(url, filename) => setPreviewImage({ url, filename })}
								/>
							);
						})}
					</div>

					{composing ? (
						<div ref={composerRef} className="scroll-mb-6 border-t border-kumo-hairline pt-4 animate-rise-in">
							<ComposePanel variant="inline" />
						</div>
					) : (
						!isDraftFolder && (
							<div className="flex flex-wrap items-center gap-2 border-t border-kumo-hairline pt-5 sm:pl-12">
								<Button
									variant="outline"
									icon={<ArrowBendUpLeftIcon size={16} />}
									onClick={() => startCompose({ mode: "reply", originalEmail: latestReceived })}
								>
									Reply
								</Button>
								{canReplyAll && (
									<Button
										variant="outline"
										icon={<ArrowBendDoubleUpLeftIcon size={16} />}
										onClick={() => startCompose({ mode: "reply-all", originalEmail: latestReceived })}
									>
										Reply all
									</Button>
								)}
								<Button
									variant="outline"
									icon={<ArrowBendUpRightIcon size={16} />}
									onClick={() => startCompose({ mode: "forward", originalEmail: messages.at(-1) ?? email })}
								>
									Forward
								</Button>
							</div>
						)
					)}
				</div>
			</div>

			<EmailPanelDialogs
				sourceViewEmail={sourceViewEmail}
				previewImage={previewImage}
				onCloseSource={() => setSourceViewEmail(null)}
				onClosePreview={() => setPreviewImage(null)}
			/>
			{dialog}
		</div>
	);
}
