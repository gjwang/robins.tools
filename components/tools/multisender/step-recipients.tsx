"use client";

import { useRef } from "react";
import { AlertTriangle, Download, Upload } from "lucide-react";
import Papa from "papaparse";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ParseResult, ParsedEntry } from "@/lib/parse-addresses";

import type { ComputeResult } from "./lib/compute";
import { MAX_RECIPIENTS } from "./lib/constants";
import type { AmountMode } from "./lib/types";
import { downloadTextFile, EXAMPLE_CSV } from "./lib/util";

type DedupeMode = "keep-first" | "merge-amounts";

interface StepRecipientsProps {
  symbol: string;
  rawText: string;
  onRawTextChange: (value: string) => void;
  mode: AmountMode;
  onModeChange: (mode: AmountMode) => void;
  fixedAmount: string;
  onFixedAmountChange: (value: string) => void;
  totalAmount: string;
  onTotalAmountChange: (value: string) => void;
  dedupeMode: DedupeMode;
  onDedupeModeChange: (mode: DedupeMode) => void;
  parseResult: ParseResult;
  finalEntries: ParsedEntry[];
  compute: ComputeResult;
  onBack: () => void;
  onNext: () => void;
}

const MODES: { value: AmountMode; title: string; hint: string }[] = [
  {
    value: "custom",
    title: "Custom per row",
    hint: "Each line sets its own amount",
  },
  {
    value: "fixed",
    title: "Fixed per wallet",
    hint: "Every wallet gets the same amount",
  },
  {
    value: "split",
    title: "Split total equally",
    hint: "Divide one total across all",
  },
  {
    value: "proportional",
    title: "Proportional weights",
    hint: "Share a total by weight",
  },
];

