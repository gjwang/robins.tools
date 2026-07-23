"use client";

import { useState } from "react";
import { type Abi, type AbiFunction, parseEther } from "viem";
import { useAccount, useWalletClient } from "wagmi";
import { CheckCircle2, ExternalLink, Loader2, XCircle } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArgFields,
  type ArgValues,
  initialArgValues,
} from "@/components/tools/contract/arg-fields";
import { buildArgs, errorMessage } from "@/components/tools/contract/lib";
import { robinhoodChain } from "@/lib/chain";
import { txUrl } from "@/lib/explorer";
import { truncateAddress } from "@/lib/format";
import { publicClient } from "@/lib/public-client";

type WriteStatus =
  | "idle"
  | "simulating"
  | "awaiting-signature"
  | "pending"
  | "success"
  | "reverted"
  | "error";

interface WriteFunctionProps {
  address: `0x${string}`;
  abi: Abi;
  fn: AbiFunction;
  idPrefix: string;
  /** Wallet is connected to the correct network and ready to send. */
  canWrite: boolean;
}

export function WriteFunction({
  address,
  abi,
  fn,
  idPrefix,
  canWrite,
}: WriteFunctionProps) {
  const { address: account } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [values, setValues] = useState<ArgValues>(() =>
    initialArgValues(fn.inputs),
  );
  const [ethValue, setEthValue] = useState("");
  const [status, setStatus] = useState<WriteStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<`0x${string}` | null>(null);

  const isPayable = fn.stateMutability === "payable";
  const busy =
    status === "simulating" ||
    status === "awaiting-signature" ||
    status === "pending";

  function setValue(index: number, value: string | boolean) {
    setValues((prev) => ({ ...prev, [index]: value }));
  }

  async function onWrite() {
    setError(null);
    setHash(null);

    let args: unknown[];
    try {
      args = buildArgs(fn.inputs, values);
    } catch (buildError) {
      setStatus("error");
      setError(errorMessage(buildError));
      return;
    }

    let value: bigint | undefined;
    if (isPayable) {
      try {
        value = ethValue.trim() ? parseEther(ethValue.trim()) : 0n;
      } catch {
        setStatus("error");
        setError("Enter a valid ETH amount (e.g. 0.1).");
        return;
      }
    }

    if (!walletClient || !account) {
      setStatus("error");
      setError("Connect a wallet to send this transaction.");
      return;
    }

    setStatus("simulating");
    try {
      await publicClient.simulateContract({
        address,
        abi,
        functionName: fn.name,
        args,
        account,
        value,
      });
    } catch (simulateError) {
      setStatus("error");
      setError(errorMessage(simulateError));
      return;
    }

    setStatus("awaiting-signature");
    let txHash: `0x${string}`;
    try {
      txHash = await walletClient.writeContract({
        address,
        abi,
        functionName: fn.name,
        args,
        account,
        value,
        chain: robinhoodChain,
      });
    } catch (writeError) {
      setStatus("error");
      setError(errorMessage(writeError));
      return;
    }

    setHash(txHash);
    setStatus("pending");
    try {
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });
      setStatus(receipt.status === "success" ? "success" : "reverted");
    } catch (receiptError) {
      setStatus("error");
      setError(errorMessage(receiptError));
    }
  }

  return (
    <div className="space-y-4">
      <ArgFields
        inputs={fn.inputs}
        values={values}
        onChange={setValue}
        idPrefix={idPrefix}
        disabled={busy}
      />

      {isPayable ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-eth-value`} className="gap-1.5">
            <span>Value</span>
            <span className="text-xs font-normal text-muted-foreground">
              ETH
            </span>
          </Label>
          <Input
            id={`${idPrefix}-eth-value`}
            value={ethValue}
            onChange={(event) => setEthValue(event.target.value)}
            placeholder="0.0"
            inputMode="decimal"
            spellCheck={false}
            autoComplete="off"
            disabled={busy}
            className="font-mono"
          />
        </div>
      ) : null}

      <Button onClick={onWrite} disabled={busy || !canWrite} size="sm">
        {busy ? <Loader2 className="animate-spin" /> : null}
        {status === "simulating"
          ? "Simulating…"
          : status === "awaiting-signature"
            ? "Confirm in wallet…"
            : status === "pending"
              ? "Sending…"
              : "Simulate & Write"}
      </Button>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {hash ? (
        <Alert>
          <AlertDescription className="space-y-1">
            <div className="flex items-center gap-2">
              {status === "pending" ? (
                <Loader2 className="size-4 shrink-0 animate-spin" />
              ) : status === "success" ? (
                <CheckCircle2 className="size-4 shrink-0 text-accent-text" />
              ) : status === "reverted" ? (
                <XCircle className="size-4 shrink-0 text-destructive" />
              ) : null}
              <span className="text-foreground">
                {status === "pending"
                  ? "Transaction sent, waiting for confirmation…"
                  : status === "success"
                    ? "Transaction confirmed."
                    : status === "reverted"
                      ? "Transaction reverted on-chain."
                      : "Transaction submitted."}
              </span>
            </div>
            <a
              href={txUrl(hash)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
            >
              {truncateAddress(hash, 8)}
              <ExternalLink className="size-3" />
            </a>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
