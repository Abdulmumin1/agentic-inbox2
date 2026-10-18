// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button, Pagination, useKumoToastManager } from "@cloudflare/kumo";
import {
	ArchiveIcon,
	ArrowsClockwiseIcon,
	FileDashedIcon,
	FolderSimpleIcon,
	PaperPlaneTiltIcon,
	PencilSimpleLineIcon,
	ShieldCheckIcon,
	TrashIcon,
	TrayIcon,
} from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import { Folders, getFolderDisplayName } from "shared/folders";
import EmailListItem, { EmailListSkeleton, emailHasUnread } from "~/components/EmailListItem";
import MailboxSplitView, { ListPaneHeader } from "~/components/MailboxSplitView";
import { useConfirm } from "~/components/ui/useConfirm";
import { useListShortcuts } from "~/hooks/useKeyboardShortcuts";
import { useUIStore } from "~/hooks/useUIStore";
import {
	useDeleteEmail,
	useEmails,
	useMarkThreadRead,
	useMoveEmail,
	useUpdateEmail,
} from "~/queries/emails";
import { useFolders } from "~/queries/folders";
import { queryKeys } from "~/queries/keys";
import { useMailbox } from "~/queries/mailboxes";
import type { Email } from "~/types";

const PAGE_SIZE = 25;

const EMPTY_STATES: Record<
	string,
	{ icon: React.ElementType; title: string; description: string; compose?: boolean }
> = {
	[Folders.INBOX]: {
		icon: TrayIcon,
		title: "You're all caught up",
		description: "New mail will land here. The agent drafts replies as messages arrive.",
		compose: true,
	},
	[Folders.SENT]: {
		icon: PaperPlaneTiltIcon,
		title: "Nothing sent yet",
		description: "Messages you send will show up here.",
		compose: true,
	},
	[Folders.DRAFT]: {
		icon: FileDashedIcon,
		title: "No drafts",
		description: "Drafts you save, and replies the agent prepares, appear here.",
	},
	[Folders.ARCHIVE]: {
		icon: ArchiveIcon,
		title: "Archive is empty",
		description: "Archive conversations to clear your inbox without deleting them.",
	},
	[Folders.TRASH]: {
		icon: TrashIcon,
		title: "Trash is empty",
		description: "Deleted conversations stay here until they are removed.",
	},
	[Folders.SPAM]: {
		icon: ShieldCheckIcon,
		title: "No spam",
		description: "Suspicious messages will be filtered here.",
	},
};

function FolderEmptyState({ folder, onCompose }: { folder?: string; onCompose: () => void }) {
	const config: (typeof EMPTY_STATES)[string] = (folder && EMPTY_STATES[folder]) || {
		icon: FolderSimpleIcon,
		title: "This folder is empty",
		description: "Move conversations here to keep them organised.",
	};
	const Icon = config.icon;
	return (
		<div className="flex flex-col items-center px-8 pt-20 pb-10 text-center">
			<div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-kumo-tint ring-1 ring-kumo-hairline">
				<Icon size={22} className="text-kumo-subtle" />
			</div>
			<p className="text-sm font-medium text-kumo-default">{config.title}</p>
			<p className="mt-1 max-w-64 text-[13px] text-kumo-subtle">{config.description}</p>
			{config.compose && (
				<Button
					variant="secondary"
					size="sm"
					className="mt-4"
					icon={<PencilSimpleLineIcon size={14} />}
					onClick={onCompose}
				>
					Compose
				</Button>
			)}
		</div>
	);
}

