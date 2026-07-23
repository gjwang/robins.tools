"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  ExternalLink,
  Loader2,
  XCircle,
} from "lucide-react";
import { erc20Abi, type Address } from "viem";
import { useSwitchChain, useWalletClient } from "wagmi";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { robinhoodChain } from "@/lib/chain";
import { formatTokenAmount, truncateAddress } from "@/lib/format";
import { publicClient } from "@/lib/public-client";
import { txUrl } from "@/lib/explorer";
import { cn } from "@/lib/utils";
import { ShareResult, type ShareCardContent } from "@/components/share-card";

import { buildOps, runOp, type OpPhase, type SendOp } from "./lib/build-ops";
import type { Allocation, ApprovalStrategy, SelectedToken } from "./lib/types";
import { errorMessage } from "./lib/util";

const MULTICALL_ADDRESS = robinhoodChain.contracts?.multicall3
  ?.address as `0x${string}`;

type OpStatus = "pending" | OpPhase | "done" | "failed";

type ReceiptOutcome = "success" | "reverted" | "notfound";

/**
 * Re-check an already-broadcast hash before any potential re-send. A not-found
 * result, or any RPC failure, means we cannot prove the tx confirmed, so we
 * report "notfound" and let the caller force an explicit human confirmation
 * rather than silently re-broadcasting a batch that may still land on-chain
 * (which would pay every recipient twice).
 */
async function recheckReceipt(hash: `0x${string}`): Promise<ReceiptOutcome> {
  try {
    const receipt = await publicClient.getTransactionReceipt({ hash });
    return receipt.status === "success" ? "success" : "reverted";
  } catch {
    return "notfound";
  }
}

interface StepSendProps {
  account: Address;
  chainId: number | undefined;
  token: SelectedToken;
  allocations: Allocation[];
  disperseAddress: `0x${string}` | null;
  approvalStrategy: ApprovalStrategy;
  onBack: () => void;
  onReset: () => void;
}

