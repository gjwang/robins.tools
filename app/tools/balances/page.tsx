import type { Metadata } from "next";

import { BalanceChecker } from "@/components/tools/balances/balance-checker";
import { ToolPage } from "@/components/tool-page";
import { toolJsonLd, toolPageMetadata } from "@/lib/seo";

export const metadata: Metadata = toolPageMetadata("balances");

const steps = [
  {
    title: "Paste or import addresses",
    body: "Paste one address per line, or upload a .csv/.txt list. Duplicates are removed and invalid rows are flagged. Up to 500 addresses.",
  },
  {
    title: "Add tokens (optional)",
    body: "Native ETH is always included. Add up to 5 ERC-20 tokens by contract address. The symbol and decimals are read on-chain.",
  },
  {
    title: "Fetch balances",
    body: "Every balance is read in batched multicalls against the chain RPC. Progress shows batch by batch; failed batches can be retried on their own.",
  },
  {
    title: "Sort & export",
    body: "Sort by any column, read the per-column totals, and export a full-precision CSV.",
  },
];

export default function BalancesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toolJsonLd("balances") }}
      />
      <ToolPage slug="balances" steps={steps}>
        <BalanceChecker />
      </ToolPage>
    </>
  );
}
