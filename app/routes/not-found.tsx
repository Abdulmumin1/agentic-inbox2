// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button, Empty } from "@cloudflare/kumo";
import { CompassIcon } from "@phosphor-icons/react";
import { useNavigate } from "react-router";

export default function NotFoundRoute() {
	const navigate = useNavigate();

	return (
		<div className="flex min-h-dvh items-center justify-center bg-kumo-recessed p-8">
			<Empty
				icon={<CompassIcon size={40} className="text-kumo-subtle" />}
				title="Page not found"
				description="The page you're looking for doesn't exist or has moved."
				contents={
					<Button variant="primary" onClick={() => navigate("/")}>
						Back to mailboxes
					</Button>
				}
			/>
		</div>
	);
}
