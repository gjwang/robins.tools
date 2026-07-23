"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Info, Loader2, Rocket } from "lucide-react";
import { erc20Abi, type Address } from "viem";
import { useWalletClient } from "wagmi";

import { AddressDisplay } from "@/components/address-display";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { robinhoodChain } from "@/lib/chain";
import { formatTokenAmount } from "@/lib/format";
import { publicClient } from "@/lib/public-client";
import { cn } from "@/lib/utils";

import { chunk } from "./lib/compute";
import type { ComputeResult } from "./lib/compute";
import {
  DISPERSE_ABI,
  ETH_CHUNK_SIZE,
  MULTICALL3_ABI,
  TOKEN_CHUNK_SIZE,
} from "./lib/constants";
import type { Allocation, ApprovalStrategy, SelectedToken } from "./lib/types";
import type { UseDisperse } from "./use-disperse";

interface StepReviewProps {
  account: Address;
  token: SelectedToken;
  allocations: Allocation[];
  compute: ComputeResult;
  disperse: UseDisperse;
  approvalStrategy: ApprovalStrategy;
  onApprovalStrategyChange: (strategy: ApprovalStrategy) => void;
  onBack: () => void;
  onNext: () => void;
}

type GasState =
  | { status: "loading" }
  | { status: "done"; fee: bigint; note?: string }
  | { status: "error" };

const MULTICALL_ADDRESS = robinhoodChain.contracts?.multicall3
  ?.address as `0x${string}`;
const DISPLAY_CAP = 100;

