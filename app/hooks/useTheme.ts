// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { useCallback, useEffect, useSyncExternalStore } from "react";

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "agentic-inbox:theme";
const EVENT = "agentic-inbox:theme-change";

/**
 * Inlined into <head> so the right `data-mode` is set before first paint.
 * Kumo switches every semantic token on `[data-mode="dark"]`.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var p=localStorage.getItem("${STORAGE_KEY}")||"system";var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-mode",d?"dark":"light");document.documentElement.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

function readPreference(): ThemePreference {
	if (typeof window === "undefined") return "system";
	const stored = window.localStorage.getItem(STORAGE_KEY);
	return stored === "light" || stored === "dark" ? stored : "system";
}

function applyPreference(preference: ThemePreference) {
	const isDark =
		preference === "dark" ||
		(preference === "system" &&
			window.matchMedia("(prefers-color-scheme: dark)").matches);
	const root = document.documentElement;
	root.setAttribute("data-mode", isDark ? "dark" : "light");
	root.style.colorScheme = isDark ? "dark" : "light";
}

function subscribe(callback: () => void) {
	window.addEventListener(EVENT, callback);
	window.addEventListener("storage", callback);
	return () => {
		window.removeEventListener(EVENT, callback);
		window.removeEventListener("storage", callback);
	};
}

export function useTheme() {
	const preference = useSyncExternalStore(
		subscribe,
		readPreference,
		() => "system" as ThemePreference,
	);

	// Follow the OS setting live while the preference is "system".
	useEffect(() => {
		applyPreference(preference);
		if (preference !== "system") return;
		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = () => applyPreference("system");
		media.addEventListener("change", onChange);
		return () => media.removeEventListener("change", onChange);
	}, [preference]);

	const setPreference = useCallback((next: ThemePreference) => {
		if (next === "system") window.localStorage.removeItem(STORAGE_KEY);
		else window.localStorage.setItem(STORAGE_KEY, next);
		applyPreference(next);
		window.dispatchEvent(new Event(EVENT));
	}, []);

	return { preference, setPreference };
}
