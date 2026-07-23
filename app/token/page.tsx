import type { Metadata } from "next";
import { getAddress, isAddress } from "viem";

import { TokenPage } from "@/components/token/token-page";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "$TOOLS token",
  description:
    "$TOOLS is the community token of robins.tools. The contract address is published on this page.",
  path: "/token",
});

// The only input is an env var. It is read at render time and validated
// case-tolerantly; an empty or malformed value is treated as unset, which keeps
// the page in its "launching soon" state until a real address is configured.
function resolveTokenAddress(): string | null {
  const raw = process.env.NEXT_PUBLIC_TOOLS_TOKEN_ADDRESS?.trim();
  if (!raw || !isAddress(raw, { strict: false })) return null;
  return getAddress(raw);
}

export default function Page() {
  return <TokenPage address={resolveTokenAddress()} />;
}
