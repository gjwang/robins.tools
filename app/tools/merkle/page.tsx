import type { Metadata } from "next";

import { MerkleGenerator } from "@/components/tools/merkle/merkle-generator";
import { ToolPage } from "@/components/tool-page";
import { toolJsonLd, toolPageMetadata } from "@/lib/seo";

export const metadata: Metadata = toolPageMetadata("merkle");

const steps = [
  {
    title: "Paste your list",
    body: "Add one address per line, or address,amount for a weighted airdrop. Upload a .csv/.txt if you have a file.",
  },
  {
    title: "Generate the tree",
    body: "The merkle root and a proof for every entry are computed entirely in your browser, with no network requests.",
  },
  {
    title: "Copy the root, export proofs",
    body: "Copy the root for your contract, then download the full tree and per-address claims JSON to distribute proofs.",
  },
];

export default function MerklePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toolJsonLd("merkle") }}
      />
      <ToolPage slug="merkle" steps={steps}>
        <MerkleGenerator />
      </ToolPage>
    </>
  );
}
