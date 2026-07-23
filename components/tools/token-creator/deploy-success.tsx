"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  FileCheck2,
  PlusCircle,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { Address, Hex } from "viem";
import { useWalletClient } from "wagmi";

import { CopyButton } from "@/components/copy-button";
import { ShareResult, type ShareCardContent } from "@/components/share-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { tokenUrl } from "@/lib/explorer";
import { truncateAddress } from "@/lib/format";
import {
  contractName,
  downloadVerificationJson,
  humanizeError,
  solcLongVersion,
} from "@/components/tools/token-creator/helpers";

interface DeploySuccessProps {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
  txHash: Hex | null;
  onReset: () => void;
}

export function DeploySuccess({
  address,
  name,
  symbol,
  decimals,
  txHash,
  onReset,
}: DeploySuccessProps) {
  const { data: walletClient } = useWalletClient();
  const [adding, setAdding] = useState(false);

  const shareContent: ShareCardContent = {
    tool: "Token creator",
    headline: { value: `${name} (${symbol})`, text: "deployed" },
    subline: { text: truncateAddress(address, 6), mono: true },
    detail: txHash ? truncateAddress(txHash) : undefined,
  };

  async function addToWallet() {
    if (!walletClient) return;
    setAdding(true);
    try {
      await walletClient.watchAsset({
        type: "ERC20",
        options: { address, symbol, decimals },
      });
    } catch (err) {
      toast.error(humanizeError(err));
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-6">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-foreground">
              <CheckCircle2 className="size-5" />
            </span>
            <div className="space-y-1">
              <h2 className="font-heading text-lg font-semibold tracking-tight">
                {name} is live
              </h2>
              <p className="text-sm text-muted-foreground">
                Your ERC-20 was deployed to Robinhood Chain. Save the contract
                address below.
              </p>
            </div>
          </div>

          <div className="space-y-2 rounded-lg bg-muted/40 p-4 ring-1 ring-foreground/10">
            <p className="text-xs font-medium text-muted-foreground uppercase">
              Contract address
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm break-all">{address}</span>
              <CopyButton value={address} label="Copy contract address" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <a
                href={tokenUrl(address)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink />
                View token on explorer
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={addToWallet}
              disabled={!walletClient || adding}
            >
              <PlusCircle />
              Add to wallet
            </Button>
          </div>

          <ShareResult
            content={shareContent}
            filename="robins-token.png"
            title={`${name} (${symbol}) deployed`}
            shareText="Deployed an ERC-20 on Robinhood Chain with robins.tools"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-foreground">
              <FileCheck2 className="size-5" />
            </span>
            <div className="space-y-1">
              <p className="font-heading text-sm font-medium">
                Contract verification
              </p>
              <p className="text-sm text-muted-foreground">
                Verify the source on Blockscout so anyone can read exactly what
                you deployed. It is optional, but recommended.
              </p>
            </div>
          </div>

          <Button type="button" onClick={downloadVerificationJson}>
            <Download />
            Download verification JSON
          </Button>

          <Separator />

          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              On the explorer&apos;s{" "}
              <a
                href={`${tokenUrl(address)}?tab=contract`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-4"
              >
                contract verification
              </a>{" "}
              page choose{" "}
              <span className="text-foreground">Standard JSON input</span>,
              then:
            </p>
            <ul className="space-y-1.5">
              <li className="flex gap-2">
                <span className="text-muted-foreground">Compiler</span>
                <span className="font-mono text-foreground">
                  v{solcLongVersion.split(".Emscripten")[0]}
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-muted-foreground">Contract name</span>
                <span className="font-mono text-foreground">
                  {contractName}
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-muted-foreground">Constructor args</span>
                <span className="text-foreground">auto-detected</span>
              </li>
            </ul>
            <p>
              Upload the downloaded{" "}
              <span className="font-mono text-foreground">
                robins-token-verification.json
              </span>{" "}
              as the standard-JSON file. See the{" "}
              <Link
                href="/docs/tools/token-creator"
                className="text-foreground underline underline-offset-4"
              >
                full walkthrough
              </Link>{" "}
              for step-by-step screenshots.
            </p>
          </div>
        </CardContent>
      </Card>

      <Button type="button" variant="ghost" onClick={onReset}>
        <Sparkles />
        Create another token
      </Button>
    </div>
  );
}
