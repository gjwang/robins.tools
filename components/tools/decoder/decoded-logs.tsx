import { ChevronDown } from "lucide-react";

import { AddressDisplay } from "@/components/address-display";
import { CopyButton } from "@/components/copy-button";
import { Badge } from "@/components/ui/badge";

import { ArgValue, paramTypeLabel } from "./arg-value";
import type { DecodedLog } from "./types";

function DecodedLogRow({ log }: { log: DecodedLog }) {
  const { decoded } = log;
  return (
    <div className="rounded-lg bg-muted/40 p-3 ring-1 ring-foreground/5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <code className="font-mono text-sm font-medium">{decoded?.name}</code>
          <Badge variant={log.source === "known" ? "secondary" : "outline"}>
            {log.source === "known" ? "Local ABI" : "Explorer ABI"}
          </Badge>
        </div>
        <AddressDisplay address={log.address} chars={4} />
      </div>
      {decoded && decoded.args.length > 0 ? (
        <div className="mt-2 space-y-1">
          {decoded.args.map((arg, i) => (
            <div key={i} className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-xs text-muted-foreground">
                {arg.name}
                <span className="ml-1 opacity-70">
                  {paramTypeLabel(arg.param)}
                </span>
              </span>
              <ArgValue param={arg.param} value={arg.value} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RawLogRow({ log }: { log: DecodedLog }) {
  return (
    <details className="group rounded-lg bg-muted/40 ring-1 ring-foreground/5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Undecoded log</span>
          <AddressDisplay address={log.address} chars={4} explorer={false} />
        </div>
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-2 px-3 pb-3">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Topics
          </p>
          <div className="space-y-1">
            {log.topics.map((topic, i) => (
              <div key={i} className="flex items-start gap-1">
                <span className="font-mono text-xs text-muted-foreground">
                  [{i}]
                </span>
                <span className="font-mono text-xs break-all">{topic}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-center gap-1">
            <p className="text-xs font-medium text-muted-foreground">Data</p>
            <CopyButton value={log.data} label="Copy log data" />
          </div>
          <p className="font-mono text-xs break-all">{log.data}</p>
        </div>
      </div>
    </details>
  );
}

export function DecodedLogs({ logs }: { logs: DecodedLog[] }) {
  if (logs.length === 0) {
    return (
      <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
        <h2 className="font-heading text-sm font-medium">Logs</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This transaction emitted no logs.
        </p>
      </section>
    );
  }

  const decodedCount = logs.filter((log) => log.decoded).length;

  return (
    <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-sm font-medium">Logs</h2>
        <span className="text-xs text-muted-foreground">
          {decodedCount} of {logs.length} decoded
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {logs.map((log, i) =>
          log.decoded ? (
            <DecodedLogRow key={i} log={log} />
          ) : (
            <RawLogRow key={i} log={log} />
          ),
        )}
      </div>
    </section>
  );
}
