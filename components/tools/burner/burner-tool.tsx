"use client";

import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Flame,
  Loader2,
} from "lucide-react";
import {
  type Address,
  BaseError,
  erc20Abi,
  formatUnits,
  getAddress,
  type Hash,
  isAddress,
  parseUnits,
} from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { toast } from "sonner";

import { AddressDisplay } from "@/components/address-display";
import { WalletGate } from "@/components/wallet-gate";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BurnConfirmDialog } from "@/components/tools/burner/burn-confirm-dialog";
import {
  type BurnPath,
  burnAbi,
  DEAD_ADDRESS,
  type TokenInfo,
} from "@/components/tools/burner/burner";
import { publicClient } from "@/lib/public-client";
import { txUrl } from "@/lib/explorer";
import { formatTokenAmount, truncateAddress } from "@/lib/format";
import { ShareResult, type ShareCardContent } from "@/components/share-card";

export function BurnerTool() {
  return (
    <WalletGate>
      <BurnerForm />
    </WalletGate>
  );
}

type Status = "idle" | "burning" | "success" | "error";

interface Snapshot {
  totalSupply: bigint;
  balance: bigint;
}

function BurnerForm() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [addressInput, setAddressInput] = useState("");
  const [token, setToken] = useState<TokenInfo | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [amountInput, setAmountInput] = useState("");
  const [burnPath, setBurnPath] = useState<BurnPath | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [status, setStatus] = useState<Status>("idle");
  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [before, setBefore] = useState<Snapshot | null>(null);
  const [after, setAfter] = useState<Snapshot | null>(null);
  const [execError, setExecError] = useState<string | null>(null);

  const parsedAmount =
    token && amountInput ? safeParseUnits(amountInput, token.decimals) : null;

  let amountError: string | null = null;
  if (token && amountInput) {
    if (parsedAmount === null) amountError = "Enter a valid amount.";
    else if (parsedAmount === 0n)
      amountError = "Amount must be greater than zero.";
    else if (parsedAmount > token.balance)
      amountError = "Exceeds your balance.";
  }

  const amountValid =
    parsedAmount !== null && parsedAmount > 0n && !amountError;

  async function loadToken() {
    const trimmed = addressInput.trim();
    if (!isAddress(trimmed)) {
      setTokenError("Enter a valid contract address.");
      return;
    }
    if (!address) return;

    setTokenLoading(true);
    setTokenError(null);
    setToken(null);
    setAmountInput("");
    setBurnPath(null);
    setStatus("idle");
    setTxHash(null);
    setExecError(null);

    try {
      const info = await readToken(getAddress(trimmed), address);
      setToken(info);
    } catch (err) {
      setTokenError(errorMessage(err));
    } finally {
      setTokenLoading(false);
    }
  }

  function onAmountChange(value: string) {
    setAmountInput(value);
    // The detected path is amount-specific; invalidate it when the amount moves.
    setBurnPath(null);
    if (status !== "idle") {
      setStatus("idle");
      setTxHash(null);
      setExecError(null);
      setAfter(null);
    }
  }

  function setMax() {
    if (!token) return;
    onAmountChange(formatUnits(token.balance, token.decimals));
  }

  async function handleReview() {
    if (!token || !address || parsedAmount === null || !amountValid) return;

    setReviewing(true);
    try {
      const path = await detectBurnPath(token, address, parsedAmount);
      setBurnPath(path);
      setDialogOpen(true);
    } catch (err) {
      toast.error("Couldn't prepare the burn", {
        description: errorMessage(err),
      });
    } finally {
      setReviewing(false);
    }
  }

  async function handleExecute() {
    if (!token || !address || burnPath === null || parsedAmount === null)
      return;

    const snapshot: Snapshot = {
      totalSupply: token.totalSupply,
      balance: token.balance,
    };
    setBefore(snapshot);
    setAfter(null);
    setExecError(null);
    setTxHash(null);
    setStatus("burning");

    try {
      const hash =
        burnPath === "burn"
          ? await writeContractAsync({
              address: token.address,
              abi: burnAbi,
              functionName: "burn",
              args: [parsedAmount],
            })
          : await writeContractAsync({
              address: token.address,
              abi: erc20Abi,
              functionName: "transfer",
              args: [DEAD_ADDRESS, parsedAmount],
            });

      setTxHash(hash);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "reverted") {
        throw new Error("The burn transaction reverted on-chain.");
      }

      const fresh = await readSupplyAndBalance(token.address, address);
      setAfter(fresh);
      setToken({ ...token, ...fresh });
      setStatus("success");
      toast.success(`Burned ${amountInput} ${token.symbol}`);
    } catch (err) {
      setExecError(errorMessage(err));
      setStatus("error");
    }
  }

  return (
    <div className="space-y-6">
      {/* Token picker */}
      <div className="space-y-2">
        <Label htmlFor="token-address">Token address</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="token-address"
            placeholder="0x…"
            className="font-mono"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={addressInput}
            onChange={(event) => {
              setAddressInput(event.target.value);
              setTokenError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") void loadToken();
            }}
            aria-invalid={tokenError !== null}
          />
          <Button
            onClick={() => void loadToken()}
            disabled={tokenLoading || addressInput.trim().length === 0}
            className="sm:w-auto"
          >
            {tokenLoading ? <Loader2 className="animate-spin" /> : null}
            Load token
          </Button>
        </div>
        {tokenError ? (
          <p className="text-sm text-destructive">{tokenError}</p>
        ) : null}
      </div>

      {token ? (
        <>
          {/* Token card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {token.name}
                <Badge variant="secondary">{token.symbol}</Badge>
              </CardTitle>
              <AddressDisplay
                address={token.address}
                className="text-muted-foreground"
              />
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Stat label="Your balance">
                <span className="font-mono">
                  {formatTokenAmount(token.balance, token.decimals)}{" "}
                  {token.symbol}
                </span>
              </Stat>
              <Stat label="Total supply">
                <span className="font-mono">
                  {formatTokenAmount(token.totalSupply, token.decimals)}{" "}
                  {token.symbol}
                </span>
              </Stat>
            </CardContent>
          </Card>

          {/* Amount */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="burn-amount">Amount to burn</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={setMax}
                disabled={token.balance === 0n}
              >
                Max
              </Button>
            </div>
            <Input
              id="burn-amount"
              inputMode="decimal"
              placeholder="0.0"
              className="font-mono"
              autoComplete="off"
              value={amountInput}
              onChange={(event) => onAmountChange(event.target.value)}
              aria-invalid={amountError !== null}
            />
            {amountError ? (
              <p className="text-sm text-destructive">{amountError}</p>
            ) : null}
          </div>

          {/* Detected path badge (shown before confirmation) */}
          {burnPath ? <BurnPathNotice path={burnPath} /> : null}

          <Button
            variant="destructive"
            disabled={!amountValid || reviewing || status === "burning"}
            onClick={() => void handleReview()}
          >
            {reviewing ? <Loader2 className="animate-spin" /> : <Flame />}
            {reviewing ? "Checking burn support…" : "Review burn"}
          </Button>

          {/* Execution progress / result */}
          {status === "burning" ? (
            <Alert>
              <Loader2 className="animate-spin" />
              <AlertTitle>Burning…</AlertTitle>
              <AlertDescription>
                {txHash
                  ? "Waiting for the transaction to be mined."
                  : "Confirm the transaction in your wallet."}
              </AlertDescription>
            </Alert>
          ) : null}

          {status === "error" ? (
            <Alert variant="destructive">
              <AlertTitle>Burn failed</AlertTitle>
              <AlertDescription>{execError}</AlertDescription>
            </Alert>
          ) : null}

          {status === "success" && before && after ? (
            <SuccessCard
              token={token}
              path={burnPath}
              amountDisplay={amountInput}
              txHash={txHash}
              before={before}
              after={after}
              onReset={() => {
                setAmountInput("");
                setBurnPath(null);
                setStatus("idle");
                setTxHash(null);
                setBefore(null);
                setAfter(null);
              }}
            />
          ) : null}

          {burnPath ? (
            <BurnConfirmDialog
              open={dialogOpen}
              onOpenChange={setDialogOpen}
              token={token}
              amountDisplay={amountInput}
              path={burnPath}
              onConfirm={() => void handleExecute()}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{children}</p>
    </div>
  );
}

function BurnPathNotice({ path }: { path: BurnPath }) {
  if (path === "burn") {
    return (
      <Alert>
        <Flame />
        <AlertTitle>Token supports burn()</AlertTitle>
        <AlertDescription>
          Tokens will be destroyed and the total supply will decrease.
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert>
      <Flame />
      <AlertTitle>No burn(): dead-address transfer</AlertTitle>
      <AlertDescription>
        This token has no burn() function, so tokens will be sent to{" "}
        <span className="font-mono">0x…dEaD</span>, out of circulation, but the
        total supply is unchanged.
      </AlertDescription>
    </Alert>
  );
}

function SuccessCard({
  token,
  path,
  amountDisplay,
  txHash,
  before,
  after,
  onReset,
}: {
  token: TokenInfo;
  path: BurnPath | null;
  amountDisplay: string;
  txHash: Hash | null;
  before: Snapshot;
  after: Snapshot;
  onReset: () => void;
}) {
  const burnedBase = before.balance - after.balance;
  const formattedAmount =
    burnedBase > 0n
      ? formatTokenAmount(burnedBase, token.decimals)
      : amountDisplay;

  const shareContent: ShareCardContent = {
    tool: "Token burner",
    headline: {
      value: `${formattedAmount} ${token.symbol}`,
      text: "burned",
    },
    subline: {
      text:
        path === "burn"
          ? "Supply reduced via burn()"
          : "Sent to 0x0000…dEaD",
    },
    detail: txHash ? truncateAddress(txHash) : undefined,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="size-5 text-accent-text" />
          Burned {amountDisplay} {token.symbol}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {path === "burn" ? (
          <BeforeAfter
            label="Total supply"
            before={before.totalSupply}
            after={after.totalSupply}
            token={token}
          />
        ) : null}
        <BeforeAfter
          label="Your balance"
          before={before.balance}
          after={after.balance}
          token={token}
        />
        <div className="flex flex-wrap items-center gap-3 pt-1">
          {txHash ? (
            <a
              href={txUrl(txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
            >
              View transaction
              <ExternalLink className="size-3.5" />
            </a>
          ) : null}
          <Button variant="outline" size="sm" onClick={onReset}>
            Burn more
          </Button>
        </div>
        <ShareResult
          content={shareContent}
          filename="robins-burn.png"
          title={`Burned ${formattedAmount} ${token.symbol}`}
          shareText="Burned on Robinhood Chain with robins.tools"
        />
      </CardContent>
    </Card>
  );
}

function BeforeAfter({
  label,
  before,
  after,
  token,
}: {
  label: string;
  before: bigint;
  after: bigint;
  token: TokenInfo;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex flex-wrap items-center gap-2 font-mono text-sm">
        <span className="text-muted-foreground">
          {formatTokenAmount(before, token.decimals)}
        </span>
        <ArrowRight className="size-3.5 text-muted-foreground" />
        <span className="font-medium">
          {formatTokenAmount(after, token.decimals)} {token.symbol}
        </span>
      </div>
    </div>
  );
}

function safeParseUnits(value: string, decimals: number): bigint | null {
  if (value === "" || value === "." || !/^\d*\.?\d*$/.test(value)) return null;
  try {
    return parseUnits(value, decimals);
  } catch {
    return null;
  }
}

async function readToken(
  address: Address,
  account: Address,
): Promise<TokenInfo> {
  const [name, symbol, decimals, totalSupply, balance] =
    await publicClient.multicall({
      allowFailure: true,
      contracts: [
        { address, abi: erc20Abi, functionName: "name" },
        { address, abi: erc20Abi, functionName: "symbol" },
        { address, abi: erc20Abi, functionName: "decimals" },
        { address, abi: erc20Abi, functionName: "totalSupply" },
        { address, abi: erc20Abi, functionName: "balanceOf", args: [account] },
      ],
    });

  if (
    decimals.status !== "success" ||
    totalSupply.status !== "success" ||
    balance.status !== "success"
  ) {
    throw new Error("This address doesn't look like an ERC-20 token.");
  }

  return {
    address,
    name: name.status === "success" ? name.result : "Unknown token",
    symbol: symbol.status === "success" ? symbol.result : "TOKEN",
    decimals: decimals.result,
    totalSupply: totalSupply.result,
    balance: balance.result,
  };
}

async function readSupplyAndBalance(
  address: Address,
  account: Address,
): Promise<Snapshot> {
  const [totalSupply, balance] = await publicClient.multicall({
    allowFailure: false,
    contracts: [
      { address, abi: erc20Abi, functionName: "totalSupply" },
      { address, abi: erc20Abi, functionName: "balanceOf", args: [account] },
    ],
  });
  return { totalSupply, balance };
}

async function detectBurnPath(
  token: TokenInfo,
  account: Address,
  amount: bigint,
): Promise<BurnPath> {
  try {
    await publicClient.simulateContract({
      account,
      address: token.address,
      abi: burnAbi,
      functionName: "burn",
      args: [amount],
    });
    return "burn";
  } catch {
    // burn() is absent or would revert; confirm the dead-address transfer works
    // before offering it as the path (this throws on a genuine failure).
    await publicClient.simulateContract({
      account,
      address: token.address,
      abi: erc20Abi,
      functionName: "transfer",
      args: [DEAD_ADDRESS, amount],
    });
    return "transfer";
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof BaseError) return err.shortMessage;
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}
