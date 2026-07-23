import type { Metadata } from "next";

import { ToolPage } from "@/components/tool-page";
import { VanityTool } from "@/components/tools/vanity/vanity-tool";
import { toolJsonLd, toolPageMetadata } from "@/lib/seo";

export const metadata: Metadata = toolPageMetadata("vanity");

const steps = [
  {
    title: "Choose your pattern",
    body: "Pick the hex characters your address should start and/or end with. Matching is case-insensitive, and longer patterns take exponentially longer to find.",
  },
  {
    title: "Grind in your browser",
    body: "Web Workers search across your CPU cores, deriving random keypairs and checking each address. The entire search runs on your machine, with nothing sent to a server.",
  },
  {
    title: "Save the key safely",
    body: "When a match is found, reveal the private key, copy it or download the JSON, and store it in a secure wallet immediately. It is generated locally and can never be recovered if lost.",
  },
];

export default function VanityPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toolJsonLd("vanity") }}
      />
      <ToolPage slug="vanity" steps={steps}>
        <VanityTool />
      </ToolPage>
    </>
  );
}
