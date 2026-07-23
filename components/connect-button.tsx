"use client";

import {
  useAppKit,
  useAppKitAccount,
  useAppKitNetwork,
} from "@reown/appkit/react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { robinhoodChain } from "@/lib/chain";
import { truncateAddress } from "@/lib/format";
import { appKitEnabled } from "@/lib/wagmi";

export function ConnectButton() {
  // `appKitEnabled` is a build-time constant, so this branch never changes
  // between renders. The AppKit hooks live in ActiveConnectButton and are only
  // mounted when createAppKit was actually called.
  if (!appKitEnabled) return <DisabledConnectButton />;
  return <ActiveConnectButton />;
}

function DisabledConnectButton() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Wrap the disabled button so the tooltip still receives events. */}
          <span tabIndex={0}>
            <Button disabled>Connect Wallet</Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          Set NEXT_PUBLIC_REOWN_PROJECT_ID to enable wallet connections.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ActiveConnectButton() {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { chainId, switchNetwork } = useAppKitNetwork();

  if (isConnected && address) {
    const wrongNetwork = chainId !== robinhoodChain.id;

    if (wrongNetwork) {
      return (
        <Button variant="outline" onClick={() => switchNetwork(robinhoodChain)}>
          <span
            className="size-2 rounded-full bg-destructive"
            aria-hidden="true"
          />
          Switch network
        </Button>
      );
    }

    return (
      <Button variant="outline" onClick={() => open({ view: "Account" })}>
        <span className="size-2 rounded-full bg-accent-text" aria-hidden="true" />
        <span className="font-mono">{truncateAddress(address)}</span>
      </Button>
    );
  }

  return <Button onClick={() => open()}>Connect Wallet</Button>;
}
