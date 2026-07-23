import type { Metadata } from "next";

import { ToolsGrid } from "@/components/tools-grid";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Tools",
  description:
    "A privacy-first toolkit for Robinhood Chain. Every tool runs in your browser and talks directly to the public RPC.",
  path: "/tools",
});

export default function ToolsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="max-w-2xl space-y-3">
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          Tools
        </h1>
        <p className="text-muted-foreground">
          Everything runs in your browser and talks directly to the public RPC.
        </p>
      </header>
      <div className="mt-8">
        <ToolsGrid />
      </div>
    </div>
  );
}
