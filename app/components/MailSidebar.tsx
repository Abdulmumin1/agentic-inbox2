// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import {
	Button,
	cn,
	Dialog,
	DropdownMenu,
	Input,
	Sidebar,
	useSidebar,
} from "@cloudflare/kumo";
import {
	ArchiveIcon,
	CaretUpDownIcon,
	CheckIcon,
	DesktopIcon,
	FileDashedIcon,
	FolderSimpleIcon,
	GearSixIcon,
	MoonIcon,
	PaperPlaneTiltIcon,
	PencilSimpleLineIcon,
	PlusIcon,
	ShieldWarningIcon,
	SparkleIcon,
	SquaresFourIcon,
	SunIcon,
	TrashIcon,
	TrayIcon,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { Folders, SYSTEM_FOLDER_IDS } from "shared/folders";
import Avatar from "~/components/ui/Avatar";
import { type ThemePreference, useTheme } from "~/hooks/useTheme";
import { useUIStore } from "~/hooks/useUIStore";
import { useCreateFolder, useFolders } from "~/queries/folders";
import { useMailbox, useMailboxes } from "~/queries/mailboxes";

const SYSTEM_LINKS = [
	{ id: Folders.INBOX, label: "Inbox", icon: TrayIcon },
	{ id: Folders.DRAFT, label: "Drafts", icon: FileDashedIcon },
	{ id: Folders.SENT, label: "Sent", icon: PaperPlaneTiltIcon },
	{ id: Folders.ARCHIVE, label: "Archive", icon: ArchiveIcon },
	{ id: Folders.TRASH, label: "Trash", icon: TrashIcon },
] as const;

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: typeof SunIcon }[] = [
	{ value: "light", label: "Light", icon: SunIcon },
	{ value: "dark", label: "Dark", icon: MoonIcon },
	{ value: "system", label: "System", icon: DesktopIcon },
];

function Count({ value, active }: { value: number; active?: boolean }) {
	if (!value) return null;
	return (
		<span
			className={cn(
				"ml-auto min-w-5 rounded-full px-1.5 text-center text-xs font-semibold tabular-nums leading-5",
				"group-data-[state=collapsed]/sidebar:hidden",
				active ? "bg-kumo-brand text-white" : "text-kumo-subtle",
			)}
		>
			{value > 999 ? "999+" : value}
		</span>
	);
}

function useDisplayName(mailboxId?: string) {
	const { data: mailbox } = useMailbox(mailboxId);
	return useMemo(() => {
		if (!mailbox) return mailboxId?.split("@")[0] || "Mailbox";
		if (mailbox.settings?.fromName) return mailbox.settings.fromName;
		if (mailbox.name && mailbox.name !== mailbox.email) return mailbox.name;
		return mailbox.email.split("@")[0] || mailbox.name;
	}, [mailbox, mailboxId]);
}

function MailboxSwitcher() {
	const { mailboxId } = useParams<{ mailboxId: string }>();
	const navigate = useNavigate();
	const displayName = useDisplayName(mailboxId);
	const { data: mailboxes = [] } = useMailboxes();

	return (
		<DropdownMenu>
			<DropdownMenu.Trigger
				render={
					<button
						type="button"
						className={cn(
							"flex w-full min-w-0 items-center gap-2.5 rounded-lg p-1.5 text-left outline-none transition-colors",
							"hover:bg-(--sidebar-active-bg) focus-visible:bg-(--sidebar-active-bg) data-[popup-open]:bg-(--sidebar-active-bg)",
							"group-data-[state=collapsed]/sidebar:justify-center group-data-[state=collapsed]/sidebar:p-0.5",
						)}
						aria-label="Switch mailbox"
					>
						<Avatar name={displayName} seed={mailboxId} size="sm" className="rounded-lg" />
						<span className="min-w-0 flex-1 group-data-[state=collapsed]/sidebar:hidden">
							<span className="block truncate text-sm font-semibold text-kumo-default">
								{displayName}
							</span>
							<span className="block truncate text-xs text-kumo-subtle">{mailboxId}</span>
						</span>
						<CaretUpDownIcon
							size={14}
							className="shrink-0 text-kumo-subtle group-data-[state=collapsed]/sidebar:hidden"
						/>
					</button>
				}
			/>
			<DropdownMenu.Content align="start" sideOffset={6} className="min-w-64">
				<DropdownMenu.Group>
					<DropdownMenu.Label>Mailboxes</DropdownMenu.Label>
					{mailboxes.map((mailbox) => (
						<DropdownMenu.Item
							key={mailbox.id}
							onClick={() => navigate(`/mailbox/${mailbox.id}/emails/inbox`)}
							icon={<Avatar name={mailbox.name || mailbox.email} seed={mailbox.id} size="xs" />}
						>
							<span className="min-w-0 flex-1 truncate">{mailbox.email}</span>
							{mailbox.id === mailboxId && (
								<CheckIcon size={14} className="ml-2 shrink-0 text-kumo-link" />
							)}
						</DropdownMenu.Item>
					))}
				</DropdownMenu.Group>
				<DropdownMenu.Separator />
				<DropdownMenu.Item icon={SquaresFourIcon} onClick={() => navigate("/")}>
					Manage mailboxes
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu>
	);
}

