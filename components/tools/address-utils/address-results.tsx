"use client";

import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { InvalidEntry, ParsedEntry } from "@/lib/parse-addresses";

const PREVIEW_LIMIT = 50;

interface AddressResultsProps {
  totalRows: number;
  validCount: number;
  invalid: InvalidEntry[];
  duplicatesRemoved: number;
  cleaned: ParsedEntry[];
  hasAmounts: boolean;
}

/** Stat badges, a problems table (when any rows failed), and a preview of the cleaned list. */
export function AddressResults({
  totalRows,
  validCount,
  invalid,
  duplicatesRemoved,
  cleaned,
  hasAmounts,
}: AddressResultsProps) {
  const preview = cleaned.slice(0, PREVIEW_LIMIT);
  const remaining = cleaned.length - preview.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">
          {totalRows} row{totalRows === 1 ? "" : "s"}
        </Badge>
        <Badge variant="secondary">{validCount} valid</Badge>
        <Badge variant={invalid.length > 0 ? "destructive" : "outline"}>
          {invalid.length} invalid
        </Badge>
        <Badge variant="outline">
          {duplicatesRemoved} duplicate{duplicatesRemoved === 1 ? "" : "s"}{" "}
          removed
        </Badge>
      </div>

      {invalid.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <AlertTriangle className="size-4 text-destructive" />
            Problems ({invalid.length})
          </div>
          <div className="max-h-64 overflow-y-auto rounded-lg ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">Line</TableHead>
                  <TableHead>Raw content</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invalid.map((entry, index) => (
                  <TableRow key={`${entry.line}-${index}`}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {entry.line}
                    </TableCell>
                    <TableCell className="max-w-56 truncate font-mono text-xs">
                      {entry.raw}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {entry.reason}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-sm font-medium">
          Preview ({preview.length} of {cleaned.length})
        </p>
        {cleaned.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No valid addresses yet.
          </p>
        ) : (
          <div className="max-h-96 overflow-y-auto rounded-lg ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Address</TableHead>
                  {hasAmounts ? <TableHead>Amount</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((entry, index) => (
                  <TableRow key={`${entry.address}-${index}`}>
                    <TableCell className="text-xs text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {entry.address}
                    </TableCell>
                    {hasAmounts ? (
                      <TableCell className="font-mono text-xs">
                        {entry.amount ?? "-"}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {remaining > 0 ? (
          <p className="text-xs text-muted-foreground">
            {remaining} more row{remaining === 1 ? "" : "s"} included in the
            export.
          </p>
        ) : null}
      </div>
    </div>
  );
}
