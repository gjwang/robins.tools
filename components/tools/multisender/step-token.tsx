"use client";

import { useState } from "react";
import { Coins, Loader2, Wallet } from "lucide-react";
import { erc20Abi, getAddress, isAddress, type Address } from "viem";

import { AddressDisplay } from "@/components/address-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { publicClient } from "@/lib/public-client";
import { formatTokenAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

import { errorMessage } from "./lib/util";
import type { Erc20Token, TokenKind } from "./lib/types";

interface StepTokenProps {
  account: Address;
  tokenKind: TokenKind;
  onTokenKindChange: (kind: TokenKind) => void;
  erc20Address: string;
  onErc20AddressChange: (value: string) => void;
  token: Erc20Token | null;
  onTokenLoaded: (token: Erc20Token | null) => void;
  onNext: () => void;
}

export function StepToken({
  account,
  tokenKind,
  onTokenKindChange,
  erc20Address,
  onErc20AddressChange,
  token,
  onTokenLoaded,
  onNext,
}: StepTokenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = erc20Address.trim();
  const addressValid = isAddress(trimmed);

  async function loadToken() {
    if (!addressValid) return;
    setLoading(true);
    setError(null);
    onTokenLoaded(null);
    const address = getAddress(trimmed);
    try {
      const [nameRes, symbolRes, decimalsRes, balanceRes] =
        await publicClient.multicall({
          allowFailure: true,
          contracts: [
            { address, abi: erc20Abi, functionName: "name" },
            { address, abi: erc20Abi, functionName: "symbol" },
            { address, abi: erc20Abi, functionName: "decimals" },
            {
              address,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [account],
            },
          ],
        });

      if (decimalsRes.status !== "success") {
        throw new Error("This address does not look like an ERC-20 token.");
      }

      onTokenLoaded({
        kind: "erc20",
        address,
        name: nameRes.status === "success" ? nameRes.result : "Unknown token",
        symbol: symbolRes.status === "success" ? symbolRes.result : "???",
        decimals: decimalsRes.result,
        balance: balanceRes.status === "success" ? balanceRes.result : 0n,
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const canContinue = tokenKind === "native" || token !== null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <TokenKindOption
          active={tokenKind === "native"}
          icon={<Wallet className="size-4" />}
          title="Native ETH"
          subtitle="Send the gas token directly"
          onClick={() => onTokenKindChange("native")}
        />
        <TokenKindOption
          active={tokenKind === "erc20"}
          icon={<Coins className="size-4" />}
          title="ERC-20 token"
          subtitle="Send any token by address"
          onClick={() => onTokenKindChange("erc20")}
        />
      </div>

      {tokenKind === "erc20" ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="token-address">Token contract address</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="token-address"
                placeholder="0x…"
                spellCheck={false}
                autoComplete="off"
                className="font-mono"
                value={erc20Address}
                aria-invalid={trimmed !== "" && !addressValid}
                onChange={(e) => {
                  onErc20AddressChange(e.target.value);
                  onTokenLoaded(null);
                  setError(null);
                }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={!addressValid || loading}
                onClick={loadToken}
              >
                {loading ? <Loader2 className="animate-spin" /> : null}
                Load token
              </Button>
            </div>
            {trimmed !== "" && !addressValid ? (
              <p className="text-sm text-destructive">Not a valid address.</p>
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          {token ? (
            <div className="rounded-lg bg-card p-4 ring-1 ring-foreground/10">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-heading font-medium">
                    {token.name}{" "}
                    <span className="text-muted-foreground">
                      ({token.symbol})
                    </span>
                  </p>
                  <div className="mt-1">
                    <AddressDisplay address={token.address} explorer />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Your balance</p>
                  <p className="font-mono text-sm">
                    {formatTokenAmount(token.balance, token.decimals)}{" "}
                    {token.symbol}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Decimals: {token.decimals}
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          You&apos;ll disperse native ETH straight from your wallet to every
          recipient.
        </p>
      )}

      <div className="flex justify-end">
        <Button disabled={!canContinue} onClick={onNext}>
          Continue
        </Button>
      </div>
    </div>
  );
}

function TokenKindOption({
  active,
  icon,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4 text-left transition-colors",
        active
          ? "border-accent-text bg-primary/10"
          : "border-border bg-background hover:bg-muted",
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md",
          active
            ? "bg-primary/20 text-foreground"
            : "bg-muted text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{subtitle}</span>
      </span>
    </button>
  );
}
