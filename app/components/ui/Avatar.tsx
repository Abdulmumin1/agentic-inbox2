// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { cn } from "@cloudflare/kumo";
import { initials } from "~/lib/people";

// Kumo's badge palette gives us theme-aware hues without raw Tailwind colours.
const PALETTE = [
	"bg-kumo-badge-blue",
	"bg-kumo-badge-purple",
	"bg-kumo-badge-teal",
	"bg-kumo-badge-orange",
	"bg-kumo-badge-green",
	"bg-kumo-badge-red",
] as const;

function hash(value: string): number {
	let h = 0;
	for (let i = 0; i < value.length; i++) {
		h = (h * 31 + value.charCodeAt(i)) | 0;
	}
	return Math.abs(h);
}

const SIZES = {
	xs: "size-5 text-[9px]",
	sm: "size-7 text-[11px]",
	md: "size-8 text-xs",
	lg: "size-10 text-sm",
} as const;

interface AvatarProps {
	name: string;
	/** Stable seed for the colour; defaults to the name. */
	seed?: string;
	size?: keyof typeof SIZES;
	className?: string;
}

export default function Avatar({ name, seed, size = "md", className }: AvatarProps) {
	const color = PALETTE[hash((seed || name).toLowerCase()) % PALETTE.length];
	return (
		<span
			aria-hidden="true"
			className={cn(
				"inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold tracking-tight text-white",
				color,
				SIZES[size],
				className,
			)}
		>
			{initials(name)}
		</span>
	);
}
