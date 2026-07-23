"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, RotateCw, Loader2, ShieldCheck, X } from "lucide-react";
import { type Address, BaseError, erc20Abi, type Hash } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { toast } from "sonner";

import { AddressDisplay } from "@/components/address-display";
import { ShareResult } from "@/components/share-card";
import { WalletGate } from "@/components/wallet-gate";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RevokeDialog } from "@/components/tools/approvals/revoke-dialog";
import {
  type ApprovalRow,
  scanApprovals,
  UNLIMITED_THRESHOLD,
} from "@/components/tools/approvals/scan";
import { publicClient } from "@/lib/public-client";
import { formatTokenAmount, truncateAddress } from "@/lib/format";

export function ApprovalsTool() {
  return (
    <WalletGate>
      <ApprovalsScanner />
    </WalletGate>
  );
}

function ApprovalsScanner() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [revokeRow, setRevokeRow] = useState<ApprovalRow | null>(null);
  const [revokingKey, setRevokingKey] = useState<string | null>(null);
  const [lastRevoked, setLastRevoked] = useState<{
    symbol: string;
    spender: Address;
    txHash: Hash;
  } | null>(null);

  const runScan = useCallback(async (owner: Address) => {
    setScanning(true);
    setError(null);
    setLastRevoked(null);
    setProgress("Starting scan…");
    try {
      const result = await scanApprovals(owner, setProgress);
      setRows(result);
      setScanned(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setScanning(false);
    }
  }, []);

  // Auto-run once when the wallet is connected (and again if the account changes).
  const lastScannedAccount = useRef<Address | null>(null);
  useEffect(() => {
    if (!address) return;
    if (lastScannedAccount.current === address) return;
    lastScannedAccount.current = address;
    void runScan(address);
  }, [address, runScan]);

  const revoke = useCallback(
    async (row: ApprovalRow) => {
      if (!address) return;
      setRevokingKey(row.key);
      try {
        const hash = await writeContractAsync({
          address: row.token,
          abi: erc20Abi,
          functionName: "approve",
          args: [row.spender, 0n],
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === "reverted") {
          throw new Error("The revoke transaction reverted on-chain.");
        }

        const current = await publicClient.readContract({
          address: row.token,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address, row.spender],
        });

        if (current === 0n) {
          setRows((prev) => prev.filter((r) => r.key !== row.key));
          setLastRevoked({
            symbol: row.tokenSymbol,
            spender: row.spender,
            txHash: hash,
          });
          toast.success(`Revoked ${row.tokenSymbol} approval`);
        } else {
          setRows((prev) =>
            prev.map((r) =>
              r.key === row.key
                ? {
                    ...r,
                    allowance: current,
                    isUnlimited: current >= UNLIMITED_THRESHOLD,
                  }
                : r,
            ),
          );
          toast.message("Allowance changed but is still non-zero.");
        }
        setRevokeRow(null);
      } catch (err) {
        toast.error("Revoke failed", { description: errorMessage(err) });
      } finally {
        setRevokingKey(null);
      }
    },
    [address, writeContractAsync],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {scanned && !scanning
            ? `${rows.length} active ${rows.length === 1 ? "approval" : "approvals"}`
            : "ERC-20 spending approvals granted by your wallet."}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => address && void runScan(address)}
          disabled={scanning || !address}
        >
          {scanning ? <Loader2 className="animate-spin" /> : <RotateCw />}
          {scanned ? "Rescan" : "Scan approvals"}
        </Button>
      </div>

      {lastRevoked ? (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-foreground">
                  <CheckCircle2 className="size-5" />
                </span>
                <div className="space-y-0.5">
                  <p className="font-heading text-sm font-medium">
                    {lastRevoked.symbol} approval revoked
                  </p>
                  <p className="text-sm text-muted-foreground">
                    The spender can no longer move your {lastRevoked.symbol}.
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Dismiss"
                onClick={() => setLastRevoked(null)}
              >
                <X />
              </Button>
            </div>
            <ShareResult
              content={{
                tool: "Token approvals",
                headline: {
                  value: lastRevoked.symbol,
                  text: "approval revoked",
                },
                subline: {
                  text: `Spender ${truncateAddress(lastRevoked.spender)}`,
                },
                detail: truncateAddress(lastRevoked.txHash),
              }}
              filename="robins-revoke.png"
              title={`${lastRevoked.symbol} approval revoked`}
              shareText="Revoked a token approval on Robinhood Chain with robins.tools"
            />
          </CardContent>
        </Card>
      ) : null}

      {scanning ? (
        <Alert>
          <Loader2 className="animate-spin" />
          <AlertTitle>Scanning…</AlertTitle>
          <AlertDescription>
            {progress || "Reading the chain…"}
          </AlertDescription>
        </Alert>
      ) : null}

      {error && !scanning ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t complete the scan</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => address && void runScan(address)}
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {scanned && !scanning && !error && rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/15 text-foreground">
              <ShieldCheck className="size-6" />
            </div>
            <div className="space-y-1">
              <p className="font-heading text-base font-medium">
                No active approvals
              </p>
              <p className="max-w-sm text-sm text-muted-foreground">
                This wallet hasn&apos;t granted any live ERC-20 allowances.
                Clean wallet.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!scanning && rows.length > 0 ? (
        <div className="rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Token</TableHead>
                <TableHead>Spender</TableHead>
                <TableHead>Allowance</TableHead>
                <TableHead>Approved</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{row.tokenSymbol}</span>
                      <AddressDisplay
                        address={row.token}
                        copyable={false}
                        className="text-muted-foreground"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      {row.spenderName ? (
                        <span className="max-w-[12rem] truncate font-medium">
                          {row.spenderName}
                        </span>
                      ) : null}
                      <AddressDisplay
                        address={row.spender}
                        className="text-muted-foreground"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    {row.isUnlimited ? (
                      <Badge variant="destructive">Unlimited</Badge>
                    ) : (
                      <span className="font-mono">
                        {formatTokenAmount(row.allowance, row.tokenDecimals)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatAge(row.timestamp)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setRevokeRow(row)}
                      disabled={revokingKey !== null}
                    >
                      {revokingKey === row.key ? (
                        <Loader2 className="animate-spin" />
                      ) : null}
                      Revoke
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        The scan reads approval history directly from the chain. Spender names,
        when shown, come from verified contracts on Blockscout.
      </p>

      <RevokeDialog
        row={revokeRow}
        onOpenChange={(open) => {
          if (!open) setRevokeRow(null);
        }}
        onConfirm={() => revokeRow && void revoke(revokeRow)}
        isRevoking={revokeRow !== null && revokingKey === revokeRow.key}
      />
    </div>
  );
}

function formatAge(timestamp: number | null): string {
  if (timestamp === null) return "-";
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - timestamp);
  const days = Math.floor(seconds / 86400);
  if (days >= 1) return `${days}d ago`;
  const hours = Math.floor(seconds / 3600);
  if (hours >= 1) return `${hours}h ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes >= 1) return `${minutes}m ago`;
  return "just now";
}

function errorMessage(err: unknown): string {
  if (err instanceof BaseError) return err.shortMessage;
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}
