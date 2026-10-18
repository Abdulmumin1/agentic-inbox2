// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import type { Email } from "~/types";
import { getSender } from "./people";

/**
 * The agent only sees message text, so when the person is looking at an email
 * we append a machine-readable reference to it. The chat UI strips the block
 * back out so the bubble shows only what the person typed.
 */
const CONTEXT_PATTERN = /\s*<context>[\s\S]*?<\/context>\s*$/;

export function describeEmailForAgent(email: Email): string {
	const sender = getSender(email);
	const ids = [`email ID: ${email.id}`];
	if (email.thread_id) ids.push(`thread ID: ${email.thread_id}`);
	return `The user is currently viewing the email "${email.subject || "(no subject)"}" from ${sender.name} <${sender.email}> (${ids.join(", ")}). Treat "this email", "this thread" or "this conversation" as referring to it.`;
}

export function withEmailContext(text: string, email?: Email | null): string {
	if (!email) return text;
	return `${text}\n\n<context>${describeEmailForAgent(email)}</context>`;
}

export function stripAgentContext(text: string): string {
	return text.replace(CONTEXT_PATTERN, "");
}

const AUTO_TRIGGER_PATTERN = /^\[Auto-triggered\] New email from (.+?): "([\s\S]*)"$/;

/** Parse the synthetic message the backend logs when a new email arrives. */
export function parseAutoTrigger(text: string): { sender: string; subject: string } | null {
	const match = text.trim().match(AUTO_TRIGGER_PATTERN);
	if (!match) return null;
	return { sender: match[1], subject: match[2] };
}
