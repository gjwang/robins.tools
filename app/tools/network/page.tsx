import type { Metadata } from "next";

import { NetworkTracker } from "@/components/tools/network/network-tracker";
import { ToolPage } from "@/components/tool-page";
import { toolJsonLd, toolPageMetadata } from "@/lib/seo";

export const metadata: Metadata = toolPageMetadata("network");

const steps = [
  {
    title: "Open the page",
    body: "The dashboard starts polling immediately. The only network calls go to the chain RPC, with no backend in between.",
  },
  {
    title: "Watch live gas & blocks",
    body: "Gas price, the latest block, average block time, and the ten most recent blocks refresh every few seconds. New blocks slide in as they arrive.",
  },
  {
    title: "Check RPC health",
    body: "The status dot reads the round-trip latency of each poll: green is healthy, amber is slow, red means the RPC is unreachable or stale. Pause any time.",
  },
];

export default function NetworkPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toolJsonLd("network") }}
      />
      <ToolPage slug="network" steps={steps}>
        <NetworkTracker />
      </ToolPage>
    </>
  );
}
