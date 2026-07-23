import { CopyButton } from "@/components/copy-button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { ArgValue, paramTypeLabel } from "./arg-value";
import type { AbiSource, CalldataResult } from "./types";

const sourceLabels: Record<AbiSource, string> = {
  explorer: "Explorer ABI",
  local: "Local ABI",
  signature: "Signature DB",
};

function jsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

export function DecodedCall({ result }: { result: CalldataResult }) {
  const { decoded, source, selector, calldata, words } = result;

  const argsJson = decoded
    ? JSON.stringify(
        Object.fromEntries(decoded.args.map((arg) => [arg.name, arg.value])),
        jsonReplacer,
        2,
      )
    : null;

  return (
    <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-sm font-medium">Decoded call</h2>
          {source ? (
            <Badge variant="secondary">{sourceLabels[source]}</Badge>
          ) : (
            <Badge variant="outline">Unknown selector</Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="font-mono text-xs text-muted-foreground">
            selector {selector}
          </span>
          <CopyButton value={calldata} label="Copy calldata" />
        </div>
      </div>

      {decoded ? (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <code className="rounded-md bg-muted px-2 py-1 font-mono text-sm break-all">
              {decoded.signature}
            </code>
            {argsJson ? (
              <CopyButton value={argsJson} label="Copy args as JSON" />
            ) : null}
          </div>

          {decoded.args.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Name</TableHead>
                  <TableHead className="w-32">Type</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {decoded.args.map((arg, i) => (
                  <TableRow key={i} className="align-top">
                    <TableCell className="align-top font-mono text-sm break-all whitespace-normal">
                      {arg.name}
                    </TableCell>
                    <TableCell className="align-top font-mono text-xs whitespace-normal text-muted-foreground">
                      {paramTypeLabel(arg.param)}
                    </TableCell>
                    <TableCell className="align-top whitespace-normal">
                      <ArgValue param={arg.param} value={arg.value} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              This function takes no arguments.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            No ABI matched this selector. The argument data is shown below as
            raw 32-byte words.
          </p>
          {words.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Offset</TableHead>
                  <TableHead>Word</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {words.map((word) => (
                  <TableRow key={word.offset}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      0x{word.offset.toString(16).padStart(2, "0")}
                    </TableCell>
                    <TableCell className="font-mono text-xs break-all whitespace-normal">
                      {word.word}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              No argument data. This is a bare selector.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
