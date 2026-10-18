// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import {
	Banner,
	Button,
	Dialog,
	Input,
	InputGroup,
	Label,
	Loader,
	Select,
	useKumoToastManager,
} from "@cloudflare/kumo";
import {
	CaretRightIcon,
	EnvelopeSimpleIcon,
	PlusIcon,
	SparkleIcon,
	TrashIcon,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link as RouterLink } from "react-router";
import Avatar from "~/components/ui/Avatar";
import { useConfirm } from "~/components/ui/useConfirm";
import { useTheme } from "~/hooks/useTheme";
import { nameFromAddress } from "~/lib/people";
import { queryKeys } from "~/queries/keys";
import { useCreateMailbox, useDeleteMailbox, useMailboxes } from "~/queries/mailboxes";
import api from "~/services/api";

export function meta() {
	return [{ title: "Agentic Inbox" }];
}

export default function HomeRoute() {
	// Apply the saved theme (and follow the OS when set to system).
	useTheme();
	const toastManager = useKumoToastManager();
	const { confirm, dialog } = useConfirm();
	const {
		data: mailboxes = [],
		refetch: refetchMailboxes,
		isFetched: mailboxesFetched,
	} = useMailboxes();
	const createMailbox = useCreateMailbox();
	const deleteMailbox = useDeleteMailbox();

	const { data: configData } = useQuery({
		queryKey: queryKeys.config,
		queryFn: () => api.getConfig(),
		staleTime: Number.POSITIVE_INFINITY, // config rarely changes
	});

	const domains = configData?.domains ?? [];
	const emailAddresses = configData?.emailAddresses ?? [];

	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [newPrefix, setNewPrefix] = useState("");
	const [selectedDomain, setSelectedDomain] = useState("");
	const [newName, setNewName] = useState("");
	const [isCreating, setIsCreating] = useState(false);
	const [createError, setCreateError] = useState<string | null>(null);

	// Set default domain when config loads
	useEffect(() => {
		if (domains.length > 0 && !selectedDomain) {
			setSelectedDomain(domains[0]);
		}
	}, [domains, selectedDomain]);

	// Auto-create mailboxes from config (run once when both data sources are ready)
	const autoCreateDone = useRef(false);
	useEffect(() => {
		if (autoCreateDone.current) return;
		if (emailAddresses.length === 0 || !mailboxesFetched) return;
		const existingEmails = new Set(mailboxes.map((m) => m.email.toLowerCase()));
		const toCreate = emailAddresses.filter((addr) => !existingEmails.has(addr.toLowerCase()));
		if (toCreate.length === 0) {
			autoCreateDone.current = true;
			return;
		}
		autoCreateDone.current = true;
		let cancelled = false;
		Promise.all(
			toCreate.map((addr) => {
				const localPart = addr.split("@")[0] || addr;
				return api.createMailbox(addr, localPart).catch(() => {});
			}),
		).then(() => {
			if (!cancelled) refetchMailboxes();
		});
		return () => {
			cancelled = true;
		};
	}, [emailAddresses, mailboxes, mailboxesFetched, refetchMailboxes]);

	const handleCreate = async (e: FormEvent) => {
		e.preventDefault();
		setCreateError(null);
		const prefix = newPrefix.trim().toLowerCase();
		if (!prefix || !selectedDomain) {
			setCreateError("Enter an address for the mailbox.");
			return;
		}
		const email = `${prefix}@${selectedDomain}`;
		const name = newName.trim() || prefix;
		setIsCreating(true);
		try {
			await createMailbox.mutateAsync({ email, name });
			toastManager.add({ title: `${email} is ready`, variant: "success" });
			setIsCreateOpen(false);
			setNewPrefix("");
			setNewName("");
		} catch (err: unknown) {
			const message = (err instanceof Error ? err.message : null) || "Failed to create mailbox";
			setCreateError(message);
		} finally {
			setIsCreating(false);
		}
	};

	const handleDelete = async (mailbox: { id: string; email: string }) => {
		const ok = await confirm({
			title: `Delete ${mailbox.email}?`,
			description: "Every email, draft and attachment in this mailbox will be permanently deleted.",
			confirmLabel: "Delete mailbox",
			destructive: true,
		});
		if (!ok) return;
		try {
			await deleteMailbox.mutateAsync(mailbox.id);
			toastManager.add({ title: "Mailbox deleted" });
		} catch {
			toastManager.add({ title: "Couldn't delete the mailbox", variant: "error" });
		}
	};

	const isConfigured = emailAddresses.length > 0;
	const accounts = isConfigured
		? emailAddresses.map((addr) => ({ id: addr, email: addr, name: addr.split("@")[0] || addr }))
		: mailboxes;
	const displayName = (account: { name: string; email: string }) =>
		account.name && account.name !== account.email ? account.name : nameFromAddress(account.email);
	const isLoading = !configData;

	return (
		<div className="min-h-dvh bg-kumo-recessed">
			<div className="mx-auto max-w-xl px-4 pt-16 pb-12 sm:pt-24">
				<header className="mb-8 flex items-end justify-between gap-4">
					<div>
						<div className="mb-4 flex size-10 items-center justify-center rounded-xl ai-mark">
							<SparkleIcon size={20} weight="fill" />
						</div>
						<h1 className="text-2xl font-semibold tracking-tight text-kumo-strong">Agentic Inbox</h1>
						<p className="mt-1 text-sm text-kumo-subtle">
							{domains.length > 0 ? `Mail for ${domains.join(", ")}` : "Choose a mailbox to open."}
						</p>
					</div>
					{!isConfigured && accounts.length > 0 && (
						<Button variant="primary" icon={<PlusIcon size={15} weight="bold" />} onClick={() => setIsCreateOpen(true)}>
							New mailbox
						</Button>
					)}
				</header>

				{isLoading ? (
					<div className="flex justify-center py-20">
						<Loader />
					</div>
				) : accounts.length > 0 ? (
					<ul className="overflow-hidden rounded-xl bg-kumo-base shadow-xs ring-1 ring-kumo-hairline">
						{accounts.map((account, idx) => (
							<li key={account.id} className={idx > 0 ? "border-t border-kumo-hairline" : undefined}>
								<RouterLink
									to={`/mailbox/${account.id}/emails/inbox`}
									className="group flex items-center gap-3.5 px-4 py-3.5 no-underline transition-colors hover:bg-kumo-tint"
								>
									<Avatar name={displayName(account)} seed={account.id} size="lg" className="rounded-xl" />
									<div className="min-w-0 flex-1">
										<div className="truncate text-sm font-medium text-kumo-strong">{displayName(account)}</div>
										<div className="truncate text-[13px] text-kumo-subtle">{account.email}</div>
									</div>
									{!isConfigured && (
										<Button
											variant="ghost"
											shape="square"
											size="sm"
											className="size-8 text-kumo-subtle opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-kumo-danger"
											title="Delete mailbox"
											icon={<TrashIcon size={16} />}
											onClick={(e) => {
												e.preventDefault();
												e.stopPropagation();
												handleDelete(account);
											}}
										/>
									)}
									<CaretRightIcon
										size={16}
										className="shrink-0 text-kumo-subtle transition-transform group-hover:translate-x-0.5"
									/>
								</RouterLink>
							</li>
						))}
					</ul>
				) : (
					<div className="flex flex-col items-center rounded-xl bg-kumo-base px-6 py-14 text-center shadow-xs ring-1 ring-kumo-hairline">
						<div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-kumo-tint ring-1 ring-kumo-hairline">
							<EnvelopeSimpleIcon size={22} className="text-kumo-subtle" />
						</div>
						<p className="text-sm font-medium text-kumo-default">No mailboxes yet</p>
						<p className="mt-1 max-w-sm text-[13px] text-kumo-subtle">
							{isConfigured
								? "Your addresses are configured. Their mailboxes will appear here in a moment."
								: "Create an address on your domain to start sending and receiving mail."}
						</p>
						{!isConfigured && (
							<Button
								variant="primary"
								className="mt-5"
								icon={<PlusIcon size={15} weight="bold" />}
								onClick={() => setIsCreateOpen(true)}
							>
								Create mailbox
							</Button>
						)}
					</div>
				)}

				<p className="mt-6 text-center text-xs text-kumo-subtle">
					Runs on your Cloudflare account · Email Routing, Durable Objects, R2 and Workers AI
				</p>
			</div>

			<Dialog.Root open={isCreateOpen} onOpenChange={setIsCreateOpen}>
				<Dialog size="base" className="p-6">
					<Dialog.Title className="text-base font-semibold">New mailbox</Dialog.Title>
					<Dialog.Description className="mt-1 text-sm text-kumo-subtle">
						Mail sent to this address will land here, and the agent will start drafting replies.
					</Dialog.Description>
					<form onSubmit={handleCreate} className="mt-5 space-y-4">
						{createError && <Banner variant="error" size="sm" description={createError} />}
						<div className="space-y-1.5">
							<Label>Address</Label>
							{domains.length > 1 ? (
								<div className="flex items-center gap-2">
									<Input
										aria-label="Address"
										placeholder="hello"
										value={newPrefix}
										onChange={(e) => setNewPrefix(e.target.value)}
										className="flex-1"
										autoFocus
										required
									/>
									<span className="text-sm text-kumo-subtle">@</span>
									<Select
										aria-label="Domain"
										value={selectedDomain}
										onValueChange={(value) => {
											if (value) setSelectedDomain(value as string);
										}}
									>
										{domains.map((d) => (
											<Select.Option key={d} value={d}>
												{d}
											</Select.Option>
										))}
									</Select>
								</div>
							) : (
								<InputGroup>
									<InputGroup.Input
										aria-label="Address"
										placeholder="hello"
										value={newPrefix}
										onChange={(e) => setNewPrefix(e.target.value)}
										autoFocus
										required
									/>
									<InputGroup.Suffix>@{selectedDomain || "your-domain.com"}</InputGroup.Suffix>
								</InputGroup>
							)}
						</div>
						<Input
							label="Display name"
							description="Shown to recipients. Defaults to the address."
							placeholder="Hello from Thirdpen"
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
						/>
						<div className="flex justify-end gap-2 pt-2">
							<Dialog.Close
								render={(props) => (
									<Button {...props} variant="secondary">
										Cancel
									</Button>
								)}
							/>
							<Button type="submit" variant="primary" loading={isCreating} disabled={!selectedDomain}>
								Create mailbox
							</Button>
						</div>
					</form>
				</Dialog>
			</Dialog.Root>
			{dialog}
		</div>
	);
}
