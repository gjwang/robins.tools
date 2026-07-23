import type { Metadata } from "next";

import { ToolPage } from "@/components/tool-page";
import { AddressUtilsTool } from "@/components/tools/address-utils/address-utils-tool";
import { toolJsonLd, toolPageMetadata } from "@/lib/seo";

export const metadata: Metadata = toolPageMetadata("address-utils");

const steps = [
  {
    title: "Paste or upload",
    body: "Drop addresses into the textarea or upload a .csv/.txt file, one per line, optionally with an amount.",
  },
  {
    title: "Review issues",
    body: "Invalid rows and duplicates are flagged with the exact line and reason, so you can fix the source file if needed.",
  },
  {
    title: "Export the clean list",
    body: "Download the deduped, checksummed result as CSV, JSON, or plain text. This tool never makes a network request.",
  },
];

export default function AddressUtilsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toolJsonLd("address-utils") }}
      />
      <ToolPage slug="address-utils" steps={steps}>
        <AddressUtilsTool />
      </ToolPage>
    </>
  );
}
