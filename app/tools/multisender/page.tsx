import type { Metadata } from "next";

import { ToolPage } from "@/components/tool-page";
import { Multisender } from "@/components/tools/multisender/multisender";
import { toolJsonLd, toolPageMetadata } from "@/lib/seo";

export const metadata: Metadata = toolPageMetadata("multisender");

const steps = [
  {
    title: "Pick your token",
    body: "Send native ETH, or paste an ERC-20 address to load its name, symbol, and your balance.",
  },
  {
    title: "Import recipients",
    body: "Paste rows or upload a CSV, then choose how amounts are set: per row, fixed, split equally, or by weight.",
  },
  {
    title: "Review totals & fees",
    body: "Check the grand total, per-batch breakdown, your balance, and the estimated network fee before anything is signed.",
  },
  {
    title: "Sign each batch",
    body: "Approve once if needed, then sign each batch. You pay all gas and the app never holds your funds. Tokens go straight to recipients.",
  },
];

export default function MultisenderPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toolJsonLd("multisender") }}
      />
      <ToolPage slug="multisender" steps={steps}>
        <Multisender />
      </ToolPage>
    </>
  );
}
