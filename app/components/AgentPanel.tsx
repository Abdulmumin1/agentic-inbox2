// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button, cn, InputArea, Loader } from "@cloudflare/kumo";
import {
	ArrowBendUpLeftIcon,
	ArrowUpIcon,
	CheckIcon,
	EnvelopeSimpleIcon,
	EyeIcon,
	FolderSimpleIcon,
	MagnifyingGlassIcon,
	NotePencilIcon,
	PaperPlaneTiltIcon,
	PencilSimpleLineIcon,
	ShieldWarningIcon,
	SparkleIcon,
	StopIcon,
	TrashIcon,
	TrayIcon,
	WarningCircleIcon,
	WrenchIcon,
	XIcon,
} from "@phosphor-icons/react";
import type { UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Markdown from "react-markdown";
import { useNavigate, useParams } from "react-router";
import remarkGfm from "remark-gfm";
import { useConfirm } from "~/components/ui/useConfirm";
import { useUIStore } from "~/hooks/useUIStore";
import { parseAutoTrigger, stripAgentContext, withEmailContext } from "~/lib/agent-context";
import { nameFromAddress } from "~/lib/people";
import { useEmail } from "~/queries/emails";
import type { Email } from "~/types";

type MessagePart = UIMessage["parts"][number];

const TOOL_LABELS: Record<string, { running: string; done: string; icon: React.ElementType }> = {
	list_emails: { running: "Looking through emails", done: "Looked through emails", icon: TrayIcon },
	get_email: { running: "Reading email", done: "Read email", icon: EyeIcon },
	get_thread: { running: "Reading thread", done: "Read thread", icon: ArrowBendUpLeftIcon },
	search_emails: { running: "Searching", done: "Searched mail", icon: MagnifyingGlassIcon },
	draft_email: { running: "Writing draft", done: "Wrote draft", icon: NotePencilIcon },
	draft_reply: { running: "Drafting reply", done: "Drafted reply", icon: NotePencilIcon },
	discard_draft: { running: "Discarding draft", done: "Discarded draft", icon: TrashIcon },
	mark_email_read: { running: "Updating status", done: "Updated status", icon: CheckIcon },
	move_email: { running: "Moving email", done: "Moved email", icon: FolderSimpleIcon },
	send_email: { running: "Sending", done: "Sent", icon: PaperPlaneTiltIcon },
	send_reply: { running: "Sending reply", done: "Sent reply", icon: PaperPlaneTiltIcon },
};

function getToolName(part: MessagePart): string | null {
	if (part.type === "dynamic-tool") return (part as { toolName?: string }).toolName ?? null;
	if (part.type.startsWith("tool-")) return part.type.slice(5);
	return null;
}

function getToolState(part: MessagePart): string {
	return (part as { state?: string }).state ?? "input-available";
}

function getToolOutput(part: MessagePart): unknown {
	const p = part as { output?: unknown; result?: unknown };
	return p.output ?? p.result;
}

function ToolStep({ part }: { part: MessagePart }) {
	const name = getToolName(part) ?? "tool";
	const state = getToolState(part);
	const info = TOOL_LABELS[name];
	const Icon = info?.icon ?? WrenchIcon;
	const failed = state === "output-error";
	const done = state === "output-available" || state === "result" || failed;
	const label = info ? (done ? info.done : info.running) : name.replace(/_/g, " ");

	return (
		<div className="flex items-center gap-2 text-xs text-kumo-subtle">
			<span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-kumo-tint ring-1 ring-kumo-hairline">
				<Icon size={11} />
			</span>
			<span className={cn(!done && "text-kumo-default")}>{label}</span>
			{failed ? (
				<WarningCircleIcon size={13} className="text-kumo-danger" />
			) : done ? (
				<CheckIcon size={12} weight="bold" className="text-kumo-success" />
			) : (
				<Loader size={11} />
			)}
		</div>
	);
}

const markdownComponents = {
	a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
		<a href={href} target="_blank" rel="noopener noreferrer">
			{children}
		</a>
	),
};

