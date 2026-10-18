// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button, DropdownMenu } from "@cloudflare/kumo";
import {
	ArchiveIcon,
	ArrowLeftIcon,
	CaretDownIcon,
	CodeIcon,
	DotsThreeIcon,
	EnvelopeOpenIcon,
	EnvelopeSimpleIcon,
	FolderSimpleIcon,
	ListChecksIcon,
	PencilSimpleLineIcon,
	SparkleIcon,
	StarIcon,
	TextAlignLeftIcon,
	TrashIcon,
	TrayIcon,
	XIcon,
} from "@phosphor-icons/react";
import { Folders } from "shared/folders";
import type { Email, Folder } from "~/types";

interface EmailPanelToolbarProps {
	email: Email;
	currentFolder?: string;
	moveToFolders: Folder[];
	onBack: () => void;
	onArchive: () => void;
	onMove: (folderId: string) => void;
	onToggleRead: () => void;
	onToggleStar: () => void;
	onDelete: () => void;
	onViewSource: () => void;
	onAskAgent: (intent: "summarize" | "reply" | "actions") => void;
}

function ToolbarButton({
	label,
	icon,
	onClick,
	className,
}: {
	label: string;
	icon: React.ReactNode;
	onClick: () => void;
	className?: string;
}) {
	return (
		<Button
			variant="ghost"
			shape="square"
			size="sm"
			className={`size-8 text-kumo-subtle hover:text-kumo-default ${className ?? ""}`}
			title={label}
			icon={icon}
			onClick={onClick}
		/>
	);
}

export default function EmailPanelToolbar({
	email,
	currentFolder,
	moveToFolders,
	onBack,
	onArchive,
	onMove,
	onToggleRead,
	onToggleStar,
	onDelete,
	onViewSource,
	onAskAgent,
}: EmailPanelToolbarProps) {
	const folder = currentFolder || email.folder_id || "";
	const inArchive = folder === Folders.ARCHIVE;

	return (
		<div className="flex h-13 shrink-0 items-center gap-0.5 border-b border-kumo-hairline px-2 sm:px-3">
			<Button
				variant="ghost"
				shape="square"
				size="sm"
				className="size-8 md:hidden"
				icon={<ArrowLeftIcon size={18} />}
				aria-label="Back to list"
				onClick={onBack}
			/>

			{inArchive ? (
				<ToolbarButton label="Move to inbox" icon={<TrayIcon size={17} />} onClick={() => onMove(Folders.INBOX)} />
			) : (
				<ToolbarButton label="Archive (e)" icon={<ArchiveIcon size={17} />} onClick={onArchive} />
			)}
			<ToolbarButton
				label={folder === Folders.TRASH || folder === Folders.DRAFT ? "Delete forever" : "Move to trash (#)"}
				icon={<TrashIcon size={17} />}
				onClick={onDelete}
			/>
			<ToolbarButton
				label={email.read ? "Mark as unread" : "Mark as read"}
				icon={email.read ? <EnvelopeSimpleIcon size={17} /> : <EnvelopeOpenIcon size={17} />}
				onClick={onToggleRead}
			/>

			<DropdownMenu>
				<DropdownMenu.Trigger
					render={
						<Button
							variant="ghost"
							shape="square"
							size="sm"
							className="size-8 text-kumo-subtle hover:text-kumo-default"
							icon={<FolderSimpleIcon size={17} />}
							aria-label="Move to folder"
						/>
					}
				/>
				<DropdownMenu.Content align="start" sideOffset={4} className="min-w-44">
					<DropdownMenu.Group>
						<DropdownMenu.Label>Move to</DropdownMenu.Label>
						{moveToFolders.map((f) => (
							<DropdownMenu.Item key={f.id} icon={FolderSimpleIcon} onClick={() => onMove(f.id)}>
								{f.name}
							</DropdownMenu.Item>
						))}
					</DropdownMenu.Group>
				</DropdownMenu.Content>
			</DropdownMenu>

			<div className="flex-1" />

			<DropdownMenu>
				<DropdownMenu.Trigger
					render={
						<Button
							variant="ghost"
							size="sm"
							className="h-8 gap-1.5 px-2.5 text-kumo-default"
							icon={<SparkleIcon size={15} weight="fill" className="text-kumo-brand" />}
						>
							<span className="hidden sm:inline">Ask agent</span>
							<CaretDownIcon size={11} className="text-kumo-subtle" />
						</Button>
					}
				/>
				<DropdownMenu.Content align="end" sideOffset={4} className="min-w-56">
					<DropdownMenu.Item icon={TextAlignLeftIcon} onClick={() => onAskAgent("summarize")}>
						Summarize this conversation
					</DropdownMenu.Item>
					<DropdownMenu.Item icon={PencilSimpleLineIcon} onClick={() => onAskAgent("reply")}>
						Draft a reply
					</DropdownMenu.Item>
					<DropdownMenu.Item icon={ListChecksIcon} onClick={() => onAskAgent("actions")}>
						List action items
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu>

			<ToolbarButton
				label={email.starred ? "Unstar" : "Star"}
				icon={
					<StarIcon
						size={17}
						weight={email.starred ? "fill" : "regular"}
						className={email.starred ? "text-kumo-warning" : undefined}
					/>
				}
				onClick={onToggleStar}
			/>

			<DropdownMenu>
				<DropdownMenu.Trigger
					render={
						<Button
							variant="ghost"
							shape="square"
							size="sm"
							className="size-8 text-kumo-subtle hover:text-kumo-default"
							icon={<DotsThreeIcon size={18} weight="bold" />}
							aria-label="More"
						/>
					}
				/>
				<DropdownMenu.Content align="end" sideOffset={4}>
					<DropdownMenu.Item icon={CodeIcon} onClick={onViewSource}>
						View headers
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu>

			<ToolbarButton
				label="Close (Esc)"
				icon={<XIcon size={17} />}
				onClick={onBack}
				className="hidden md:inline-flex"
			/>
		</div>
	);
}
