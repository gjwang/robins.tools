"use client";

import type { ReactNode } from "react";
import { Wallet } from "lucide-react";
import { useAppKitAccount } from "@reown/appkit/react";

import { ConnectButton } from "@/components/connect-button";
import { Card, CardContent } from "@/components/ui/card";
import { appKitEnabled } from "@/lib/wagmi";

/**
 * Renders `children` only when a wallet is connected; otherwise shows a compact
 * connect prompt. Tools that require a wallet wrap their UI in this.
 */
export function WalletGate({ children }: { children: ReactNode }) {
  // When AppKit isn't configured the account hook would throw, so short-circuit
  // to the prompt (which itself shows a disabled connect button).
  if (!appKitEnabled) return <ConnectPrompt />;
  return <WalletGateInner>{children}</WalletGateInner>;
}

function WalletGateInner({ children }: { children: ReactNode }) {
  const { isConnected } = useAppKitAccount();
  if (isConnected) return <>{children}</>;
  return <ConnectPrompt />;
}

function ConnectPrompt() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary/15 text-foreground">
          <Wallet className="size-6" />
        </div>
        <div className="space-y-1">
          <p className="font-heading text-base font-medium">
            Connect your wallet
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            This tool needs a wallet connected to Robinhood Chain to continue.
          </p>
        </div>
        <ConnectButton />
      </CardContent>
    </Card>
  );
}
