// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

/**
 * Gmail-style trimming of quoted history. Replies carry the whole previous
 * conversation; we keep it, but fold it behind a "•••" toggle so each message
 * shows only what is new. Client-only: relies on DOMParser.
 */

// Containers mail clients wrap quoted history in.
const QUOTE_SELECTORS = [
	".gmail_quote_container",
	".gmail_quote",
	"blockquote[type='cite']",
	"#appendonsend",
	"#divRplyFwdMsg",
	".yahoo_quoted",
	".protonmail_quote",
	"#mail-editor-reference-message-container",
	".moz-cite-prefix",
];

// "On Tue, Apr 15, 2026, Jane <jane@x.com> wrote:" and friends.
const ATTRIBUTION =
	/^\s*(?:On\b[\s\S]{0,400}\bwrote:|Le\b[\s\S]{0,300}a écrit\s*:|Am\b[\s\S]{0,300}schrieb[\s\S]{0,200}:|El\b[\s\S]{0,300}escribió:|-{2,}\s*Original Message\s*-{2,})\s*$/i;

function textOf(node: Node): string {
	return (node.textContent || "").replace(/\u00a0/g, " ").trim();
}

function isBlank(node: Node): boolean {
	if (node.nodeType === Node.TEXT_NODE) return !textOf(node);
	if (node.nodeType !== Node.ELEMENT_NODE) return true;
	const el = node as Element;
	if (el.tagName === "BR") return true;
	if (el.querySelector("img, table, video")) return false;
	return !textOf(el);
}

/** Does anything meaningful come before `node` in the document? */
function hasContentBefore(node: Node, root: Element): boolean {
	let current: Node | null = node;
	while (current && current !== root) {
		let sibling = current.previousSibling;
		while (sibling) {
			if (!isBlank(sibling)) {
				// An attribution line on its own doesn't count as new content.
				if (!ATTRIBUTION.test(textOf(sibling))) return true;
			}
			sibling = sibling.previousSibling;
		}
		current = current.parentNode;
	}
	return false;
}

/** Does anything meaningful come after `node` (outside it)? */
function hasContentAfter(node: Node, root: Element): boolean {
	let current: Node | null = node;
	while (current && current !== root) {
		let sibling = current.nextSibling;
		while (sibling) {
			if (!isBlank(sibling)) return true;
			sibling = sibling.nextSibling;
		}
		current = current.parentNode;
	}
	return false;
}

/** Include a preceding "On … wrote:" line (and blank lines) in the fold. */
function extendToAttribution(start: Node): Node {
	let result = start;
	let sibling = start.previousSibling;
	while (sibling) {
		if (isBlank(sibling)) {
			sibling = sibling.previousSibling;
			continue;
		}
		if (ATTRIBUTION.test(textOf(sibling))) result = sibling;
		break;
	}
	return result;
}

function findQuoteStart(root: Element, requireContentBefore = true): Node | null {
	const hasLead = (node: Node) => !requireContentBefore || hasContentBefore(node, root);
	for (const selector of QUOTE_SELECTORS) {
		const match = root.querySelector(selector);
		// Forwarded messages are the content, not history: never fold them.
		if (match && /forwarded message/i.test(textOf(match).slice(0, 200))) continue;
		if (match && hasLead(match)) {
			return extendToAttribution(match);
		}
	}

	// A trailing top-level-ish <blockquote> (our own replies, most webmail).
	const quotes = Array.from(root.querySelectorAll("blockquote")).filter(
		(q) => !q.parentElement?.closest("blockquote"),
	);
	for (const quote of quotes.reverse()) {
		if (!hasContentAfter(quote, root) && hasLead(quote)) {
			return extendToAttribution(quote);
		}
	}

	// An attribution line followed only by quoted material.
	const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
	let el = walker.nextNode() as Element | null;
	while (el) {
		if (
			el.children.length === 0 &&
			ATTRIBUTION.test(textOf(el)) &&
			hasLead(el)
		) {
			return el;
		}
		el = walker.nextNode() as Element | null;
	}
	return null;
}

