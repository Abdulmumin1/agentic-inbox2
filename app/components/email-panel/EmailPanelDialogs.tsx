// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button, Dialog } from "@cloudflare/kumo";
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { downloadFile } from "~/lib/utils";
import type { Email } from "~/types";

interface PreviewImage {
	url: string;
	filename: string;
}

interface EmailPanelDialogsProps {
	sourceViewEmail: Email | null;
	previewImage: PreviewImage | null;
	onCloseSource: () => void;
	onClosePreview: () => void;
}

function getSourceHeaders(msg: Email): { key: string; value: string }[] {
	if (msg.raw_headers) {
		try {
			const parsed = JSON.parse(msg.raw_headers);
			if (Array.isArray(parsed)) {
				return parsed.map((header) => ({
					key: header.key || header.name || "",
					value: String(header.value || ""),
				}));
			}
			if (typeof parsed === "object" && parsed !== null) {
				return Object.entries(parsed).map(([key, value]) => ({
					key,
					value: String(value),
				}));
			}
		} catch {
			// Fall through to field-based headers.
		}
	}

	const headers: { key: string; value: string }[] = [];
	if (msg.sender) headers.push({ key: "From", value: msg.sender });
	if (msg.recipient) headers.push({ key: "To", value: msg.recipient });
	if (msg.cc) headers.push({ key: "Cc", value: msg.cc });
	if (msg.bcc) headers.push({ key: "Bcc", value: msg.bcc });
	if (msg.subject) headers.push({ key: "Subject", value: msg.subject });
	if (msg.date) headers.push({ key: "Date", value: msg.date });
	if (msg.message_id) headers.push({ key: "Message-ID", value: msg.message_id });
	if (msg.in_reply_to) headers.push({ key: "In-Reply-To", value: msg.in_reply_to });
	if (msg.email_references) {
		headers.push({ key: "References", value: msg.email_references });
	}
	if (msg.thread_id) headers.push({ key: "X-Thread-ID", value: msg.thread_id });
	return headers;
}

export default function EmailPanelDialogs({
	sourceViewEmail,
	previewImage,
	onCloseSource,
	onClosePreview,
}: EmailPanelDialogsProps) {
	const sourceHeaders = sourceViewEmail ? getSourceHeaders(sourceViewEmail) : [];

	return (
		<>
			<Dialog.Root
				open={sourceViewEmail !== null}
				onOpenChange={(open) => {
					if (!open) onCloseSource();
				}}
			>
				<Dialog size="lg" className="p-6">
					<Dialog.Title className="text-base font-semibold">Message headers</Dialog.Title>
					{sourceViewEmail && (
						<Dialog.Description className="mt-0.5 truncate text-sm text-kumo-subtle">
							{sourceViewEmail.subject}
						</Dialog.Description>
					)}
					<div className="mt-4 max-h-[60vh] overflow-auto rounded-lg ring-1 ring-kumo-hairline">
						{sourceHeaders.length === 0 ? (
							<p className="py-8 text-center text-sm text-kumo-subtle">
								No header data available for this email.
							</p>
						) : (
							<dl className="divide-y divide-kumo-hairline font-mono text-xs">
								{sourceHeaders.map((header, idx) => (
									<div key={`${header.key}-${idx}`} className="grid grid-cols-[140px_1fr] gap-3 px-3 py-2">
										<dt className="truncate font-semibold text-kumo-default">{header.key}</dt>
										<dd className="break-all text-kumo-subtle">{header.value}</dd>
									</div>
								))}
							</dl>
						)}
					</div>
					<div className="mt-5 flex justify-end">
						<Dialog.Close render={(props) => <Button {...props} variant="secondary">Close</Button>} />
					</div>
				</Dialog>
			</Dialog.Root>

			<Dialog.Root
				open={previewImage !== null}
				onOpenChange={(open) => {
					if (!open) onClosePreview();
				}}
			>
				<Dialog size="xl" className="p-6">
					<Dialog.Title className="truncate text-base font-semibold">{previewImage?.filename}</Dialog.Title>
					{previewImage && (
						<div className="mt-4 flex min-h-[200px] items-center justify-center rounded-lg bg-kumo-recessed p-4">
							<img
								src={previewImage.url}
								alt={previewImage.filename}
								className="max-h-[65vh] max-w-full rounded object-contain"
							/>
						</div>
					)}
					<div className="mt-5 flex items-center justify-between">
						<Button
							variant="secondary"
							icon={<DownloadSimpleIcon size={16} />}
							onClick={() => {
								if (previewImage) downloadFile(previewImage.url, previewImage.filename);
							}}
						>
							Download
						</Button>
						<Dialog.Close render={(props) => <Button {...props} variant="primary">Done</Button>} />
					</div>
				</Dialog>
			</Dialog.Root>
		</>
	);
}