export default function EmailListRoute() {
	const { mailboxId, folder } = useParams<{ mailboxId: string; folder: string }>();
	const { selectedEmailId, isComposing, selectEmail, closePanel, startCompose } = useUIStore();
	const [page, setPage] = useState(1);
	const toast = useKumoToastManager();
	const { confirm, dialog } = useConfirm();
	const listRef = useRef<HTMLDivElement>(null);

	const queryClient = useQueryClient();
	const updateEmail = useUpdateEmail();
	const markThreadRead = useMarkThreadRead();
	const deleteEmail = useDeleteEmail();
	const moveEmail = useMoveEmail();
	const { data: mailbox } = useMailbox(mailboxId);
	const { data: folders = [] } = useFolders(mailboxId);

	const params = useMemo(
		() => ({ folder: folder || "", page: String(page), limit: String(PAGE_SIZE) }),
		[folder, page],
	);

	const { data: emailData, isFetching, isLoading } = useEmails(mailboxId, params, {
		refetchInterval: 30_000,
	});

	const emails = emailData?.emails ?? [];
	const totalCount = emailData?.totalCount ?? 0;
	const folderInfo = folders.find((f) => f.id === folder);
	const folderName = folderInfo?.name ?? getFolderDisplayName(folder || Folders.INBOX);
	const unreadCount = folderInfo?.unreadCount ?? 0;

	// Reset selection and paging when switching folders.
	const prevFolderRef = useRef<string | undefined>(undefined);
	useEffect(() => {
		const key = `${mailboxId}/${folder}`;
		if (prevFolderRef.current !== key) {
			prevFolderRef.current = key;
			closePanel();
			setPage(1);
		}
	}, [mailboxId, folder, closePanel]);

	const markRead = (email: Email) => {
		if (!mailboxId || !emailHasUnread(email)) return;
		if (email.thread_id && (email.thread_count ?? 1) > 1) {
			markThreadRead.mutate({ mailboxId, threadId: email.thread_id });
		} else {
			updateEmail.mutate({ mailboxId, id: email.id, data: { read: true } });
		}
	};

	const open = (email: Email) => {
		selectEmail(email.id);
		markRead(email);
	};

	const toggleRead = (email: Email) => {
		if (!mailboxId) return;
		updateEmail.mutate({ mailboxId, id: email.id, data: { read: emailHasUnread(email) } });
	};

	const toggleStar = (email: Email) => {
		if (!mailboxId) return;
		updateEmail.mutate({ mailboxId, id: email.id, data: { starred: !email.starred } });
	};

	const neighbourOf = (emailId: string) => {
		const index = emails.findIndex((e) => e.id === emailId);
		return emails[index + 1] ?? emails[index - 1] ?? null;
	};

	/** Remove from view and move focus to the next conversation. */
	const advanceFrom = (emailId: string) => {
		if (selectedEmailId !== emailId) return;
		const next = neighbourOf(emailId);
		if (next) open(next);
		else closePanel();
	};

	const archive = (email: Email) => {
		if (!mailboxId) return;
		advanceFrom(email.id);
		moveEmail.mutate({ mailboxId, id: email.id, folderId: Folders.ARCHIVE });
		toast.add({ title: "Conversation archived" });
	};

	const remove = async (email: Email) => {
		if (!mailboxId) return;
		// Deleting is permanent in the backend, so everywhere except Trash and
		// Drafts we move to Trash instead, which is recoverable.
		const permanent = folder === Folders.TRASH || folder === Folders.DRAFT;
		if (permanent) {
			const ok = await confirm({
				title: folder === Folders.DRAFT ? "Discard this draft?" : "Delete forever?",
				description:
					folder === Folders.DRAFT
						? "The draft will be removed. This can't be undone."
						: "This conversation will be permanently deleted. This can't be undone.",
				confirmLabel: folder === Folders.DRAFT ? "Discard" : "Delete forever",
				destructive: true,
			});
			if (!ok) return;
			advanceFrom(email.id);
			deleteEmail.mutate({ mailboxId, id: email.id });
			toast.add({ title: folder === Folders.DRAFT ? "Draft discarded" : "Deleted permanently" });
			return;
		}
		advanceFrom(email.id);
		moveEmail.mutate({ mailboxId, id: email.id, folderId: Folders.TRASH });
		toast.add({ title: "Moved to trash" });
	};

	const refresh = () => {
		if (!mailboxId) return;
		queryClient.invalidateQueries({ queryKey: ["emails", mailboxId] });
		queryClient.invalidateQueries({ queryKey: queryKeys.folders.list(mailboxId) });
	};

	const selectedIndex = emails.findIndex((e) => e.id === selectedEmailId);
	const selected = selectedIndex >= 0 ? emails[selectedIndex] : null;

	const moveSelection = (delta: number) => {
		if (emails.length === 0) return;
		const index =
			selectedIndex === -1
				? delta > 0
					? 0
					: emails.length - 1
				: Math.min(emails.length - 1, Math.max(0, selectedIndex + delta));
		const target = emails[index];
		if (!target) return;
		open(target);
		listRef.current
			?.querySelector(`[data-email-id="${CSS.escape(target.id)}"]`)
			?.scrollIntoView({ block: "nearest" });
	};

	useListShortcuts({
		enabled: !isComposing,
		next: () => moveSelection(1),
		previous: () => moveSelection(-1),
		archive: selected && folder !== Folders.ARCHIVE ? () => archive(selected) : undefined,
		remove: selected ? () => remove(selected) : undefined,
		reply: selected ? () => startCompose({ mode: "reply", originalEmail: selected }) : undefined,
		close: () => {
			if (!isComposing) closePanel();
		},
	});

	return (
		<MailboxSplitView selectedEmailId={selectedEmailId} isComposing={isComposing}>
			<ListPaneHeader
				title={folderName}
				subtitle={unreadCount > 0 ? `${unreadCount} unread` : undefined}
				actions={
					<Button
						variant="ghost"
						shape="square"
						size="sm"
						className="size-8 text-kumo-subtle"
						title="Refresh"
						icon={<ArrowsClockwiseIcon size={16} className={isFetching ? "animate-spin" : ""} />}
						onClick={refresh}
					/>
				}
			/>

			<div ref={listRef} className="min-h-0 flex-1 overflow-y-auto pb-2">
				{isLoading ? (
					<EmailListSkeleton />
				) : emails.length > 0 ? (
					<div className="flex flex-col gap-px">
						{emails.map((email) => (
							<EmailListItem
								key={email.id}
								email={email}
								selected={selectedEmailId === email.id}
								selfAddress={mailbox?.email}
								onOpen={() => open(email)}
								onToggleStar={() => toggleStar(email)}
								onToggleRead={() => toggleRead(email)}
								onArchive={folder !== Folders.ARCHIVE ? () => archive(email) : undefined}
								onDelete={() => remove(email)}
							/>
						))}
					</div>
				) : (
					<FolderEmptyState folder={folder} onCompose={() => startCompose()} />
				)}
			</div>

			{totalCount > PAGE_SIZE && (
				<div className="flex shrink-0 justify-center border-t border-kumo-hairline px-3 py-2">
					<Pagination
						page={page}
						setPage={setPage}
						perPage={PAGE_SIZE}
						totalCount={totalCount}
						controls="simple"
					/>
				</div>
			)}
			{dialog}
		</MailboxSplitView>
	);
}
