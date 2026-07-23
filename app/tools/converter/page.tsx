import type { Metadata } from "next";

import { ToolPage } from "@/components/tool-page";
import { ConverterTool } from "@/components/tools/converter/converter-tool";
import { toolJsonLd, toolPageMetadata } from "@/lib/seo";

export const metadata: Metadata = toolPageMetadata("converter");

const steps = [
  {
    title: "Pick a tab",
    body: "Units, Hex ↔ Decimal, Keccak-256, or Checksum. Each converts as you type.",
  },
  {
    title: "Type in any linked field",
    body: "The other fields update instantly using exact bigint math; invalid input is flagged without guessing.",
  },
  {
    title: "Copy the result",
    body: "Every output field has a one-click copy button.",
  },
  {
    title: "Nothing leaves your browser",
    body: "This tool never makes a network request. All conversion runs in your browser.",
  },
];

export default function ConverterPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toolJsonLd("converter") }}
      />
      <ToolPage slug="converter" steps={steps}>
        <ConverterTool />
      </ToolPage>
    </>
  );
}
