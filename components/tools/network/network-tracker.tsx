"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ExternalLink,
  Pause,
  Play,
  RotateCw,
} from "lucide-react";
import { formatGwei } from "viem";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RPC_URL, robinhoodChain } from "@/lib/chain";
import { EXPLORER_URL, blockUrl } from "@/lib/explorer";
import { publicClient } from "@/lib/public-client";
import { cn } from "@/lib/utils";

const POLL_INTERVAL = 5000;
const BLOCK_SAMPLE = 30;
const TABLE_ROWS = 10;

interface BlockRow {
  number: bigint;
  timestamp: number;
  txCount: number;
  gasUsed: bigint;
  gasLimit: bigint;
}

interface Snapshot {
  gasPriceWei: bigint;
  latestBlockNumber: bigint;
  latestBlockTimestamp: number;
  avgBlockTimeSec: number | null;
  latencyMs: number;
  blocks: BlockRow[];
}

async function fetchSnapshot(): Promise<Snapshot> {
  const start = performance.now();
  const [gasPriceWei, tip] = await Promise.all([
    publicClient.getGasPrice(),
    publicClient.getBlockNumber(),
  ]);

  const numbers: bigint[] = [];
  for (let i = 0; i < BLOCK_SAMPLE; i++) {
    const n = tip - BigInt(i);
    if (n < 0n) break;
    numbers.push(n);
  }
  const blocks = await Promise.all(
    numbers.map((n) => publicClient.getBlock({ blockNumber: n })),
  );
  const latencyMs = performance.now() - start;

  const timestamps = blocks.map((block) => Number(block.timestamp));
  let avgBlockTimeSec: number | null = null;
  if (timestamps.length > 1) {
    const span = timestamps[0] - timestamps[timestamps.length - 1];
    avgBlockTimeSec = span / (timestamps.length - 1);
  }

  const rows: BlockRow[] = blocks.slice(0, TABLE_ROWS).map((block, index) => ({
    number: numbers[index],
    timestamp: Number(block.timestamp),
    txCount: block.transactions.length,
    gasUsed: block.gasUsed,
    gasLimit: block.gasLimit,
  }));

  return {
    gasPriceWei,
    latestBlockNumber: tip,
    latestBlockTimestamp: Number(blocks[0].timestamp),
    avgBlockTimeSec,
    latencyMs,
    blocks: rows,
  };
}

/** Round to `digits` significant figures and drop trailing zeros. */
function toSignificant(value: number, digits: number): string {
  if (!Number.isFinite(value) || value === 0) return "0";
  return Number(value.toPrecision(digits)).toString();
}

