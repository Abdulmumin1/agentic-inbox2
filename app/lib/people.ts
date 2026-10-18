// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import type { Email } from "~/types";

export interface Person {
	name: string;
	email: string;
}

/** Extract the bare address from `Name <addr@x>` or `addr@x`. */
export function extractAddress(value: string): string {
	const match = value.match(/<([^>]+)>/);
	return (match ? match[1] : value).trim().toLowerCase();
}

/**
 * Turn `jane.doe@x.com` into `Jane Doe`. Used when we only have an address,
 * which is the case for every list row (the backend stores bare addresses).
 */
const GENERIC_LOCAL_PARTS = new Set([
	"noreply",
	"no-reply",
	"donotreply",
	"do-not-reply",
	"notifications",
	"notification",
	"receipts",
	"billing",
	"hello",
	"hi",
	"info",
	"support",
	"team",
	"mail",
	"mailer",
	"news",
	"newsletter",
	"updates",
	"contact",
	"admin",
]);

function capitalize(word: string): string {
	return word.charAt(0).toUpperCase() + word.slice(1);
}

export function nameFromAddress(address: string): string {
	const [local = address, domain = ""] = extractAddress(address).split("@");
	if (GENERIC_LOCAL_PARTS.has(local) && domain) {
		// "noreply@github.com" reads better as "Github" than "Noreply".
		const labels = domain.split(".");
		const brand = labels.length >= 2 ? labels[labels.length - 2] : labels[0];
		if (brand) return capitalize(brand);
	}
	const cleaned = local
		.replace(/\+.*$/, "")
		.replace(/[._-]+/g, " ")
		.replace(/\d+$/, "")
		.trim();
	if (!cleaned) return local;
	return cleaned.split(/\s+/).map(capitalize).join(" ");
}

/** Parse a single RFC 5322 mailbox like `"Jane Doe" <jane@x.com>`. */
export function parseMailbox(value: string): Person {
	const trimmed = value.trim();
	const match = trimmed.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
	if (match) {
		const email = match[2].trim().toLowerCase();
		const name = match[1].trim();
		return { email, name: name || nameFromAddress(email) };
	}
	return { email: trimmed.toLowerCase(), name: nameFromAddress(trimmed) };
}

type RawHeader = { key?: string; name?: string; value?: unknown };

function readHeader(email: Email, header: string): string | null {
	if (!email.raw_headers) return null;
	try {
		const parsed = JSON.parse(email.raw_headers) as RawHeader[] | Record<string, unknown>;
		if (Array.isArray(parsed)) {
			const found = parsed.find(
				(h) => (h.key || h.name || "").toLowerCase() === header,
			);
			return found?.value != null ? String(found.value) : null;
		}
		const entry = Object.entries(parsed).find(([k]) => k.toLowerCase() === header);
		return entry ? String(entry[1]) : null;
	} catch {
		return null;
	}
}

/**
 * Best-effort sender identity. Detail views carry `raw_headers`, which keep
 * the display name the sender actually used ("Misbahu Abdulkarim"), so prefer
 * it over a name guessed from the address.
 */
export function getSender(email: Email): Person {
	const from = readHeader(email, "from");
	if (from) {
		const parsed = parseMailbox(from);
		if (parsed.email.includes("@")) return parsed;
	}
	return { email: email.sender, name: nameFromAddress(email.sender) };
}

export function initials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "?";
	if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
	return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Short, human list of participants: "Amara, Tunde +2". */
export function formatParticipants(
	email: Pick<Email, "participants" | "sender">,
	selfAddress?: string,
): string {
	const self = selfAddress?.toLowerCase();
	const raw = email.participants
		? email.participants.split(",").map((p) => p.trim()).filter(Boolean)
		: [email.sender];
	const unique = Array.from(new Set(raw.map((p) => extractAddress(p))));
	const others = unique.filter((address) => address !== self);
	const list = others.length > 0 ? others : unique;
	const includesSelf = self ? unique.includes(self) && others.length > 0 : false;
	const names = list.map((address) =>
		list.length > 1 ? nameFromAddress(address).split(" ")[0] : nameFromAddress(address),
	);
	if (includesSelf) names.push("me");
	if (names.length <= 3) return names.join(", ");
	return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}
