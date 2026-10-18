// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button, Dialog } from "@cloudflare/kumo";
import { useCallback, useRef, useState } from "react";

interface ConfirmOptions {
	title: string;
	description?: string;
	confirmLabel?: string;
	destructive?: boolean;
}

/**
 * Promise-based confirmation using Kumo's Dialog, replacing `window.confirm`.
 *
 * const { confirm, dialog } = useConfirm();
 * if (await confirm({ title: "Delete?" })) …
 * return <>{…}{dialog}</>;
 */
export function useConfirm() {
	const [options, setOptions] = useState<ConfirmOptions | null>(null);
	const resolver = useRef<((value: boolean) => void) | null>(null);

	const confirm = useCallback((next: ConfirmOptions) => {
		setOptions(next);
		return new Promise<boolean>((resolve) => {
			resolver.current = resolve;
		});
	}, []);

	const settle = (value: boolean) => {
		resolver.current?.(value);
		resolver.current = null;
		setOptions(null);
	};

	const dialog = (
		<Dialog.Root
			open={options !== null}
			onOpenChange={(open) => {
				if (!open) settle(false);
			}}
		>
			<Dialog size="sm" className="p-6">
				<Dialog.Title className="text-base font-semibold">{options?.title}</Dialog.Title>
				{options?.description && (
					<Dialog.Description className="mt-1.5 text-sm text-kumo-subtle">
						{options.description}
					</Dialog.Description>
				)}
				<div className="mt-6 flex justify-end gap-2">
					<Button variant="secondary" onClick={() => settle(false)}>
						Cancel
					</Button>
					<Button
						variant={options?.destructive ? "destructive" : "primary"}
						onClick={() => settle(true)}
						autoFocus
					>
						{options?.confirmLabel ?? "Confirm"}
					</Button>
				</div>
			</Dialog>
		</Dialog.Root>
	);

	return { confirm, dialog };
}
