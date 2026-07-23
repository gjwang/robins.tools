"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Download } from "lucide-react";
import { formatUnits } from "viem";

import { AddressDisplay } from "@/components/address-display";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTokenAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BalanceColumn } from "@/components/tools/balances/fetch-balances";

interface ResultsTableProps {
  addresses: readonly `0x${string}`[];
  columns: readonly BalanceColumn[];
  /** balances[rowIndex][colIndex]; null = failed or not-yet-fetched. */
  balances: readonly (bigint | null)[][];
  fetching: boolean;
}

/** "address" or a column index (as a string) for the active sort key. */
type SortKey = "address" | number;
type SortDir = "asc" | "desc";

function sumColumn(
  balances: readonly (bigint | null)[][],
  colIndex: number,
): bigint {
  let total = 0n;
  for (const row of balances) {
    const value = row[colIndex];
    if (value !== null && value !== undefined) total += value;
  }
  return total;
}

/**
 * Escape one CSV field. Neutralizes spreadsheet formula injection (a leading
 * `=` `+` `-` `@` is prefixed with `'`) and RFC-4180-quotes any field containing
 * `"`, `,` or a newline (inner quotes doubled). On-chain `symbol()` strings are
 * attacker-controlled, so this runs on every header and data cell.
 */
function csvCell(value: string): string {
  let out = value;
  if (/^[=+\-@]/.test(out)) out = `'${out}`;
  if (/["\n,]/.test(out)) out = `"${out.replace(/"/g, '""')}"`;
  return out;
}

export function ResultsTable({
  addresses,
  columns,
  balances,
  fetching,
}: ResultsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("address");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const order = useMemo(() => {
    const indices = addresses.map((_, i) => i);
    const dir = sortDir === "asc" ? 1 : -1;
    indices.sort((a, b) => {
      if (sortKey === "address") {
        return addresses[a].toLowerCase() < addresses[b].toLowerCase()
          ? -dir
          : addresses[a].toLowerCase() > addresses[b].toLowerCase()
            ? dir
            : 0;
      }
      const va = balances[a]?.[sortKey] ?? null;
      const vb = balances[b]?.[sortKey] ?? null;
      // Nulls always sort to the bottom regardless of direction.
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return va < vb ? -dir : va > vb ? dir : 0;
    });
    return indices;
  }, [addresses, balances, sortKey, sortDir]);

  const totals = useMemo(
    () => columns.map((_, colIndex) => sumColumn(balances, colIndex)),
    [balances, columns],
  );

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "address" ? "asc" : "desc");
    }
  }

  function sortIcon(key: SortKey) {
    if (key !== sortKey) {
      return <ChevronsUpDown className="size-3.5 text-muted-foreground/60" />;
    }
    return sortDir === "asc" ? (
      <ArrowUp className="size-3.5" />
    ) : (
      <ArrowDown className="size-3.5" />
    );
  }

  function exportCsv() {
    const header = ["address", ...columns.map((c) => c.symbol)];
    const lines = [header.map(csvCell).join(",")];
    for (const rowIndex of order) {
      const cells: string[] = [addresses[rowIndex]];
      for (let c = 0; c < columns.length; c++) {
        const value = balances[rowIndex]?.[c] ?? null;
        cells.push(
          value === null ? "" : formatUnits(value, columns[c].decimals),
        );
      }
      lines.push(cells.map(csvCell).join(","));
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `balances-${Date.now()}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {addresses.length.toLocaleString("en-US")}{" "}
          {addresses.length === 1 ? "address" : "addresses"}
          {" · "}
          {columns.length} {columns.length === 1 ? "column" : "columns"}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={exportCsv}
          disabled={fetching}
        >
          <Download data-icon="inline-start" />
          Export CSV
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button
                  type="button"
                  onClick={() => toggleSort("address")}
                  className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                >
                  Address
                  {sortIcon("address")}
                </button>
              </TableHead>
              {columns.map((column, colIndex) => (
                <TableHead key={column.address ?? "eth"} className="text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort(colIndex)}
                    className="ml-auto inline-flex items-center gap-1 font-medium hover:text-foreground"
                  >
                    {column.symbol}
                    {sortIcon(colIndex)}
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.map((rowIndex) => (
              <TableRow key={addresses[rowIndex]}>
                <TableCell>
                  <AddressDisplay address={addresses[rowIndex]} />
                </TableCell>
                {columns.map((column, colIndex) => {
                  const value = balances[rowIndex]?.[colIndex] ?? null;
                  return (
                    <TableCell
                      key={column.address ?? "eth"}
                      className={cn(
                        "text-right font-mono tabular-nums",
                        value === null && "text-muted-foreground",
                      )}
                    >
                      {value === null
                        ? fetching
                          ? "…"
                          : "-"
                        : formatTokenAmount(value, column.decimals)}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-medium">Total</TableCell>
              {columns.map((column, colIndex) => (
                <TableCell
                  key={column.address ?? "eth"}
                  className="text-right font-mono font-medium tabular-nums"
                >
                  {formatTokenAmount(totals[colIndex], column.decimals)}
                </TableCell>
              ))}
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}