export function StepReview({
  account,
  token,
  allocations,
  compute,
  disperse,
  approvalStrategy,
  onApprovalStrategyChange,
  onBack,
  onNext,
}: StepReviewProps) {
  const { data: walletClient } = useWalletClient();
  const [ethBalance, setEthBalance] = useState<bigint | null>(null);
  const [gas, setGas] = useState<GasState>({ status: "loading" });
  const [deploying, setDeploying] = useState(false);

  const isNative = token.kind === "native";
  const chunkSize = isNative ? ETH_CHUNK_SIZE : TOKEN_CHUNK_SIZE;
  const chunks = chunk(allocations, chunkSize);
  const grandTotal = compute.total;
  const disperseReady = disperse.status !== "checking";
  // ERC-20 needs a deployment; native can fall back to Multicall3.
  const needsDeploy = !isNative && disperse.address === null;

  useEffect(() => {
    let cancelled = false;
    void publicClient
      .getBalance({ address: account })
      .then((b) => {
        if (!cancelled) setEthBalance(b);
      })
      .catch(() => {
        if (!cancelled) setEthBalance(null);
      });
    return () => {
      cancelled = true;
    };
  }, [account]);

  // ERC-20 with no deployment yet can't be estimated; treat as unavailable.
  const gasEstimable = disperseReady && allocations.length > 0 && !needsDeploy;

  useEffect(() => {
    if (!gasEstimable) return;
    let cancelled = false;

    void (async () => {
      setGas({ status: "loading" });
      try {
        const gasPrice = await publicClient.getGasPrice();
        const first = chunks[0];
        const firstAddrs = first.map((a) => a.address);
        const firstValues = first.map((a) => a.value);
        const firstTotal = firstValues.reduce((acc, v) => acc + v, 0n);

        if (isNative) {
          let unit: bigint;
          if (disperse.address) {
            unit = await publicClient.estimateContractGas({
              account,
              address: disperse.address,
              abi: DISPERSE_ABI,
              functionName: "disperseEther",
              args: [firstAddrs, firstValues],
              value: firstTotal,
            });
          } else {
            unit = await publicClient.estimateContractGas({
              account,
              address: MULTICALL_ADDRESS,
              abi: MULTICALL3_ABI,
              functionName: "aggregate3Value",
              args: [
                first.map((a) => ({
                  target: a.address,
                  allowFailure: false,
                  value: a.value,
                  callData: "0x" as const,
                })),
              ],
              value: firstTotal,
            });
          }
          if (!cancelled) {
            setGas({
              status: "done",
              fee: unit * gasPrice * BigInt(chunks.length),
            });
          }
          return;
        }

        // ERC-20: approve is always estimable; disperseToken needs allowance.
        let approveGas = 55_000n;
        try {
          approveGas = await publicClient.estimateContractGas({
            account,
            address: token.address,
            abi: erc20Abi,
            functionName: "approve",
            args: [disperse.address as `0x${string}`, grandTotal],
          });
        } catch {
          // keep heuristic
        }
        try {
          const dg = await publicClient.estimateContractGas({
            account,
            address: disperse.address as `0x${string}`,
            abi: DISPERSE_ABI,
            functionName: "disperseToken",
            args: [token.address, firstAddrs, firstValues],
          });
          if (!cancelled) {
            setGas({
              status: "done",
              fee: (approveGas + dg * BigInt(chunks.length)) * gasPrice,
            });
          }
        } catch {
          if (!cancelled) {
            setGas({
              status: "done",
              fee: approveGas * gasPrice,
              note: "Token batch gas is estimated after you approve, so this shows the approval only.",
            });
          }
        }
      } catch {
        if (!cancelled) setGas({ status: "error" });
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gasEstimable, disperse.address, grandTotal, allocations.length]);

  const gasDisplay: GasState = gasEstimable ? gas : { status: "error" };

  async function handleDeploy() {
    if (!walletClient) return;
    setDeploying(true);
    try {
      await disperse.deploy(walletClient, account);
    } catch {
      // error surfaced via disperse.deployError
    } finally {
      setDeploying(false);
    }
  }

  const gasFee = gasDisplay.status === "done" ? gasDisplay.fee : 0n;
  const ethRequired = isNative ? grandTotal + gasFee : gasFee;
  const insufficientEth =
    ethBalance !== null &&
    ethBalance < ethRequired &&
    gasDisplay.status === "done";
  const insufficientToken =
    !isNative && token.kind === "erc20" && token.balance < grandTotal;

  const approvalsCount =
    isNative || compute.total === 0n
      ? 0
      : approvalStrategy === "total"
        ? 1
        : chunks.length;

  const canSend =
    disperseReady &&
    !needsDeploy &&
    compute.errors.length === 0 &&
    allocations.length > 0;

  return (
    <div className="space-y-6">
      {/* A configured/saved disperse address was rejected for failing the bytecode check. */}
      {disperse.warning ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>{disperse.warning}</AlertDescription>
        </Alert>
      ) : null}

      {/* Deployment / path status */}
      {isNative ? (
        <PathNote
          ready={disperseReady}
          text={
            disperse.address
              ? "Native ETH will be sent through your RobinsDisperse deployment."
              : "No disperse deployment found. Native ETH is sent via Multicall3 (no deployment needed)."
          }
        />
      ) : needsDeploy && disperseReady ? (
        <DeployCard
          deploying={deploying || disperse.deploying}
          error={disperse.deployError}
          onDeploy={handleDeploy}
          canDeploy={!!walletClient}
        />
      ) : !isNative && disperse.address ? (
        <PathNote
          ready={disperseReady}
          text={`Using RobinsDisperse at ${disperse.address} (${disperse.source}). Its disperseToken can only move your own approved balance.`}
        />
      ) : null}

      {/* Totals */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Recipients" value={allocations.length.toString()} />
        <Stat
          label="Total to send"
          value={`${formatTokenAmount(grandTotal, token.decimals)} ${token.symbol}`}
          mono
        />
        <Stat
          label="Transactions"
          value={`${chunks.length} batch${chunks.length > 1 ? "es" : ""}${
            approvalsCount > 0 ? ` + ${approvalsCount} approval` : ""
          }`}
        />
      </div>

      {/* Approval strategy (ERC-20 only) */}
      {!isNative ? (
        <div className="space-y-2 rounded-lg border p-4">
          <p className="text-sm font-medium">Approval strategy</p>
          <p className="text-xs text-muted-foreground">
            The disperse helper pulls tokens using your approval. Approvals are
            skipped entirely if your existing allowance already covers the run.
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <StrategyOption
              active={approvalStrategy === "total"}
              title="One approval (default)"
              hint="Approve the full total once, then send every batch."
              onClick={() => onApprovalStrategyChange("total")}
            />
            <StrategyOption
              active={approvalStrategy === "per-chunk"}
              title="Per batch"
              hint="Approve each batch separately for tighter, shorter-lived allowances."
              onClick={() => onApprovalStrategyChange("per-chunk")}
            />
          </div>
        </div>
      ) : null}

      {/* Balances & gas */}
      <div className="space-y-2 rounded-lg border p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Your ETH balance</span>
          <span className="font-mono">
            {ethBalance === null
              ? "-"
              : `${formatTokenAmount(ethBalance, 18)} ETH`}
          </span>
        </div>
        {!isNative && token.kind === "erc20" ? (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Your {token.symbol} balance
            </span>
            <span className="font-mono">
              {formatTokenAmount(token.balance, token.decimals)} {token.symbol}
            </span>
          </div>
        ) : null}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Est. network fee (all batches)
          </span>
          <span className="font-mono">
            {gasDisplay.status === "loading" ? (
              <Loader2 className="inline size-3.5 animate-spin" />
            ) : gasDisplay.status === "error" ? (
              "unavailable"
            ) : (
              `≈ ${formatTokenAmount(gasDisplay.fee, 18)} ETH`
            )}
          </span>
        </div>
        {gasDisplay.status === "done" && gasDisplay.note ? (
          <p className="text-xs text-muted-foreground">{gasDisplay.note}</p>
        ) : null}
      </div>

      {compute.notes.map((note) => (
        <Alert key={note}>
          <Info />
          <AlertDescription>{note}</AlertDescription>
        </Alert>
      ))}

      {insufficientToken ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Insufficient {token.symbol} balance</AlertTitle>
          <AlertDescription>
            You need {formatTokenAmount(grandTotal, token.decimals)}{" "}
            {token.symbol} but hold{" "}
            {token.kind === "erc20"
              ? formatTokenAmount(token.balance, token.decimals)
              : "0"}
            .
          </AlertDescription>
        </Alert>
      ) : null}

      {insufficientEth ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>
            Insufficient ETH for {isNative ? "sends + gas" : "gas"}
          </AlertTitle>
          <AlertDescription>
            You need about {formatTokenAmount(ethRequired, 18)} ETH but hold{" "}
            {ethBalance !== null ? formatTokenAmount(ethBalance, 18) : "0"} ETH.
            The fee is an estimate; top up before sending.
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Fee disclosure */}
      <Alert>
        <Info />
        <AlertDescription>
          You pay all gas. Tokens and ETH go directly from your wallet to each
          recipient. This app never holds your funds.
        </AlertDescription>
      </Alert>

      {/* Recipients table */}
      <div className="rounded-lg border">
        <div className="border-b px-3 py-2 text-sm font-medium">
          Recipients ({allocations.length})
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Address</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allocations.slice(0, DISPLAY_CAP).map((a, i) => (
              <TableRow key={a.address}>
                <TableCell className="font-mono text-muted-foreground">
                  {i + 1}
                </TableCell>
                <TableCell>
                  <AddressDisplay
                    address={a.address}
                    explorer
                    copyable={a.address.toLowerCase() !== account.toLowerCase()}
                  />
                  {a.address.toLowerCase() === account.toLowerCase() ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (you)
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatTokenAmount(a.value, token.decimals)} {token.symbol}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {allocations.length > DISPLAY_CAP ? (
          <div className="border-t px-3 py-2 text-xs text-muted-foreground">
            …and {allocations.length - DISPLAY_CAP} more
          </div>
        ) : null}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button disabled={!canSend} onClick={onNext}>
          {needsDeploy ? "Deploy helper to continue" : "Continue to send"}
        </Button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg bg-card p-3 ring-1 ring-foreground/10">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-medium", mono && "font-mono text-sm")}>
        {value}
      </p>
    </div>
  );
}

function StrategyOption({
  active,
  title,
  hint,
  onClick,
}: {
  active: boolean;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "rounded-lg border p-3 text-left transition-colors",
        active
          ? "border-accent-text bg-primary/10"
          : "border-border hover:bg-muted",
      )}
    >
      <span className="block text-sm font-medium">{title}</span>
      <span className="block text-xs text-muted-foreground">{hint}</span>
    </button>
  );
}

function PathNote({ ready, text }: { ready: boolean; text: string }) {
  return (
    <Alert>
      {ready ? <Info /> : <Loader2 className="animate-spin" />}
      <AlertDescription>
        {ready ? text : "Checking for a disperse deployment…"}
      </AlertDescription>
    </Alert>
  );
}

function DeployCard({
  deploying,
  error,
  onDeploy,
  canDeploy,
}: {
  deploying: boolean;
  error: string | null;
  onDeploy: () => void;
  canDeploy: boolean;
}) {
  return (
    <Alert>
      <Rocket />
      <AlertTitle>One-time helper deployment needed</AlertTitle>
      <AlertDescription>
        <p className="mb-2">
          Sending an ERC-20 uses the open-source RobinsDisperse helper. Deploy
          it once (one transaction). You own the deployment and it&apos;s
          reused next time. Its <code>disperseToken</code> can only ever move
          your own approved balance.
        </p>
        {error ? <p className="mb-2 text-destructive">{error}</p> : null}
        <Button size="sm" onClick={onDeploy} disabled={deploying || !canDeploy}>
          {deploying ? <Loader2 className="animate-spin" /> : <Rocket />}
          {deploying ? "Deploying…" : "Deploy disperse helper"}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
