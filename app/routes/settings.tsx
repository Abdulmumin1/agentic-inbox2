// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Badge, Button, Input, InputArea, Loader, Tabs, useKumoToastManager } from "@cloudflare/kumo";
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { MobileNavButton } from "~/components/MailboxSplitView";
import { type ThemePreference, useTheme } from "~/hooks/useTheme";
import { useMailbox, useUpdateMailbox } from "~/queries/mailboxes";

// Placeholder shown in the textarea when no custom prompt is set.
// The authoritative default prompt lives in workers/agent/index.ts (DEFAULT_SYSTEM_PROMPT).
const PROMPT_PLACEHOLDER = `You are an email assistant that helps manage this inbox. You read emails, draft replies, and help organize conversations.

Write like a real person. Short, direct, flowing prose. Plain text only.

(Leave empty to use the full built-in default prompt)`;

const SHORTCUTS: { keys: string[]; label: string }[] = [
	{ keys: ["c"], label: "Compose" },
	{ keys: ["/"], label: "Search" },
	{ keys: ["j"], label: "Next conversation" },
	{ keys: ["k"], label: "Previous conversation" },
	{ keys: ["r"], label: "Reply" },
	{ keys: ["e"], label: "Archive" },
	{ keys: ["#"], label: "Move to trash" },
	{ keys: ["Esc"], label: "Close conversation" },
	{ keys: ["⌘", "J"], label: "Toggle agent" },
	{ keys: ["⌘", "↵"], label: "Send message" },
];

function Section({
	title,
	description,
	aside,
	children,
}: {
	title: string;
	description: ReactNode;
	aside?: ReactNode;
	children: ReactNode;
}) {
	return (
		<section className="grid gap-4 border-b border-kumo-hairline py-8 last:border-b-0 md:grid-cols-[220px_1fr] md:gap-10">
			<div>
				<div className="flex items-center gap-2">
					<h2 className="text-sm font-semibold text-kumo-strong">{title}</h2>
					{aside}
				</div>
				<p className="mt-1 text-[13px] leading-relaxed text-kumo-subtle">{description}</p>
			</div>
			<div className="min-w-0">{children}</div>
		</section>
	);
}

export default function SettingsRoute() {
	const { mailboxId } = useParams<{ mailboxId: string }>();
	const toastManager = useKumoToastManager();
	const { data: mailbox } = useMailbox(mailboxId);
	const updateMailboxMutation = useUpdateMailbox();
	const { preference, setPreference } = useTheme();

	const [displayName, setDisplayName] = useState("");
	const [agentPrompt, setAgentPrompt] = useState("");
	const [isSaving, setIsSaving] = useState(false);

	const initialName = mailbox?.settings?.fromName || mailbox?.name || "";
	const initialPrompt = mailbox?.settings?.agentSystemPrompt || "";

	useEffect(() => {
		if (mailbox) {
			setDisplayName(initialName);
			setAgentPrompt(initialPrompt);
		}
	}, [mailbox, initialName, initialPrompt]);

	const isDirty = useMemo(
		() => displayName !== initialName || agentPrompt.trim() !== initialPrompt.trim(),
		[displayName, agentPrompt, initialName, initialPrompt],
	);

	const handleSave = async () => {
		if (!mailbox || !mailboxId) return;
		setIsSaving(true);
		const settings = {
			...mailbox.settings,
			fromName: displayName,
			agentSystemPrompt: agentPrompt.trim() || undefined,
		};
		try {
			await updateMailboxMutation.mutateAsync({ mailboxId, settings });
			toastManager.add({ title: "Settings saved", variant: "success" });
		} catch {
			toastManager.add({ title: "Couldn't save settings", variant: "error" });
		} finally {
			setIsSaving(false);
		}
	};

	const isCustomPrompt = agentPrompt.trim().length > 0;

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex h-13 shrink-0 items-center gap-2 border-b border-kumo-hairline px-4">
				<MobileNavButton />
				<h1 className="text-[15px] font-semibold tracking-tight text-kumo-strong">Settings</h1>
			</div>

			{!mailbox ? (
				<div className="flex flex-1 items-center justify-center">
					<Loader />
				</div>
			) : (
				<>
					<div className="min-h-0 flex-1 overflow-y-auto">
						<div className="mx-auto max-w-4xl px-5 sm:px-8">
							<Section
								title="Profile"
								description="How you appear to the people you email."
							>
								<div className="grid max-w-md gap-4">
									<Input
										label="Display name"
										value={displayName}
										onChange={(e) => setDisplayName(e.target.value)}
										placeholder="Your name"
									/>
									<Input label="Email address" type="email" value={mailbox.email} disabled />
								</div>
							</Section>

							<Section
								title="Agent instructions"
								description="The system prompt the agent follows for this mailbox: tone, rules, what to draft and what to leave alone."
								aside={
									<Badge variant={isCustomPrompt ? "primary" : "secondary"}>
										{isCustomPrompt ? "Custom" : "Default"}
									</Badge>
								}
							>
								<InputArea
									aria-label="Agent system prompt"
									value={agentPrompt}
									onValueChange={setAgentPrompt}
									placeholder={PROMPT_PLACEHOLDER}
									rows={14}
									className="w-full resize-y font-mono text-xs leading-relaxed"
								/>
								<div className="mt-2 flex items-center justify-between gap-3">
									<p className="text-xs text-kumo-subtle">Leave empty to use the built-in prompt.</p>
									{isCustomPrompt && (
										<Button
											variant="ghost"
											size="sm"
											icon={<ArrowCounterClockwiseIcon size={13} />}
											onClick={() => setAgentPrompt("")}
										>
											Reset to default
										</Button>
									)}
								</div>
							</Section>

							<Section title="Appearance" description="Choose a theme, or follow your system.">
								<Tabs
									variant="segmented"
									className="w-fit"
									value={preference}
									onValueChange={(value) => setPreference(value as ThemePreference)}
									tabs={[
										{ value: "light", label: "Light" },
										{ value: "dark", label: "Dark" },
										{ value: "system", label: "System" },
									]}
								/>
							</Section>

							<Section title="Keyboard shortcuts" description="Move through your inbox without the mouse.">
								<dl className="grid max-w-md gap-x-6 gap-y-2.5 sm:grid-cols-2">
									{SHORTCUTS.map((shortcut) => (
										<div key={shortcut.label} className="flex items-center justify-between gap-3">
											<dt className="text-[13px] text-kumo-default">{shortcut.label}</dt>
											<dd className="flex gap-0.5">
												{shortcut.keys.map((key) => (
													<kbd
														key={key}
														className="min-w-5 rounded border border-kumo-line bg-kumo-base px-1 text-center font-sans text-[11px] leading-5 text-kumo-default"
													>
														{key}
													</kbd>
												))}
											</dd>
										</div>
									))}
								</dl>
							</Section>
						</div>
					</div>

					<div className="flex shrink-0 items-center justify-end gap-3 border-t border-kumo-hairline px-5 py-3 sm:px-8">
						<span className="text-xs text-kumo-subtle">
							{isDirty ? "You have unsaved changes" : "All changes saved"}
						</span>
						<Button
							variant="secondary"
							disabled={!isDirty || isSaving}
							onClick={() => {
								setDisplayName(initialName);
								setAgentPrompt(initialPrompt);
							}}
						>
							Discard
						</Button>
						<Button variant="primary" onClick={handleSave} loading={isSaving} disabled={!isDirty}>
							Save changes
						</Button>
					</div>
				</>
			)}
		</div>
	);
}