function ThemeMenu() {
	const { preference, setPreference } = useTheme();
	const current = THEME_OPTIONS.find((option) => option.value === preference) ?? THEME_OPTIONS[2];
	const CurrentIcon = current.icon;

	return (
		<DropdownMenu>
			<DropdownMenu.Trigger
				render={
					<Button
						variant="ghost"
						shape="square"
						className="size-8.5 text-kumo-subtle"
						icon={<CurrentIcon size={18} />}
						aria-label="Change theme"
					/>
				}
			/>
			<DropdownMenu.Content side="top" align="start" sideOffset={6}>
				<DropdownMenu.RadioGroup
					value={preference}
					onValueChange={(value) => setPreference(value as ThemePreference)}
				>
					{THEME_OPTIONS.map((option) => (
						<DropdownMenu.RadioItem key={option.value} value={option.value} icon={option.icon}>
							{option.label}
						</DropdownMenu.RadioItem>
					))}
				</DropdownMenu.RadioGroup>
			</DropdownMenu.Content>
		</DropdownMenu>
	);
}

export default function MailSidebar() {
	const { mailboxId } = useParams<{ mailboxId: string }>();
	const location = useLocation();
	const { isMobile, setOpenMobile, state } = useSidebar();
	const { data: folders = [] } = useFolders(mailboxId);
	const createFolderMutation = useCreateFolder();
	const { startCompose, isAgentPanelOpen, toggleAgentPanel } = useUIStore();
	const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
	const [newFolderName, setNewFolderName] = useState("");

	const base = `/mailbox/${mailboxId}`;
	const isCollapsed = !isMobile && state === "collapsed";

	const customFolders = useMemo(
		() =>
			folders.filter(
				(f) => !(SYSTEM_FOLDER_IDS as readonly string[]).includes(f.id),
			),
		[folders],
	);

	const unread = (folderId: string) =>
		folders.find((f) => f.id === folderId)?.unreadCount || 0;

	const isActive = (path: string) =>
		location.pathname === path || location.pathname.startsWith(`${path}/`);

	const closeOnMobile = () => {
		if (isMobile) setOpenMobile(false);
	};

	const handleCreateFolder = (e: React.FormEvent) => {
		e.preventDefault();
		if (newFolderName.trim() && mailboxId) {
			createFolderMutation.mutate({ mailboxId, name: newFolderName.trim() });
			setNewFolderName("");
			setIsCreateFolderOpen(false);
		}
	};

	return (
		<Sidebar contentClassName="md:py-2">
			<Sidebar.Header className="h-auto border-b-0 px-2 pt-2 pb-1 group-data-[state=collapsed]/sidebar:px-[11px]">
				<MailboxSwitcher />
			</Sidebar.Header>

			<div className="shrink-0 px-2 pt-2 pb-1 group-data-[state=collapsed]/sidebar:px-[11px]">
				<Button
					variant="primary"
					icon={<PencilSimpleLineIcon size={16} weight="bold" />}
					onClick={() => {
						startCompose();
						closeOnMobile();
					}}
					title={isCollapsed ? "Compose" : undefined}
					className={cn(
						"h-9 w-full justify-center",
						isCollapsed && "size-8.5 w-8.5 px-0",
					)}
				>
					{isCollapsed ? null : "Compose"}
				</Button>
			</div>

			<Sidebar.Content className="px-0">
				<Sidebar.Group>
					<Sidebar.Menu>
						{SYSTEM_LINKS.map((link) => {
							const path = `${base}/emails/${link.id}`;
							const active = isActive(path);
							const count = link.id === Folders.INBOX ? unread(link.id) : 0;
							return (
								<Sidebar.MenuButton
									key={link.id}
									href={path}
									icon={<link.icon size={17} weight={active ? "fill" : "regular"} className={cn("shrink-0", active ? "text-kumo-default" : "text-kumo-subtle")} />}
									active={active}
									tooltip={link.label}
									onClick={closeOnMobile}
									className={cn(!active && "font-normal text-kumo-strong")}
								>
									{link.label}
									<Count value={count} active={link.id === Folders.INBOX} />
								</Sidebar.MenuButton>
							);
						})}
					</Sidebar.Menu>
				</Sidebar.Group>

				<Sidebar.Group>
					<Sidebar.GroupLabel>
						<span className="flex items-center justify-between">
							<span>Folders</span>
							<button
								type="button"
								onClick={() => setIsCreateFolderOpen(true)}
								className="-mr-1 rounded-md p-1 text-kumo-subtle transition-colors hover:bg-(--sidebar-active-bg) hover:text-kumo-default"
								aria-label="Create folder"
							>
								<PlusIcon size={13} weight="bold" />
							</button>
						</span>
					</Sidebar.GroupLabel>
					<Sidebar.Menu>
						{customFolders.map((folder) => {
							const path = `${base}/emails/${folder.id}`;
							const active = isActive(path);
							const Icon = folder.id === Folders.SPAM ? ShieldWarningIcon : FolderSimpleIcon;
							return (
								<Sidebar.MenuButton
									key={folder.id}
									href={path}
									icon={<Icon size={17} weight={active ? "fill" : "regular"} className={cn("shrink-0", active ? "text-kumo-default" : "text-kumo-subtle")} />}
									active={active}
									tooltip={folder.name}
									onClick={closeOnMobile}
									className={cn(!active && "font-normal text-kumo-strong")}
								>
									{folder.name}
									<Count value={folder.unreadCount} />
								</Sidebar.MenuButton>
							);
						})}
					</Sidebar.Menu>
				</Sidebar.Group>
			</Sidebar.Content>

			<Sidebar.Footer className="h-auto flex-col items-stretch gap-0.5 border-t-0 bg-transparent px-2 py-2 group-data-[state=collapsed]/sidebar:border-r-0 group-data-[state=collapsed]/sidebar:px-[11px]">
				<Sidebar.Menu>
					<Sidebar.MenuButton
						icon={<SparkleIcon size={17} weight={isAgentPanelOpen ? "fill" : "regular"} className={cn("shrink-0", isAgentPanelOpen ? "text-kumo-brand" : "text-kumo-subtle")} />}
						active={isAgentPanelOpen}
						tooltip="Agent"
						onClick={() => {
							toggleAgentPanel();
							closeOnMobile();
						}}
						className={cn(!isAgentPanelOpen && "font-normal text-kumo-strong")}
					>
						Agent
						<kbd className="ml-auto hidden rounded border border-kumo-line px-1 font-sans text-[10px] text-kumo-subtle md:inline group-data-[state=collapsed]/sidebar:hidden">
							⌘J
						</kbd>
					</Sidebar.MenuButton>
					<Sidebar.MenuButton
						href={`${base}/settings`}
						icon={<GearSixIcon size={17} weight={isActive(`${base}/settings`) ? "fill" : "regular"} className="shrink-0 text-kumo-subtle" />}
						active={isActive(`${base}/settings`)}
						tooltip="Settings"
						onClick={closeOnMobile}
						className={cn(!isActive(`${base}/settings`) && "font-normal text-kumo-strong")}
					>
						Settings
					</Sidebar.MenuButton>
				</Sidebar.Menu>
				<div className="mt-1 flex items-center gap-1 group-data-[state=collapsed]/sidebar:flex-col">
					<ThemeMenu />
					<div className="flex-1 group-data-[state=collapsed]/sidebar:hidden" />
					{!isMobile && <Sidebar.Trigger className="text-kumo-subtle" />}
				</div>
			</Sidebar.Footer>

			<Dialog.Root open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
				<Dialog size="sm" className="p-6">
					<Dialog.Title className="mb-1 text-base font-semibold">New folder</Dialog.Title>
					<Dialog.Description className="mb-4 text-sm text-kumo-subtle">
						Folders help you keep related conversations together.
					</Dialog.Description>
					<form onSubmit={handleCreateFolder} className="space-y-4">
						<Input
							label="Name"
							placeholder="e.g. Clients"
							value={newFolderName}
							onChange={(e) => setNewFolderName(e.target.value)}
							autoFocus
							required
						/>
						<div className="flex justify-end gap-2">
							<Dialog.Close
								render={(props) => (
									<Button {...props} variant="secondary">
										Cancel
									</Button>
								)}
							/>
							<Button type="submit" variant="primary" disabled={!newFolderName.trim()}>
								Create folder
							</Button>
						</div>
					</form>
				</Dialog>
			</Dialog.Root>
		</Sidebar>
	);
}
