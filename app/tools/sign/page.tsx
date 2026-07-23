import type { Metadata } from "next";

import { SignVerify } from "@/components/tools/sign/sign-verify";
import { ToolPage } from "@/components/tool-page";
import { toolJsonLd, toolPageMetadata } from "@/lib/seo";

export const metadata: Metadata = toolPageMetadata("sign");

const steps = [
  {
    title: "Sign a message",
    body: "Connect a wallet, type a message, and sign it with EIP-191 personal_sign. Nothing is sent on-chain.",
  },
  {
    title: "Verify a signature",
    body: "Paste a message and its signature to recover the address that produced it. Add an expected signer to confirm a match.",
  },
  {
    title: "Stays on your machine",
    body: "Verification runs fully in your browser, with no wallet or network request involved.",
  },
];

export default function SignPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toolJsonLd("sign") }}
      />
      <ToolPage slug="sign" steps={steps}>
        <SignVerify />
      </ToolPage>
    </>
  );
}
