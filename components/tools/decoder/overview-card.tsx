import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

import { AddressDisplay } from "@/components/address-display";
import { CopyButton } from "@/components/copy-button";
import { Badge } from "@/components/ui/badge";
import { blockUrl, txUrl } from "@/lib/explorer";
import { formatTokenAmount } from "@/lib/format";

import type { TxOverview } from "./types";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: TxOverview["status"] }) {
  if (status === "success") return <Badge>Success</Badge>;
  if (status === "reverted")
    return <Badge variant="destructive">Reverted</Badge>;
  return <Badge variant="outline">Pending</Badge>;
}

function formatTimestamp(timestamp: bigint | null): string {
  if (timestamp == null) return "-";
  return new Date(Number(timestamp) * 1000).toLocaleString();
}

export function OverviewCard({ tx }: { tx: TxOverview }) {
  return (
    <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-sm font-medium">Transaction</h2>
          <StatusBadge status={tx.status} />
        </div>
        <div className="flex min-w-0 items-center gap-1">
          <span className="truncate font-mono text-xs text-muted-foreground">
            {tx.hash}
          </span>
          <CopyButton value={tx.hash} label="Copy transaction hash" />
          <a
            href={txUrl(tx.hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label="View transaction on explorer"
          >
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Block">
          {tx.blockNumber != null ? (
            <a
              href={blockUrl(tx.blockNumber)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm text-accent-text underline-offset-4 hover:underline"
            >
              {tx.blockNumber.toString()}
            </a>
          ) : (
            <span className="text-muted-foreground">Pending</span>
          )}
        </Field>

        <Field label="Timestamp">
          <span className="text-sm">{formatTimestamp(tx.timestamp)}</span>
        </Field>

        <Field label="Nonce">
          <span className="font-mono text-sm">{tx.nonce}</span>
        </Field>

        <Field label="From">
          <AddressDisplay address={tx.from} />
        </Field>

        <Field label={tx.to ? "To" : "Contract created"}>
          {tx.to ? (
            <AddressDisplay address={tx.to} />
          ) : tx.contractAddress ? (
            <AddressDisplay address={tx.contractAddress} />
          ) : (
            <span className="text-muted-foreground">Contract creation</span>
          )}
        </Field>

        <Field label="Value">
          <span className="font-mono text-sm">
            {formatTokenAmount(tx.value, 18, 9)} ETH
          </span>
        </Field>

        <Field label="Fee">
          {tx.fee != null ? (
            <span className="font-mono text-sm">
              {formatTokenAmount(tx.fee, 18, 12)} ETH
            </span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </Field>

        <Field label="Gas used">
          <span className="font-mono text-sm">
            {tx.gasUsed != null ? tx.gasUsed.toLocaleString("en-US") : "-"}
          </span>
        </Field>

        <Field label="Gas price">
          <span className="font-mono text-sm">
            {tx.effectiveGasPrice != null
              ? `${formatTokenAmount(tx.effectiveGasPrice, 9, 4)} gwei`
              : "-"}
          </span>
        </Field>
      </dl>
    </section>
  );
}
