// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import DOMPurify from "dompurify";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { foldQuotedHtml, QUOTE_TOGGLE_CLASS, splitQuotedText } from "~/lib/quotes";
import { escapeHtml } from "~/lib/utils";

interface EmailIframeProps {
	body: string;
	/** When true, iframe auto-sizes to content height instead of filling parent */
	autoSize?: boolean;
	/** Fold quoted history behind a "•••" toggle, like Gmail. */
	trimQuotes?: boolean;
}

const HEIGHT_MESSAGE = "__emailIframeHeight";

/**
 * Reports the content height to the parent and wires up the "•••" toggle.
 * Runs inside the opaque-origin sandbox, so it can only postMessage.
 */
const FRAME_SCRIPT = `<script>
(function () {
	function report() {
		var b = document.body;
		var h = Math.ceil(Math.max(b.scrollHeight, b.offsetHeight, b.getBoundingClientRect().height));
		if (h > 0) parent.postMessage({ ${HEIGHT_MESSAGE}: true, height: h }, "*");
	}
	document.addEventListener("click", function (event) {
		var toggle = event.target && event.target.closest && event.target.closest(".${QUOTE_TOGGLE_CLASS}");
		if (!toggle) return;
		var open = document.body.classList.toggle("show-quoted");
		toggle.setAttribute("aria-expanded", open ? "true" : "false");
		toggle.setAttribute("title", open ? "Hide trimmed content" : "Show trimmed content");
		report();
	});
	report();
	window.addEventListener("load", report);
	if (typeof ResizeObserver !== "undefined") new ResizeObserver(report).observe(document.body);
	Array.prototype.forEach.call(document.images, function (img) { img.addEventListener("load", report); });
	setTimeout(report, 250);
})();
<\/script>`;

const FRAME_STYLES = `
* { box-sizing: border-box; }
html { background: #ffffff; color-scheme: light; }
body {
	font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
	font-size: 14px;
	line-height: 1.6;
	color: #1f2328;
	background: #ffffff;
	margin: 0;
	word-wrap: break-word;
	overflow-wrap: break-word;
}
body.auto { overflow-y: hidden; overflow-x: auto; display: flow-root; }
body.page { padding: 24px; }
[style*="position: fixed"], [style*="position:fixed"], [style*="position: absolute"], [style*="position:absolute"] {
	position: relative !important;
}
a { color: #2563eb; text-underline-offset: 2px; }
img { max-width: 100%; height: auto; }
blockquote { border-left: 2px solid #e5e7eb; padding-left: 1em; margin: 0.75em 0; color: #6b7280; }
pre { background: #f3f4f6; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 13px; }
table { border-collapse: collapse; max-width: 100%; }
td, th { padding: 4px 8px; }
p { margin: 0 0 0.75em; }
p:last-child { margin-bottom: 0; }
h1, h2, h3 { margin: 8px 0 4px; }
ul, ol { padding-left: 20px; margin: 4px 0; }
body:not(.show-quoted) [data-quoted] { display: none !important; }
.${QUOTE_TOGGLE_CLASS} {
	display: inline-flex; align-items: center; justify-content: center;
	height: 14px; padding: 0 7px; margin: 10px 0 2px;
	border: 0; border-radius: 999px; background: #eceef1; color: #5f6368;
	font: 700 10px/1 system-ui, sans-serif; letter-spacing: 1px; cursor: pointer;
}
.${QUOTE_TOGGLE_CLASS}:hover { background: #dfe1e5; color: #202124; }
.${QUOTE_TOGGLE_CLASS}:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
body.show-quoted .${QUOTE_TOGGLE_CLASS} { margin-bottom: 8px; }
`;

function buildDocument(body: string, autoSize: boolean, trimQuotes: boolean): string {
	// Plain-text messages: keep their line breaks and treat `<addr>` as text.
	const looksLikeHtml = /<(?:[a-z][a-z0-9]*)(?:\s[^>]*)?>/i.test(body);
	let source = body;
	if (!looksLikeHtml) {
		const { main, quoted } = trimQuotes ? splitQuotedText(body) : { main: body, quoted: "" };
		source = `<div style="white-space: pre-wrap">${escapeHtml(main)}</div>`;
		if (quoted) {
			source += `<blockquote type="cite" style="white-space: pre-wrap">${escapeHtml(quoted)}</blockquote>`;
		}
	}

	let clean = DOMPurify.sanitize(source, {
		USE_PROFILES: { html: true },
		FORBID_TAGS: ["style"],
		ADD_ATTR: ["target"],
		FORCE_BODY: true,
	});
	if (trimQuotes) clean = foldQuotedHtml(clean).html;

	return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: cid: https:; script-src 'unsafe-inline';">
<base target="_blank">
<style>${FRAME_STYLES}</style>
</head>
<body class="${autoSize ? "auto" : "page"}">${clean}${autoSize ? FRAME_SCRIPT : ""}</body>
</html>`;
}

/**
 * Renders email HTML inside a sandboxed iframe.
 *
 * Security model:
 * - DOMPurify sanitises the HTML before injection.
 * - The iframe sandbox does NOT include `allow-same-origin`, so even if
 *   DOMPurify has a bypass the attacker's code runs in an opaque origin
 *   with no access to the parent page's cookies, DOM, or API.
 * - Because the iframe is cross-origin we cannot read `contentDocument`
 *   for auto-sizing. Instead, the injected HTML includes a tiny inline
 *   script that posts its body height to the parent via `postMessage`.
 * - A strict CSP meta tag blocks external resource loads inside the
 *   iframe as a defense-in-depth layer.
 *
 * The document is passed as the `srcDoc` attribute at creation, so the frame
 * navigates once, straight to the email, instead of loading about:blank and
 * then being re-navigated (which left frames blank while switching emails).
 */
export default function EmailIframe({ body, autoSize, trimQuotes = true }: EmailIframeProps) {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const [height, setHeight] = useState<number | null>(null);

	const srcDoc = useMemo(
		() => (typeof window === "undefined" || !body ? "" : buildDocument(body, Boolean(autoSize), trimQuotes)),
		[body, autoSize, trimQuotes],
	);

	// Layout effect: the listener must exist before the frame can possibly load.
	useLayoutEffect(() => {
		if (!autoSize) return;
		const onMessage = (event: MessageEvent) => {
			// Only accept messages from our own iframe
			if (event.source !== iframeRef.current?.contentWindow) return;
			const data = event.data as { [HEIGHT_MESSAGE]?: boolean; height?: unknown } | null;
			if (data && typeof data === "object" && data[HEIGHT_MESSAGE] && typeof data.height === "number" && data.height > 0) {
				setHeight((prev) => (prev === data.height ? prev : (data.height as number)));
			}
		};
		window.addEventListener("message", onMessage);
		return () => window.removeEventListener("message", onMessage);
	}, [autoSize]);

	if (!srcDoc) return null;

	return (
		<iframe
			ref={iframeRef}
			srcDoc={srcDoc}
			className="block w-full border-0"
			style={autoSize ? { height: `${height ?? 40}px` } : { height: "100%" }}
			sandbox="allow-scripts allow-popups allow-top-navigation-by-user-activation"
			title="Email content"
		/>
	);
}