function markQuoted(node: Node, doc: Document) {
	if (node.nodeType === Node.ELEMENT_NODE) {
		(node as Element).setAttribute("data-quoted", "");
	} else if (node.nodeType === Node.TEXT_NODE && textOf(node)) {
		const span = doc.createElement("span");
		span.setAttribute("data-quoted", "");
		node.parentNode?.insertBefore(span, node);
		span.appendChild(node);
	}
}

/** Hide `start` and everything after it, at every level up to `root`. */
function hideFrom(start: Node, root: Element, doc: Document) {
	let node: Node | null = start;
	while (node && node !== root) {
		let sibling: Node | null = node;
		while (sibling) {
			const next: Node | null = sibling.nextSibling;
			markQuoted(sibling, doc);
			sibling = next;
		}
		let parent: Node | null = node.parentNode;
		node = null;
		while (parent && parent !== root) {
			if (parent.nextSibling) {
				node = parent.nextSibling;
				break;
			}
			parent = parent.parentNode;
		}
	}
}

export const QUOTE_TOGGLE_CLASS = "quote-toggle";

/**
 * Returns sanitized email HTML with quoted history marked `data-quoted` and a
 * "•••" toggle inserted in front of it. The iframe hides marked nodes until
 * the toggle is pressed.
 */
export function foldQuotedHtml(html: string): { html: string; folded: boolean } {
	if (typeof DOMParser === "undefined" || !html) return { html, folded: false };
	const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
	const root = doc.body;
	const start = findQuoteStart(root);
	if (!start) return { html, folded: false };

	const toggle = doc.createElement("button");
	toggle.type = "button";
	toggle.className = QUOTE_TOGGLE_CLASS;
	toggle.setAttribute("aria-label", "Show trimmed content");
	toggle.setAttribute("title", "Show trimmed content");
	toggle.setAttribute("aria-expanded", "false");
	toggle.textContent = "•••";

	hideFrom(start, root, doc);
	// A text-node start was wrapped in a span by hideFrom; anchor on that.
	const anchor = start.nodeType === Node.TEXT_NODE ? start.parentNode : start;
	anchor?.parentNode?.insertBefore(toggle, anchor);
	return { html: root.innerHTML, folded: true };
}

/**
 * For the composer: split a trailing, top-level quoted block off the body so
 * the editor shows only the new message. Returns the original HTML as `main`
 * when the quote isn't cleanly separable.
 */
export function splitQuotedHtml(html: string): { main: string; quoted: string } {
	if (typeof DOMParser === "undefined" || !html) return { main: html, quoted: "" };
	const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
	const root = doc.body;
	// In the composer the quote is folded even when nothing has been written yet.
	const start = findQuoteStart(root, false);
	if (!start || start.parentNode !== root) return { main: html, quoted: "" };

	// Keep a couple of line breaks with the quote rather than the reply.
	let first: Node = start;
	while (first.previousSibling && isBlank(first.previousSibling)) {
		first = first.previousSibling;
	}

	const quotedParts: string[] = [];
	let node: Node | null = first;
	while (node) {
		const next: Node | null = node.nextSibling;
		quotedParts.push(
			node.nodeType === Node.ELEMENT_NODE
				? (node as Element).outerHTML
				: (node.textContent ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;"),
		);
		root.removeChild(node);
		node = next;
	}
	return { main: root.innerHTML, quoted: quotedParts.join("") };
}

/**
 * Plain-text bodies: split at "On … wrote:" or a trailing run of "> " lines.
 */
export function splitQuotedText(text: string): { main: string; quoted: string } {
	const lines = text.split(/\r?\n/);
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i];
		const isAttribution = ATTRIBUTION.test(line) || /^On .+ wrote:\s*$/.test(line);
		const isQuoteStart = /^\s*>/.test(line) && lines.slice(i).every((l) => !l.trim() || /^\s*>/.test(l));
		if (isAttribution || isQuoteStart) {
			const main = lines.slice(0, i).join("\n").trimEnd();
			if (!main.trim()) return { main: text, quoted: "" };
			return { main, quoted: lines.slice(i).join("\n") };
		}
	}
	return { main: text, quoted: "" };
}
