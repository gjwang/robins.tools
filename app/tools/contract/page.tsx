import type { Metadata } from "next";

import { ToolPage } from "@/components/tool-page";
import { ContractInteractor } from "@/components/tools/contract/contract-interactor";
import { toolJsonLd, toolPageMetadata } from "@/lib/seo";

export const metadata: Metadata = toolPageMetadata("contract");

const steps = [
  {
    title: "Paste a contract address",
    body: "We fetch the verified ABI from Blockscout automatically. Not verified? Paste the ABI yourself.",
  },
  {
    title: "Browse read & write functions",
    body: "Every function gets a generated form, split into Read and Write. Search by name and expand the one you need.",
  },
  {
    title: "Query reads for free",
    body: "Read calls go straight to the RPC and cost nothing, with no wallet required. Nothing is proxied.",
  },
  {
    title: "Simulate & sign writes",
    body: "Writes are simulated first to surface any revert reason, then sent from your connected wallet.",
  },
];

export default function ContractPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toolJsonLd("contract") }}
      />
      <ToolPage slug="contract" steps={steps}>
        <ContractInteractor />
      </ToolPage>
    </>
  );
}
