// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { cn } from "@cloudflare/kumo";
import {
	FileIcon,
	FilePdfIcon,
	FileTextIcon,
	FileZipIcon,
	ImageIcon,
	PaperclipIcon,
} from "@phosphor-icons/react";
import { formatBytes, getAttachmentUrl, getNonInlineAttachments } from "~/lib/utils";
import type { Attachment } from "~/types";

interface EmailAttachmentListProps {
	mailboxId?: string;
	emailId: string;
	attachments?: Attachment[];
	onPreviewImage?: (url: string, filename: string) => void;
	className?: string;
}

function iconFor(mimetype?: string) {
	if (!mimetype) return FileIcon;
	if (mimetype.startsWith("image/")) return ImageIcon;
	if (mimetype === "application/pdf") return FilePdfIcon;
	if (mimetype.includes("zip") || mimetype.includes("compressed")) return FileZipIcon;
	if (mimetype.startsWith("text/")) return FileTextIcon;
	return FileIcon;
}

const cardClass =
	"group flex min-w-0 max-w-60 items-center gap-2.5 rounded-lg bg-kumo-base px-2.5 py-2 text-left no-underline ring-1 ring-kumo-hairline transition-colors hover:bg-kumo-tint hover:ring-kumo-line";

export default function EmailAttachmentList({
	mailboxId,
	emailId,
	attachments,
	onPreviewImage,
	className,
}: EmailAttachmentListProps) {
	if (!mailboxId) return null;

	const files = getNonInlineAttachments(attachments);
	if (files.length === 0) return null;

	return (
		<div className={className}>
			<div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-kumo-subtle">
				<PaperclipIcon size={13} />
				{files.length} attachment{files.length !== 1 ? "s" : ""}
			</div>
			<div className="flex flex-wrap gap-2">
				{files.map((attachment) => {
					const url = getAttachmentUrl(mailboxId, emailId, attachment.id);
					const isImage = attachment.mimetype?.startsWith("image/");
					const Icon = iconFor(attachment.mimetype);
					const content = (
						<>
							<span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-kumo-tint text-kumo-subtle ring-1 ring-kumo-hairline">
								<Icon size={16} />
							</span>
							<span className="min-w-0">
								<span className="block truncate text-[13px] font-medium text-kumo-default">
									{attachment.filename}
								</span>
								<span className="block text-xs text-kumo-subtle">{formatBytes(attachment.size)}</span>
							</span>
						</>
					);

					if (isImage && onPreviewImage) {
						return (
							<button
								key={attachment.id}
								type="button"
								onClick={() => onPreviewImage(url, attachment.filename)}
								className={cn(cardClass, "cursor-pointer")}
							>
								{content}
							</button>
						);
					}

					return (
						<a
							key={attachment.id}
							href={url}
							target="_blank"
							rel="noopener noreferrer"
							className={cardClass}
						>
							{content}
						</a>
					);
				})}
			</div>
		</div>
	);
}
