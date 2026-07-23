"use client";

import { WalletGate } from "@/components/wallet-gate";
import { TokenCreatorForm } from "@/components/tools/token-creator/token-creator-form";

export function TokenCreator() {
  return (
    <WalletGate>
      <TokenCreatorForm />
    </WalletGate>
  );
}