function AssistantText({ text }: { text: string }) {
	const blocked = /blocked auto-draft/i.test(text);
	if (blocked) {
		return (
			<div className="flex gap-2.5 rounded-xl bg-kumo-warning-tint px-3 py-2.5 text-[13px] text-kumo-default">
				<ShieldWarningIcon size={16} className="mt-0.5 shrink-0 text-kumo-warning" />
				<span>{text.replace(/^⚠️\s*/, "")}</span>
			</div>
		);
	}
	return (
		<div className="agent-prose text-kumo-default">
			<Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
				{text}
			</Markdown>
		</div>
	);
}

function messageText(message: UIMessage): string {
	return message.parts
		.filter((p): p is Extract<MessagePart, { type: "text" }> => p.type === "text")
		.map((p) => p.text)
		.join("\n")
		.trim();
}

/**
 * The backend logs every auto-draft as a synthetic "[Auto-triggered]" user
 * message plus a one-line assistant reply. Shown raw, that reads like the
 * person talking to themselves, so the pair is rendered as one activity card.
 */
function NewEmailActivity({
	sender,
	subject,
	outcome,
	onOpenDrafts,
}: {
	sender: string;
	subject: string;
	outcome?: UIMessage;
	onOpenDrafts: () => void;
}) {
	const text = outcome ? messageText(outcome) : "";
	const drafted = /^created draft (reply )?to/i.test(text) || (outcome ? hasDraftTool(outcome) : false);
	const blocked = /blocked auto-draft/i.test(text);

	return (
		<div className="flex gap-2.5">
			<span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-kumo-tint text-kumo-subtle ring-1 ring-kumo-hairline">
				<EnvelopeSimpleIcon size={12} />
			</span>
			<div className="min-w-0 flex-1">
				<div className="truncate text-xs text-kumo-subtle">
					New email from <span className="font-medium text-kumo-default">{nameFromAddress(sender)}</span>
				</div>
				<div className="mt-0.5 truncate text-[13px] text-kumo-default">{subject}</div>
				{outcome && (
					<div className="mt-1.5 flex items-center gap-1.5 text-xs">
						{blocked ? (
							<>
								<ShieldWarningIcon size={13} className="shrink-0 text-kumo-warning" />
								<span className="text-kumo-subtle">Skipped: looked like a prompt injection</span>
							</>
						) : drafted ? (
							<>
								<CheckIcon size={12} weight="bold" className="shrink-0 text-kumo-success" />
								<span className="text-kumo-subtle">Drafted a reply</span>
								<span className="text-kumo-subtle">·</span>
								<button
									type="button"
									onClick={onOpenDrafts}
									className="font-medium text-kumo-link hover:underline"
								>
									Review
								</button>
							</>
						) : (
							<div className="min-w-0 flex-1">
								<AssistantText text={text} />
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

interface DraftResult {
	id?: string;
	to?: string;
	subject?: string;
	body?: string;
}

function findDraftResult(message: UIMessage): DraftResult | null {
	for (const part of message.parts) {
		if (getToolName(part) === "draft_reply" || getToolName(part) === "draft_email") {
			const output = getToolOutput(part);
			if (output && typeof output === "object") return output as DraftResult;
		}
	}
	return null;
}

function hasDraftTool(message: UIMessage): boolean {
	return message.parts.some((part) => {
		const name = getToolName(part);
		return name === "draft_reply" || name === "draft_email";
	});
}

function MessageView({
	message,
	isStreaming,
	onEditDraft,
	onOpenDrafts,
}: {
	message: UIMessage;
	isStreaming: boolean;
	onEditDraft: (draft: DraftResult) => void;
	onOpenDrafts: () => void;
}) {
	if (message.role === "user") {
		const text = messageText(message);
		return (
			<div className="flex justify-end">
				<div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-kumo-tint px-3.5 py-2 text-[13.5px] leading-relaxed text-kumo-default ring-1 ring-kumo-hairline">
					{stripAgentContext(text)}
				</div>
			</div>
		);
	}

	const draft = findDraftResult(message);
	const mentionsDraft =
		hasDraftTool(message) || /^created draft (reply )?to/i.test(messageText(message));

	return (
		<div className="flex flex-col gap-2.5">
			{message.parts.map((part, i) => {
				const key = `${message.id}-${i}`;
				if (part.type === "text") {
					if (!part.text.trim()) return null;
					return <AssistantText key={key} text={part.text} />;
				}
				if (getToolName(part)) return <ToolStep key={key} part={part} />;
				return null;
			})}
			{mentionsDraft && !isStreaming && (
				<div className="flex flex-wrap gap-1.5">
					{draft?.body ? (
						<Button
							size="sm"
							variant="secondary"
							className="h-7"
							icon={<PencilSimpleLineIcon size={13} />}
							onClick={() => onEditDraft(draft)}
						>
							Edit & send
						</Button>
					) : null}
					<Button size="sm" variant="ghost" className="h-7 text-kumo-link" onClick={onOpenDrafts}>
						Review in Drafts
					</Button>
				</div>
			)}
		</div>
	);
}

function ThinkingIndicator() {
	return (
		<div className="flex items-center gap-1.5 py-1" aria-label="Agent is thinking">
			{[0, 1, 2].map((i) => (
				<span
					key={i}
					className="size-1.5 animate-pulse rounded-full bg-kumo-subtle"
					style={{ animationDelay: `${i * 160}ms` }}
				/>
			))}
		</div>
	);
}

function AgentChatConnected({
	mailboxId,
	headerActions,
	useAgent,
	useAgentChat,
}: {
	mailboxId: string;
	headerActions: HTMLElement | null;
	useAgent: typeof import("agents/react").useAgent;
	useAgentChat: typeof import("@cloudflare/ai-chat/react").useAgentChat;
}) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const [inputValue, setInputValue] = useState("");
	const [includeContext, setIncludeContext] = useState(true);
	const navigate = useNavigate();
	const { confirm, dialog } = useConfirm();
	const { startCompose, selectedEmailId, pendingAgentPrompt, consumeAgentPrompt } = useUIStore();
	const { data: selectedEmail } = useEmail(mailboxId, selectedEmailId ?? undefined) as {
		data?: Email;
	};

	const agent = useAgent({ agent: "EmailAgent", name: mailboxId });
	const { messages, sendMessage, status, setMessages, stop } = useAgentChat({ agent });
	const isStreaming = status === "streaming" || status === "submitted";
	const contextEmail = includeContext && selectedEmailId ? selectedEmail : null;

	// Re-enable context whenever a different email is opened.
	useEffect(() => {
		setIncludeContext(true);
	}, [selectedEmailId]);

	// Stick to the bottom as messages stream in.
	useEffect(() => {
		const el = scrollRef.current;
		if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
	}, [messages, isStreaming]);

	// Run prompts queued from elsewhere in the UI ("Ask agent" menus).
	useEffect(() => {
		if (!pendingAgentPrompt || isStreaming) return;
		const prompt = consumeAgentPrompt();
		if (prompt) sendMessage({ text: prompt });
	}, [pendingAgentPrompt, isStreaming, consumeAgentPrompt, sendMessage]);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	const send = (text: string) => {
		const trimmed = text.trim();
		if (!trimmed || isStreaming) return;
		sendMessage({ text: withEmailContext(trimmed, contextEmail) });
	};

	const handleSubmit = () => {
		if (!inputValue.trim()) return;
		send(inputValue);
		setInputValue("");
	};

	const suggestions = useMemo(
		() =>
			selectedEmail
				? [
						"Summarize this email",
						"Draft a reply to this email",
						"What do I need to do here?",
					]
				: [
						"What needs my attention today?",
						"Any unread emails I should reply to?",
						"Find emails with attachments from this week",
					],
		[selectedEmail],
	);

	const clearChat = async () => {
		const ok = await confirm({
			title: "Start a new chat?",
			description: "This clears the conversation history with the agent for this mailbox.",
			confirmLabel: "Clear chat",
			destructive: true,
		});
		if (ok) setMessages([]);
	};

	const editDraft = (draft: DraftResult) => {
		startCompose({
			mode: "reply",
			originalEmail: null,
			draftEmail: {
				id: draft.id || "",
				subject: draft.subject || "",
				sender: mailboxId,
				recipient: draft.to || "",
				date: new Date().toISOString(),
				read: true,
				starred: false,
				body: draft.body || "",
			},
		});
	};

	const openDrafts = () => navigate(`/mailbox/${mailboxId}/emails/draft`);

	const renderItems = useMemo(() => {
		type Item =
			| { kind: "message"; key: string; message: UIMessage }
			| { kind: "activity"; key: string; sender: string; subject: string; outcome?: UIMessage };
		const items: Item[] = [];
		for (let i = 0; i < messages.length; i++) {
			const msg = messages[i];
			const event = msg.role === "user" ? parseAutoTrigger(messageText(msg)) : null;
			if (event) {
				const next = messages[i + 1];
				const outcome = next?.role === "assistant" ? next : undefined;
				items.push({ kind: "activity", key: msg.id, ...event, outcome });
				if (outcome) i++;
				continue;
			}
			items.push({ kind: "message", key: msg.id, message: msg });
		}
		return items;
	}, [messages]);

	const lastMessage = messages.at(-1);
	const showThinking =
		isStreaming &&
		(!lastMessage ||
			lastMessage.role === "user" ||
			!lastMessage.parts.some((p) => p.type === "text" && p.text.trim()));

	return (
		<div className="flex h-full min-h-0 flex-col">
			{headerActions &&
				messages.length > 0 &&
				createPortal(
					<Button
						variant="ghost"
						shape="square"
						size="sm"
						className="size-8 text-kumo-subtle"
						title="New chat"
						icon={<NotePencilIcon size={16} />}
						onClick={clearChat}
					/>,
					headerActions,
				)}

			<div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
				{messages.length === 0 ? (
					<div className="flex min-h-full flex-col justify-end px-4 pt-10 pb-4">
						<div className="mb-6">
							<div className="mb-3 flex size-10 items-center justify-center rounded-xl ai-mark">
								<SparkleIcon size={20} weight="fill" />
							</div>
							<h3 className="text-base font-semibold tracking-tight text-kumo-strong">
								How can I help?
							</h3>
							<p className="mt-1 text-[13px] leading-relaxed text-kumo-subtle">
								I can read and search your mail, summarize threads and draft replies. Nothing is sent
								without your say-so.
							</p>
						</div>
						<div className="flex flex-col gap-1.5">
							{suggestions.map((prompt) => (
								<button
									key={prompt}
									type="button"
									onClick={() => send(prompt)}
									className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-kumo-default ring-1 ring-kumo-hairline transition-colors hover:bg-kumo-tint hover:ring-kumo-line"
								>
									<SparkleIcon size={12} className="shrink-0 text-kumo-subtle" />
									{prompt}
								</button>
							))}
						</div>
					</div>
				) : (
					<div className="flex flex-col gap-5 px-4 py-5">
						{renderItems.map((item) =>
							item.kind === "activity" ? (
								<NewEmailActivity
									key={item.key}
									sender={item.sender}
									subject={item.subject}
									outcome={item.outcome}
									onOpenDrafts={openDrafts}
								/>
							) : (
								<MessageView
									key={item.key}
									message={item.message}
									isStreaming={isStreaming}
									onEditDraft={editDraft}
									onOpenDrafts={openDrafts}
								/>
							),
						)}
						{showThinking && <ThinkingIndicator />}
					</div>
				)}
			</div>

			<div className="shrink-0 px-3 pb-3">
				<form
					onSubmit={(e) => {
						e.preventDefault();
						handleSubmit();
					}}
					className="rounded-xl bg-kumo-base shadow-xs ring-1 ring-kumo-line transition-shadow focus-within:ring-kumo-focus/40"
				>
					{contextEmail && (
						<div className="flex items-center gap-1.5 px-2.5 pt-2">
							<span className="flex min-w-0 items-center gap-1.5 rounded-md bg-kumo-tint py-0.5 pr-1 pl-1.5 text-[11px] text-kumo-subtle ring-1 ring-kumo-hairline">
								<EnvelopeSimpleIcon size={11} className="shrink-0" />
								<span className="truncate">{contextEmail.subject || "(no subject)"}</span>
								<button
									type="button"
									onClick={() => setIncludeContext(false)}
									className="rounded p-0.5 hover:bg-kumo-fill hover:text-kumo-default"
									aria-label="Don't include this email"
								>
									<XIcon size={9} weight="bold" />
								</button>
							</span>
						</div>
					)}
					<InputArea
						ref={inputRef}
						aria-label="Message the agent"
						placeholder={contextEmail ? "Ask about this email…" : "Ask about your inbox…"}
						value={inputValue}
						onValueChange={setInputValue}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
								e.preventDefault();
								handleSubmit();
							}
						}}
						autoResize
						minRows={1}
						maxRows={8}
						className="w-full resize-none rounded-none bg-transparent px-3 pt-2.5 pb-1 text-[13.5px] shadow-none ring-0! focus:ring-0!"
					/>
					<div className="flex items-center justify-between px-2 pb-2">
						<span className="px-1 text-[11px] text-kumo-subtle">
							{isStreaming ? "Working…" : "↵ to send · ⇧↵ new line"}
						</span>
						{isStreaming ? (
							<Button
								type="button"
								variant="secondary"
								shape="square"
								size="sm"
								className="size-7"
								title="Stop"
								icon={<StopIcon size={12} weight="fill" />}
								onClick={() => stop()}
							/>
						) : (
							<Button
								type="submit"
								variant="primary"
								shape="square"
								size="sm"
								className="size-7"
								aria-label="Send"
								disabled={!inputValue.trim()}
								icon={<ArrowUpIcon size={13} weight="bold" />}
							/>
						)}
					</div>
				</form>
			</div>
			{dialog}
		</div>
	);
}

export default function AgentPanel({ headerActions }: { headerActions: HTMLElement | null }) {
	const { mailboxId } = useParams<{ mailboxId: string }>();
	const [hooks, setHooks] = useState<{
		useAgent: typeof import("agents/react").useAgent;
		useAgentChat: typeof import("@cloudflare/ai-chat/react").useAgentChat;
	} | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);

	useEffect(() => {
		Promise.all([import("agents/react"), import("@cloudflare/ai-chat/react")])
			.then(([a, c]) => setHooks({ useAgent: a.useAgent, useAgentChat: c.useAgentChat }))
			.catch((err) => {
				console.error("Failed to load agent modules:", err);
				setLoadError("Couldn't connect to the agent. Reload to try again.");
			});
	}, []);

	if (loadError) {
		return (
			<div className="flex h-full items-center justify-center px-6 text-center">
				<span className="text-[13px] text-kumo-danger">{loadError}</span>
			</div>
		);
	}

	if (!hooks) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-2">
				<Loader size="sm" />
				<span className="text-xs text-kumo-subtle">Connecting…</span>
			</div>
		);
	}

	return (
		<AgentChatConnected
			// Reconnect cleanly when switching mailboxes.
			key={mailboxId}
			mailboxId={mailboxId ?? "default"}
			headerActions={headerActions}
			useAgent={hooks.useAgent}
			useAgentChat={hooks.useAgentChat}
		/>
	);
}
