import type { Metadata } from "next";

import { ToolPage } from "@/components/tool-page";
import { DecoderTool } from "@/components/tools/decoder/decoder-tool";
import { toolJsonLd, toolPageMetadata } from "@/lib/seo";

export const metadata: Metadata = toolPageMetadata("decoder");

const steps = [
  {
    title: "Paste a hash or calldata",
    body: "Drop in a transaction hash to fetch it from the chain, or paste raw calldata to decode on its own. The input's shape is detected automatically.",
  },
  {
    title: "We resolve the ABI",
    body: "The function is matched against the verified contract on Blockscout, then a local library of ERC-20/721/1155 signatures, then the openchain.xyz 4-byte database.",
  },
  {
    title: "Read the decoded call",
    body: "See the function, its named arguments, the ETH moved, and every event log turned from hex into plain, human-readable values.",
  },
];

export default function DecoderPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toolJsonLd("decoder") }}
      />
      <ToolPage slug="decoder" steps={steps}>
        <DecoderTool />
      </ToolPage>
    </>
  );
}