export function StepSend({
  account,
  chainId,
  token,
  allocations,
  disperseAddress,
  approvalStrategy,
  onBack,
  onReset,
}: StepSendProps) {
  const { data: walletClient } = useWalletClient();
  const { switchChain } = useSwitchChain();

  const [ops, setOps] = useState<SendOp[]>([]);
  const [statuses, setStatuses] = useState<OpStatus[]>([]);
  const [hashes, setHashes] = useState<(`0x${string}` | null)[]>([]);
  const [errors, setErrors] = useState<(string | null)[]>([]);
  const [preparing, setPreparing] = useState(true);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [failedIndex, setFailedIndex] = useState<number | null>(null);
  // Index of a failed op whose broadcast hash is unconfirmed and awaiting an
  // explicit re-send confirmation; null when no guard dialog is open.
  const [confirmResendIndex, setConfirmResendIndex] = useState<number | null>(
    null,
  );
  const [rechecking, setRechecking] = useState(false);

  const statusesRef = useRef<OpStatus[]>([]);
  const hashesRef = useRef<(`0x${string}` | null)[]>([]);
  const errorsRef = useRef<(string | null)[]>([]);

  function sync() {
    setStatuses([...statusesRef.current]);
    setHashes([...hashesRef.current]);
    setErrors([...errorsRef.current]);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setPreparing(true);
      setPrepareError(null);
      try {
        let allowance = 0n;
        if (token.kind === "erc20" && disperseAddress) {
          allowance = await publicClient.readContract({
            address: token.address,
            abi: erc20Abi,
            functionName: "allowance",
            args: [account, disperseAddress],
          });
        }
        const built = buildOps({
          token,
          allocations,
          disperseAddress,
          multicallAddress: MULTICALL_ADDRESS,
          approvalStrategy,
          currentAllowance: allowance,
        });
        if (cancelled) return;
        statusesRef.current = built.map(() => "pending");
        hashesRef.current = built.map(() => null);
        errorsRef.current = built.map(() => null);
        setOps(built);
        sync();
      } catch (err) {
        if (!cancelled) setPrepareError(errorMessage(err));
      } finally {
        if (!cancelled) setPreparing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wrongNetwork = chainId !== robinhoodChain.id;

  async function runFrom(start: number) {
    if (!walletClient || wrongNetwork) return;
    setRunning(true);
    setFailedIndex(null);
    for (let i = start; i < ops.length; i++) {
      if (statusesRef.current[i] === "done") continue;
      statusesRef.current[i] = "simulating";
      errorsRef.current[i] = null;
      sync();
      try {
        await runOp(ops[i], {
          walletClient,
          account,
          onPhase: (phase) => {
            statusesRef.current[i] = phase;
            sync();
          },
          onHash: (hash) => {
            hashesRef.current[i] = hash;
            sync();
          },
        });
        statusesRef.current[i] = "done";
        sync();
      } catch (err) {
        statusesRef.current[i] = "failed";
        errorsRef.current[i] = errorMessage(err);
        sync();
        setFailedIndex(i);
        setRunning(false);
        return;
      }
    }
    setRunning(false);
  }

  /** Mark op `i` confirmed from a recovered receipt, then resume the rest. */
  function markConfirmedAndResume(i: number) {
    statusesRef.current[i] = "done";
    errorsRef.current[i] = null;
    sync();
    setFailedIndex(null);
    // `i` is now "done", so runFrom skips it and continues with the remaining ops.
    void runFrom(i);
  }

  /**
   * Retry entry point for the failed batch. If the op never recorded a broadcast
   * hash it retries immediately (unchanged behavior). If a hash exists we must NOT
   * blindly re-broadcast. Re-check the receipt first:
   *  - confirmed success → mark it done and resume the remaining ops,
   *  - reverted          → normal retry (re-simulate + re-send),
   *  - not found         → open the destructive confirm dialog.
   */
  async function handleRetry() {
    if (failedIndex === null || rechecking || running) return;
    const i = failedIndex;
    const hash = hashesRef.current[i];
    if (!hash) {
      void runFrom(i);
      return;
    }
    setRechecking(true);
    const outcome = await recheckReceipt(hash);
    setRechecking(false);
    if (outcome === "success") {
      markConfirmedAndResume(i);
    } else if (outcome === "reverted") {
      void runFrom(i);
    } else {
      setConfirmResendIndex(i);
    }
  }

  /** "Check again" inside the guard dialog: re-run the receipt check. */
  async function handleCheckAgain() {
    if (confirmResendIndex === null || rechecking) return;
    const i = confirmResendIndex;
    const hash = hashesRef.current[i];
    if (!hash) {
      setConfirmResendIndex(null);
      return;
    }
    setRechecking(true);
    const outcome = await recheckReceipt(hash);
    setRechecking(false);
    if (outcome === "success") {
      setConfirmResendIndex(null);
      markConfirmedAndResume(i);
    } else if (outcome === "reverted") {
      setConfirmResendIndex(null);
      void runFrom(i);
    } else {
      toast.info(
        "Still no receipt for this batch. Verify it on the explorer before re-sending.",
      );
    }
  }

  /** "Re-send batch": the user accepted the double-send risk; re-simulate + send. */
  function handleConfirmResend() {
    if (confirmResendIndex === null) return;
    const i = confirmResendIndex;
    setConfirmResendIndex(null);
    // Op is still "failed"; runFrom re-simulates and re-sends, overwriting its hash.
    void runFrom(i);
  }

  const anyStarted = statuses.some((s) => s !== "pending");
  const allDone = statuses.length > 0 && statuses.every((s) => s === "done");
  const firstPending = statuses.findIndex((s) => s !== "done");

  const grandTotal = allocations.reduce((acc, a) => acc + a.value, 0n);
  const firstHash =
    hashes.find((h): h is `0x${string}` => h !== null) ?? null;
  const shareContent: ShareCardContent = {
    tool: "Multisender",
    headline: {
      value: `${formatTokenAmount(grandTotal, token.decimals)} ${token.symbol}`,
      text: "sent",
    },
    subline: {
      text: `to ${allocations.length} recipient${
        allocations.length > 1 ? "s" : ""
      } in ${ops.length} transaction${ops.length > 1 ? "s" : ""}`,
    },
    detail: firstHash ? truncateAddress(firstHash) : undefined,
  };
  const resendHash =
    confirmResendIndex !== null ? (hashes[confirmResendIndex] ?? null) : null;

  if (preparing) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Preparing transactions…
      </div>
    );
  }

  if (prepareError) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <XCircle />
          <AlertTitle>Could not prepare the send</AlertTitle>
          <AlertDescription>{prepareError}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {wrongNetwork ? (
        <Alert variant="destructive">
          <XCircle />
          <AlertTitle>Wrong network</AlertTitle>
          <AlertDescription>
            <p className="mb-2">
              Switch your wallet to Robinhood Chain to send.
            </p>
            <Button
              size="sm"
              onClick={() => switchChain({ chainId: robinhoodChain.id })}
            >
              Switch network
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {allDone ? (
        <Alert>
          <CheckCircle2 />
          <AlertTitle>All transactions confirmed</AlertTitle>
          <AlertDescription>
            Sent{" "}
            {formatTokenAmount(
              allocations.reduce((acc, a) => acc + a.value, 0n),
              token.decimals,
            )}{" "}
            {token.symbol} to {allocations.length} recipient
            {allocations.length > 1 ? "s" : ""} across {ops.length} transaction
            {ops.length > 1 ? "s" : ""}.
          </AlertDescription>
        </Alert>
      ) : null}

      {allDone ? (
        <ShareResult
          content={shareContent}
          filename="robins-multisend.png"
          title={`Sent ${formatTokenAmount(grandTotal, token.decimals)} ${token.symbol}`}
          shareText="Distributed on Robinhood Chain with robins.tools"
        />
      ) : null}

      <ol className="space-y-2">
        {ops.map((op, i) => {
          const status = statuses[i] ?? "pending";
          const hash = hashes[i];
          const error = errors[i];
          return (
            <li
              key={op.id}
              className={cn(
                "rounded-lg border p-3",
                status === "done" && "border-accent-text/40 bg-primary/5",
                status === "failed" && "border-destructive/40 bg-destructive/5",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <StatusIcon status={status} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{op.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {op.kind === "approve"
                        ? `Approve ${formatTokenAmount(op.total, token.decimals)} ${token.symbol}`
                        : `${op.recipients} recipient${op.recipients > 1 ? "s" : ""} · ${formatTokenAmount(op.total, token.decimals)} ${token.symbol}`}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <StatusLabel status={status} />
                  {hash ? (
                    <a
                      href={txUrl(hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 flex items-center justify-end gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      View tx <ExternalLink className="size-3" />
                    </a>
                  ) : null}
                </div>
              </div>
              {error ? (
                <p className="mt-2 text-xs text-destructive">{error}</p>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={running || anyStarted}
        >
          Back
        </Button>
        <div className="flex gap-2">
          {allDone ? (
            <Button onClick={onReset}>Start another send</Button>
          ) : failedIndex !== null ? (
            <>
              <Button
                variant="outline"
                disabled={running || wrongNetwork || rechecking}
                onClick={handleRetry}
              >
                {rechecking ? (
                  <>
                    <Loader2 className="animate-spin" /> Checking…
                  </>
                ) : (
                  "Retry failed batch"
                )}
              </Button>
              <Button
                disabled={running || wrongNetwork || rechecking}
                onClick={() =>
                  runFrom(firstPending === -1 ? ops.length : firstPending)
                }
              >
                Resume remaining
              </Button>
            </>
          ) : (
            <Button
              disabled={running || wrongNetwork || ops.length === 0}
              onClick={() => runFrom(0)}
            >
              {running ? (
                <>
                  <Loader2 className="animate-spin" /> Sending…
                </>
              ) : anyStarted ? (
                "Resume"
              ) : (
                "Start sending"
              )}
            </Button>
          )}
        </div>
      </div>

      <AlertDialog
        open={confirmResendIndex !== null}
        onOpenChange={(open) => {
          if (!open && !rechecking) setConfirmResendIndex(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <AlertTriangle />
            </AlertDialogMedia>
            <AlertDialogTitle>Batch already broadcast</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmResendIndex !== null ? (
                <>
                  Batch {confirmResendIndex + 1} was already broadcast as{" "}
                  {resendHash ? (
                    <a
                      href={txUrl(resendHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      this transaction
                    </a>
                  ) : (
                    "a transaction"
                  )}{" "}
                  but not confirmed. Verify it on the explorer first. Re-sending
                  a batch that later confirms would pay recipients twice.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rechecking}>Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={handleCheckAgain}
              disabled={rechecking}
            >
              {rechecking ? (
                <>
                  <Loader2 className="animate-spin" /> Checking…
                </>
              ) : (
                "Check again"
              )}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmResend}
              disabled={rechecking}
            >
              Re-send batch
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatusIcon({ status }: { status: OpStatus }) {
  if (status === "done")
    return <CheckCircle2 className="size-4 shrink-0 text-accent-text" />;
  if (status === "failed")
    return <XCircle className="size-4 shrink-0 text-destructive" />;
  if (status === "pending")
    return <Circle className="size-4 shrink-0 text-muted-foreground/40" />;
  return <Loader2 className="size-4 shrink-0 animate-spin text-foreground" />;
}

function StatusLabel({ status }: { status: OpStatus }) {
  const labels: Record<OpStatus, string> = {
    pending: "Waiting",
    simulating: "Simulating",
    confirming: "Confirm in wallet",
    mining: "Mining",
    done: "Confirmed",
    failed: "Failed",
  };
  return (
    <span
      className={cn(
        "text-xs font-medium",
        status === "done" && "text-accent-text",
        status === "failed" && "text-destructive",
        status !== "done" && status !== "failed" && "text-muted-foreground",
      )}
    >
      {labels[status]}
    </span>
  );
}
