import type { Metadata } from "next";

import { ToolPage } from "@/components/tool-page";
import { TokenCreator } from "@/components/tools/token-creator/token-creator";
import { toolJsonLd, toolPageMetadata } from "@/lib/seo";

export const metadata: Metadata = toolPageMetadata("token-creator");

const steps = [
  {
    title: "Configure your token",
    body: "Set the name, symbol, decimals, and initial supply, and choose whether it can be minted or burned later.",
  },
  {
    title: "Review the estimate",
    body: "A live cost estimate and a plain-English summary show exactly what will be deployed before you sign.",
  },
  {
    title: "Sign one transaction",
    body: "Deploy straight from your wallet. Deployment gas is paid by you; the app adds nothing.",
  },
  {
    title: "Get your address & verify",
    body: "The contract address and explorer link appear once mined. Download the verification JSON to verify the source on Blockscout.",
  },
];

export default function TokenCreatorPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toolJsonLd("token-creator") }}
      />
      <ToolPage slug="token-creator" steps={steps}>
        <TokenCreator />
      </ToolPage>
    </>
  );
}
