"use client";

import { useRef, useState } from "react";
import { AlertCircle, Info, Loader2 } from "lucide-react";
import { BaseError } from "viem";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

import {
  DecoderError,
  decodeLogs,
  detectInput,
  fetchContractAbi,
  fetchTxData,
  resolveAndDecodeCalldata,
} from "./decode";
import { DecodedCall } from "./decoded-call";
import { DecodedLogs } from "./decoded-logs";
import { OverviewCard } from "./overview-card";
import type { CalldataResult, DecodedLog, TxOverview } from "./types";

type ResultState =
  | {
      kind: "tx";
      tx: TxOverview;
      call: CalldataResult | null;
      plainTransfer: boolean;
      logs: DecodedLog[];
    }
  | { kind: "calldata"; call: CalldataResult };

type Status = "idle" | "loading" | "error" | "done";

function errorMessage(error: unknown): string {
  if (error instanceof DecoderError) return error.message;
  if (error instanceof BaseError) return error.shortMessage;
  if (error instanceof Error) return error.message;
  return "Something went wrong while decoding.";
}

export function DecoderTool() {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResultState | null>(null);
  const runId = useRef(0);

  const trimmed = input.trim();
  const detection = trimmed ? detectInput(trimmed) : null;
  const detectedMode = detection && "mode" in detection ? detection.mode : null;
  const detectionError =
    detection && "error" in detection ? detection.error : null;

  async function run() {
    const detected = detectInput(input);
    if ("error" in detected) {
      setError(detected.error);
      setStatus("error");
      setResult(null);
      return;
    }

    const id = ++runId.current;
    setStatus("loading");
    setError(null);
    setResult(null);

    try {
      let next: ResultState;
      if (detected.mode === "tx") {
        const { tx, logs } = await fetchTxData(detected.value);
        const plainTransfer =
          tx.to !== null && (tx.input === "0x" || tx.input.length <= 2);
        let call: CalldataResult | null = null;
        if (tx.to !== null && !plainTransfer) {
          const toAbi = await fetchContractAbi(tx.to);
          call = await resolveAndDecodeCalldata(tx.input, { toAbi });
        }
        const decodedLogs = await decodeLogs(logs);
        next = { kind: "tx", tx, call, plainTransfer, logs: decodedLogs };
      } else {
        const call = await resolveAndDecodeCalldata(detected.value, {
          toAbi: null,
        });
        next = { kind: "calldata", call };
      }

      if (id !== runId.current) return;
      setResult(next);
      setStatus("done");
    } catch (caught) {
      if (id !== runId.current) return;
      setError(errorMessage(caught));
      setStatus("error");
    }
  }

  const canSubmit = detectedMode !== null && status !== "loading";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && canSubmit) run();
            }}
            placeholder="0x… transaction hash or calldata"
            spellCheck={false}
            autoComplete="off"
            className="font-mono"
            aria-invalid={detectionError != null}
          />
          <Button
            type="button"
            onClick={run}
            disabled={!canSubmit}
            className="sm:w-28"
          >
            {status === "loading" ? (
              <>
                <Loader2 className="animate-spin" />
                Decoding
              </>
            ) : (
              "Decode"
            )}
          </Button>
        </div>

        <div className="min-h-5 text-xs">
          {detectionError ? (
            <span className="text-destructive">{detectionError}</span>
          ) : detectedMode ? (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              Detected
              <Badge variant="secondary">
                {detectedMode === "tx" ? "Transaction hash" : "Raw calldata"}
              </Badge>
            </span>
          ) : (
            <span className="text-muted-foreground">
              Paste a transaction hash (32 bytes) or raw calldata (0x + a 4-byte
              selector).
            </span>
          )}
        </div>
      </div>

      {status === "loading" ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      ) : null}

      {status === "error" && error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Could not decode</AlertTitle>
          <AlertDescription>
            <p>{error}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 w-fit"
              onClick={run}
              disabled={!detectedMode}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {status === "done" && result?.kind === "tx" ? (
        <div className="space-y-4">
          <OverviewCard tx={result.tx} />

          {result.tx.to === null ? (
            <Alert>
              <Info />
              <AlertTitle>Contract creation</AlertTitle>
              <AlertDescription>
                This transaction deployed a contract. The deployed address is
                shown in the overview above.
              </AlertDescription>
            </Alert>
          ) : result.plainTransfer ? (
            <Alert>
              <Info />
              <AlertTitle>Plain ETH transfer</AlertTitle>
              <AlertDescription>
                No calldata. This transaction only moved ETH.
              </AlertDescription>
            </Alert>
          ) : result.call ? (
            <DecodedCall result={result.call} />
          ) : null}

          <DecodedLogs logs={result.logs} />
        </div>
      ) : null}

      {status === "done" && result?.kind === "calldata" ? (
        <div className="space-y-4">
          <Alert>
            <Info />
            <AlertTitle>Calldata only</AlertTitle>
            <AlertDescription>
              Decoding raw calldata: the ETH value, sender, and target contract
              are unknown without a transaction.
            </AlertDescription>
          </Alert>
          <DecodedCall result={result.call} />
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Transaction lookups go to the Robinhood Chain RPC and the Blockscout
        explorer. Unknown function selectors are looked up on openchain.xyz,
        where only the 4-byte selector is sent, never your full calldata.
      </p>
    </div>
  );
}
