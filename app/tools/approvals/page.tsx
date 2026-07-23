import type { Metadata } from "next";

import { ToolPage } from "@/components/tool-page";
import { ApprovalsTool } from "@/components/tools/approvals/approvals-tool";
import { toolJsonLd, toolPageMetadata } from "@/lib/seo";

export const metadata: Metadata = toolPageMetadata("approvals");

const steps = [
  {
    title: "Connect",
    body: "Connect the wallet whose approvals you want to audit.",
  },
  {
    title: "Scan history",
    body: "The scan reads every ERC-20 Approval your wallet has emitted, directly from the chain.",
  },
  {
    title: "Review allowances",
    body: "See each live allowance, with unlimited approvals flagged and spender names where known.",
  },
  {
    title: "Revoke",
    body: "Set any allowance back to zero with a single transaction. You pay the gas.",
  },
];

export default function ApprovalsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toolJsonLd("approvals") }}
      />
      <ToolPage slug="approvals" steps={steps}>
        <ApprovalsTool />
      </ToolPage>
    </>
  );
}