export function StepRecipients({
  symbol,
  rawText,
  onRawTextChange,
  mode,
  onModeChange,
  fixedAmount,
  onFixedAmountChange,
  totalAmount,
  onTotalAmountChange,
  dedupeMode,
  onDedupeModeChange,
  parseResult,
  finalEntries,
  compute,
  onBack,
  onNext,
}: StepRecipientsProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const duplicates = parseResult.entries.length - parseResult.uniqueCount;
  const overCap = finalEntries.length > MAX_RECIPIENTS;
  const canContinue =
    finalEntries.length > 0 && compute.errors.length === 0 && !overCap;

  function handleFile(file: File) {
    Papa.parse<string[]>(file, {
      skipEmptyLines: "greedy",
      complete: (result) => {
        const rows = result.data.filter((row) => row.length > 0);
        // Drop a leading header row (first cell is not an address).
        if (
          rows.length > 0 &&
          !/^0x[0-9a-fA-F]{40}$/.test((rows[0][0] ?? "").trim())
        ) {
          rows.shift();
        }
        const text = rows
          .map((row) => row.map((c) => c.trim()).join(","))
          .join("\n");
        onRawTextChange(text);
      },
    });
  }

  const needsAmountColumn = mode === "custom" || mode === "proportional";

  return (
    <div className="space-y-6">
      {/* Amount mode */}
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Amount mode</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={mode === m.value}
              onClick={() => onModeChange(m.value)}
              className={cn(
                "flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors",
                mode === m.value
                  ? "border-accent-text bg-primary/10"
                  : "border-border bg-background hover:bg-muted",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                  mode === m.value
                    ? "border-accent-text"
                    : "border-muted-foreground/40",
                )}
              >
                {mode === m.value ? (
                  <span className="size-2 rounded-full bg-accent-text" />
                ) : null}
              </span>
              <span>
                <span className="block text-sm font-medium">{m.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {m.hint}
                </span>
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      {/* Amount inputs for fixed / split / proportional */}
      {mode === "fixed" ? (
        <div className="space-y-1.5">
          <Label htmlFor="fixed-amount">Amount per wallet ({symbol})</Label>
          <Input
            id="fixed-amount"
            inputMode="decimal"
            placeholder="0.0"
            className="font-mono sm:max-w-xs"
            value={fixedAmount}
            onChange={(e) => onFixedAmountChange(e.target.value)}
          />
        </div>
      ) : null}
      {mode === "split" || mode === "proportional" ? (
        <div className="space-y-1.5">
          <Label htmlFor="total-amount">
            {mode === "split"
              ? "Total to split equally"
              : "Total to distribute by weight"}{" "}
            ({symbol})
          </Label>
          <Input
            id="total-amount"
            inputMode="decimal"
            placeholder="0.0"
            className="font-mono sm:max-w-xs"
            value={totalAmount}
            onChange={(e) => onTotalAmountChange(e.target.value)}
          />
        </div>
      ) : null}

      {/* Recipients input */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="recipients">Recipients</Label>
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              <Upload />
              Upload CSV
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                downloadTextFile("multisender-example.csv", EXAMPLE_CSV)
              }
            >
              <Download />
              Example
            </Button>
          </div>
        </div>
        <Textarea
          id="recipients"
          rows={8}
          spellCheck={false}
          className="font-mono text-sm"
          placeholder={
            needsAmountColumn
              ? `0x1234…,1.5\n0xabcd…,${mode === "proportional" ? "2" : "0.25"}`
              : "0x1234…\n0xabcd…"
          }
          value={rawText}
          onChange={(e) => onRawTextChange(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {needsAmountColumn
            ? mode === "custom"
              ? "One line per recipient: address, amount. Comma, tab, or space separated."
              : "One line per recipient: address, weight. Comma, tab, or space separated."
            : "One address per line. Comma, tab, or space separated; blank and # comment lines are ignored."}
        </p>
      </div>

      {/* Summary counts */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span>
          <span className="text-muted-foreground">Valid recipients: </span>
          <span className="font-mono font-medium">
            {parseResult.entries.length}
          </span>
        </span>
        <span>
          <span className="text-muted-foreground">Unique: </span>
          <span className="font-mono font-medium">
            {parseResult.uniqueCount}
          </span>
        </span>
        {parseResult.invalid.length > 0 ? (
          <span>
            <span className="text-muted-foreground">Invalid: </span>
            <span className="font-mono font-medium text-destructive">
              {parseResult.invalid.length}
            </span>
          </span>
        ) : null}
      </div>

      {/* Duplicates warning */}
      {duplicates > 0 ? (
        <Alert>
          <AlertTriangle />
          <AlertTitle>
            {duplicates} duplicate address{duplicates > 1 ? "es" : ""} found
          </AlertTitle>
          <AlertDescription>
            <p className="mb-2">Choose how repeated addresses are handled:</p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={dedupeMode === "keep-first" ? "default" : "outline"}
                onClick={() => onDedupeModeChange("keep-first")}
              >
                Keep first
              </Button>
              <Button
                type="button"
                size="sm"
                variant={dedupeMode === "merge-amounts" ? "default" : "outline"}
                onClick={() => onDedupeModeChange("merge-amounts")}
              >
                Merge amounts
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Over cap */}
      {overCap ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Too many recipients</AlertTitle>
          <AlertDescription>
            {finalEntries.length} recipients exceeds the {MAX_RECIPIENTS} cap
            per run. Split the list across multiple runs.
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Compute errors */}
      {compute.errors.length > 0 ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Fix these before continuing</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-4">
              {compute.errors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Invalid rows table */}
      {parseResult.invalid.length > 0 ? (
        <div className="rounded-lg border">
          <div className="border-b px-3 py-2 text-sm font-medium">
            Invalid rows ({parseResult.invalid.length})
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Line</TableHead>
                <TableHead>Content</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parseResult.invalid.slice(0, 50).map((row) => (
                <TableRow key={`${row.line}-${row.raw}`}>
                  <TableCell className="font-mono text-muted-foreground">
                    {row.line}
                  </TableCell>
                  <TableCell className="max-w-[16rem] truncate font-mono text-xs">
                    {row.raw}
                  </TableCell>
                  <TableCell className="text-xs text-destructive">
                    {row.reason}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {parseResult.invalid.length > 50 ? (
            <div className="border-t px-3 py-2 text-xs text-muted-foreground">
              …and {parseResult.invalid.length - 50} more
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button disabled={!canContinue} onClick={onNext}>
          Review
        </Button>
      </div>
    </div>
  );
}
