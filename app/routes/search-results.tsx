// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button, Pagination } from "@cloudflare/kumo";
import { ArrowLeftIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { getFolderDisplayName } from "shared/folders";
import EmailListItem, { EmailListSkeleton } from "~/components/EmailListItem";
import MailboxSplitView, { ListPaneHeader } from "~/components/MailboxSplitView";
import { useListShortcuts } from "~/hooks/useKeyboardShortcuts";
import { useUIStore } from "~/hooks/useUIStore";
import { useUpdateEmail } from "~/queries/emails";
import { useMailbox } from "~/queries/mailboxes";
import { SEARCH_PAGE_SIZE, useSearchEmails } from "~/queries/search";
import type { Email } from "~/types";

const OPERATOR_PATTERN =
	/\b(?:from|to|subject|in|is|has|before|after):(?:"[^"]*"|\S+)/gi;

function makeHighlighter(query: string) {
	const freeText = query.replace(OPERATOR_PATTERN, "").trim();
	if (!freeText) return undefined;
	const terms = freeText
		.split(/\s+/)
		.filter((t) => t.length > 1)
		.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
	if (terms.length === 0) return undefined;
	const regex = new RegExp(`(${terms.join("|")})`, "gi");
	const lowerTerms = new Set(freeText.toLowerCase().split(/\s+/));

	return (text: string): React.ReactNode => {
		const parts = text.split(regex);
		if (parts.length === 1) return text;
		return parts.map((part, i) =>
			lowerTerms.has(part.toLowerCase()) ? (
				<mark key={i} className="rounded-sm bg-kumo-warning-tint px-0.5 text-kumo-default">
					{part}
				</mark>
			) : (
				part
			),
		);
	};
}

const OPERATOR_HINTS = ["from:name", "is:unread", "has:attachment", "before:2026-01-01"];

export default function SearchResultsRoute() {
	const { mailboxId } = useParams<{ mailboxId: string }>();
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const { selectedEmailId, isComposing, selectEmail, closePanel, startCompose } = useUIStore();
	const updateEmail = useUpdateEmail();
	const { data: mailbox } = useMailbox(mailboxId);
	const urlQuery = searchParams.get("q") || "";
	const [page, setPage] = useState(1);
	const searchKey = `${mailboxId ?? ""}::${urlQuery}`;
	const prevSearchKeyRef = useRef(searchKey);
	const searchChanged = prevSearchKeyRef.current !== searchKey;
	const currentPage = searchChanged ? 1 : page;

	useEffect(() => {
		if (!searchChanged) return;
		prevSearchKeyRef.current = searchKey;
		setPage(1);
		closePanel();
	}, [closePanel, searchChanged, searchKey]);

	const { data: searchData, isLoading } = useSearchEmails(mailboxId, urlQuery, currentPage);
	const results = searchData?.results ?? [];
	const totalCount = searchData?.totalCount ?? 0;
	const highlight = useMemo(() => makeHighlighter(urlQuery), [urlQuery]);

	const open = (email: Email) => {
		selectEmail(email.id);
		if (!email.read && mailboxId) {
			updateEmail.mutate({ mailboxId, id: email.id, data: { read: true } });
		}
	};

	const selectedIndex = results.findIndex((e) => e.id === selectedEmailId);
	const selected = selectedIndex >= 0 ? results[selectedIndex] : null;
	const move = (delta: number) => {
		if (results.length === 0) return;
		const index =
			selectedIndex === -1 ? 0 : Math.min(results.length - 1, Math.max(0, selectedIndex + delta));
		if (results[index]) open(results[index]);
	};

	useListShortcuts({
		enabled: !isComposing,
		next: () => move(1),
		previous: () => move(-1),
		reply: selected ? () => startCompose({ mode: "reply", originalEmail: selected }) : undefined,
		close: () => {
			if (!isComposing) closePanel();
		},
	});

	return (
		<MailboxSplitView selectedEmailId={selectedEmailId} isComposing={isComposing}>
			<ListPaneHeader
				leading={
					<Button
						variant="ghost"
						shape="square"
						size="sm"
						className="size-8"
						title="Back to inbox"
						icon={<ArrowLeftIcon size={16} />}
						onClick={() => navigate(`/mailbox/${mailboxId}/emails/inbox`)}
					/>
				}
				title="Search"
				subtitle={
					isLoading ? undefined : `${totalCount} result${totalCount === 1 ? "" : "s"}`
				}
			/>

			<div className="min-h-0 flex-1 overflow-y-auto pb-2">
				{isLoading ? (
					<EmailListSkeleton rows={6} />
				) : results.length === 0 ? (
					<div className="flex flex-col items-center px-8 pt-20 text-center">
						<div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-kumo-tint ring-1 ring-kumo-hairline">
							<MagnifyingGlassIcon size={22} className="text-kumo-subtle" />
						</div>
						<p className="text-sm font-medium text-kumo-default">No matches</p>
						<p className="mt-1 max-w-64 text-[13px] text-kumo-subtle">
							{urlQuery
								? `Nothing matched “${urlQuery}”. Try fewer words or an operator.`
								: "Search by sender, subject or content."}
						</p>
						<div className="mt-4 flex max-w-72 flex-wrap justify-center gap-1.5">
							{OPERATOR_HINTS.map((hint) => (
								<code
									key={hint}
									className="rounded-md bg-kumo-tint px-1.5 py-0.5 font-mono text-[11px] text-kumo-subtle ring-1 ring-kumo-hairline"
								>
									{hint}
								</code>
							))}
						</div>
					</div>
				) : (
					<div className="flex flex-col gap-px">
						{results.map((email) => {
							const folderName = (email as Email & { folder_name?: string }).folder_name;
							return (
								<EmailListItem
									key={email.id}
									email={email}
									selected={selectedEmailId === email.id}
									selfAddress={mailbox?.email}
									folderLabel={folderName ? getFolderDisplayName(folderName) : undefined}
									highlight={highlight}
									onOpen={() => open(email)}
								/>
							);
						})}
					</div>
				)}
			</div>

			{totalCount > SEARCH_PAGE_SIZE && (
				<div className="flex shrink-0 justify-center border-t border-kumo-hairline px-3 py-2">
					<Pagination
						page={currentPage}
						setPage={setPage}
						perPage={SEARCH_PAGE_SIZE}
						totalCount={totalCount}
						controls="simple"
					/>
				</div>
			)}
		</MailboxSplitView>
	);
}
