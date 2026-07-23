import type { Metadata } from "next";

import { ToolPage } from "@/components/tool-page";
import { BurnerTool } from "@/components/tools/burner/burner-tool";
import { toolJsonLd, toolPageMetadata } from "@/lib/seo";

export const metadata: Metadata = toolPageMetadata("burner");

const steps = [
  {
    title: "Pick a token",
    body: "Paste an ERC-20 address to load its name, symbol, and your balance.",
  },
  {
    title: "Choose an amount",
    body: "Enter how much to burn, or hit Max. You can't burn more than you hold.",
  },
  {
    title: "Confirm twice",
    body: "Type the token symbol and tick the acknowledgement. Burning is irreversible.",
  },
  {
    title: "Burn",
    body: "Sign the transaction from your wallet. You pay the gas; the tokens are gone for good.",
  },
];

export default function BurnerPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toolJsonLd("burner") }}
      />
      <ToolPage slug="burner" steps={steps}>
        <BurnerTool />
      </ToolPage>
    </>
  );
}