function ageLabel(timestamp: number, nowSec: number): string {
  const seconds = Math.max(0, nowSec - timestamp);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

type Health = "lime" | "amber" | "red";

const healthDotClass: Record<Health, string> = {
  lime: "bg-accent-text",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

function StatCard({
  label,
  value,
  sub,
  accessory,
  stale,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accessory?: ReactNode;
  stale?: boolean;
}) {
  return (
    <Card size="sm" className={cn("gap-0", stale && "opacity-50")}>
      <CardContent className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {accessory}
        </div>
        <div className="font-mono text-xl font-semibold tabular-nums">
          {value}
        </div>
        {sub ? (
          <div className="font-mono text-xs text-muted-foreground tabular-nums">
            {sub}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function NetworkTracker() {
  const [paused, setPaused] = useState(false);
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  const { data, isError, isFetching, isLoading, refetch } = useQuery({
    queryKey: ["network-snapshot"],
    queryFn: fetchSnapshot,
    refetchInterval: paused ? false : POLL_INTERVAL,
  });

  useEffect(() => {
    const id = setInterval(
      () => setNowSec(Math.floor(Date.now() / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, []);

  const stale = isError && Boolean(data);
  const health: Health = isError
    ? "red"
    : data
      ? data.latencyMs < 1000
        ? "lime"
        : data.latencyMs < 3000
          ? "amber"
          : "red"
      : "amber";

  const gasGwei = data ? Number(formatGwei(data.gasPriceWei)) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "size-2.5 rounded-full",
              healthDotClass[health],
              !paused && !isError && "animate-pulse",
            )}
            aria-hidden
          />
          <span className="text-sm text-muted-foreground">
            {isError
              ? "RPC unreachable"
              : paused
                ? "Paused"
                : isLoading
                  ? "Connecting…"
                  : "Live"}
            {data ? ` · ${Math.round(data.latencyMs)} ms` : null}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPaused((prev) => !prev)}
        >
          {paused ? (
            <Play data-icon="inline-start" />
          ) : (
            <Pause data-icon="inline-start" />
          )}
          {paused ? "Resume" : "Pause"}
        </Button>
      </div>

      {isError && !data ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 py-6 text-sm">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-4" />
              <span className="font-medium">Cannot reach the chain RPC</span>
            </div>
            <p className="text-muted-foreground">
              The request to {RPC_URL} failed. Check your connection and retry.
            </p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              <RotateCw data-icon="inline-start" />
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Gas price"
          stale={stale}
          value={
            data ? (
              <>
                {toSignificant(gasGwei, 4)}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  gwei
                </span>
              </>
            ) : (
              <Skeleton className="h-6 w-24" />
            )
          }
        />
        <StatCard
          label="Latest block"
          stale={stale}
          value={
            data ? (
              `#${data.latestBlockNumber.toLocaleString("en-US")}`
            ) : (
              <Skeleton className="h-6 w-24" />
            )
          }
          sub={data ? ageLabel(data.latestBlockTimestamp, nowSec) : undefined}
        />
        <StatCard
          label="Avg block time"
          stale={stale}
          value={
            data ? (
              data.avgBlockTimeSec !== null ? (
                <>
                  {data.avgBlockTimeSec.toFixed(2)}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    s
                  </span>
                </>
              ) : (
                "-"
              )
            ) : (
              <Skeleton className="h-6 w-24" />
            )
          }
          sub={data ? `over last ${data.blocks.length} blocks` : undefined}
        />
        <StatCard
          label="RPC latency"
          stale={stale}
          accessory={
            <span
              className={cn("size-2.5 rounded-full", healthDotClass[health])}
              aria-hidden
            />
          }
          value={
            data ? (
              <>
                {Math.round(data.latencyMs)}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  ms
                </span>
              </>
            ) : (
              <Skeleton className="h-6 w-24" />
            )
          }
          sub={
            data
              ? health === "lime"
                ? "healthy"
                : health === "amber"
                  ? "slow"
                  : "degraded"
              : undefined
          }
        />
      </div>

      {/* Chain info */}
      <Card size="sm">
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-0.5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Chain ID
            </p>
            <p className="font-mono text-sm">{robinhoodChain.id}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Native currency
            </p>
            <p className="font-mono text-sm">
              {robinhoodChain.nativeCurrency.symbol}
              <span className="text-muted-foreground">
                {" "}
                ({robinhoodChain.nativeCurrency.name},{" "}
                {robinhoodChain.nativeCurrency.decimals})
              </span>
            </p>
          </div>
          <div className="min-w-0 space-y-0.5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              RPC endpoint
            </p>
            <p className="truncate font-mono text-sm" title={RPC_URL}>
              {RPC_URL}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Explorer
            </p>
            <a
              href={EXPLORER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-sm text-accent-text hover:underline"
            >
              Blockscout
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Latest blocks */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-sm font-medium">Latest blocks</h2>
          {isFetching && !isError ? (
            <span className="text-xs text-muted-foreground">refreshing…</span>
          ) : null}
        </div>
        <div
          className={cn(
            "overflow-hidden rounded-xl ring-1 ring-foreground/10",
            stale && "opacity-50",
          )}
        >
          <style>
            {
              "@keyframes rt-slide-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}.rt-slide-in{animation:rt-slide-in .35s ease-out}"
            }
          </style>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Block</TableHead>
                <TableHead>Age</TableHead>
                <TableHead className="text-right">Txns</TableHead>
                <TableHead className="text-right">Gas used</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data
                ? data.blocks.map((block) => {
                    const pct =
                      block.gasLimit > 0n
                        ? (Number(block.gasUsed) / Number(block.gasLimit)) * 100
                        : 0;
                    const pctLabel =
                      pct === 0
                        ? "0%"
                        : pct < 0.01
                          ? "<0.01%"
                          : `${pct.toFixed(2)}%`;
                    return (
                      <TableRow
                        key={block.number.toString()}
                        className="rt-slide-in"
                      >
                        <TableCell>
                          <a
                            href={blockUrl(block.number)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-sm text-accent-text hover:underline"
                          >
                            #{block.number.toLocaleString("en-US")}
                          </a>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {ageLabel(block.timestamp, nowSec)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums">
                          {block.txCount}
                        </TableCell>
                        <TableCell>
                          <div
                            className="ml-auto flex w-28 flex-col items-end gap-1"
                            title={`${block.gasUsed.toLocaleString("en-US")} gas · ${pctLabel} of limit`}
                          >
                            <span className="font-mono text-xs tabular-nums text-muted-foreground">
                              {block.gasUsed.toLocaleString("en-US")}
                            </span>
                            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{
                                  width: `${Math.min(100, Math.max(pct, pct > 0 ? 1 : 0))}%`,
                                }}
                              />
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                : Array.from({ length: TABLE_ROWS }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-12" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="ml-auto h-4 w-8" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="ml-auto h-4 w-24" />
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">
          Polls the chain RPC every {POLL_INTERVAL / 1000}s. Sub-second blocks
          mean each poll shows the current tip and the blocks just before it,
          not every block.
        </p>
      </div>
    </div>
  );
}
