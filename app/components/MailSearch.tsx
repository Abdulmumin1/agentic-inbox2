// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { InputGroup } from "@cloudflare/kumo";
import { MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";
import { type KeyboardEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { SEARCH_INPUT_ID } from "~/hooks/useKeyboardShortcuts";

export default function MailSearch() {
	const { mailboxId } = useParams<{ mailboxId: string }>();
	const navigate = useNavigate();
	const location = useLocation();
	const [searchParams] = useSearchParams();
	const isSearchRoute = location.pathname.endsWith("/search");
	const urlQuery = isSearchRoute ? searchParams.get("q") || "" : "";
	const [query, setQuery] = useState(urlQuery);

	// Keep the field in sync with the URL (back/forward, external links).
	useEffect(() => {
		setQuery(urlQuery);
	}, [urlQuery]);

	const submit = () => {
		const q = query.trim();
		if (!mailboxId || !q) return;
		navigate(`/mailbox/${mailboxId}/search?q=${encodeURIComponent(q)}`);
	};

	const clear = () => {
		setQuery("");
		if (isSearchRoute && mailboxId) navigate(`/mailbox/${mailboxId}/emails/inbox`);
	};

	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter") {
			event.preventDefault();
			submit();
		} else if (event.key === "Escape") {
			event.preventDefault();
			if (query) clear();
			else event.currentTarget.blur();
		}
	};

	return (
		<InputGroup size="sm" className="w-full bg-kumo-recessed ring-transparent">
			<InputGroup.Addon>
				<MagnifyingGlassIcon className="text-kumo-subtle" />
			</InputGroup.Addon>
			<InputGroup.Input
				id={SEARCH_INPUT_ID}
				type="search"
				aria-label="Search mail"
				placeholder="Search mail"
				autoComplete="off"
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				onKeyDown={onKeyDown}
				className="[&::-webkit-search-cancel-button]:hidden"
			/>
			<InputGroup.Addon align="end" className="pr-1">
				{query ? (
					<InputGroup.Button size="sm" aria-label="Clear search" onClick={clear}>
						<XIcon size={12} />
					</InputGroup.Button>
				) : (
					<kbd className="mr-1 hidden rounded border border-kumo-line px-1 font-sans text-[10px] leading-4 text-kumo-subtle md:inline">
						/
					</kbd>
				)}
			</InputGroup.Addon>
		</InputGroup>
	);
}
