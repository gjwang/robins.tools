"use client";

import { type ChangeEvent, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { Download, FileUp, Upload } from "lucide-react";
import { toast } from "sonner";

import { AddressResults } from "@/components/tools/address-utils/address-results";
import {
  downloadText,
  entriesToCsv,
  entriesToJson,
  entriesToTxt,
} from "@/components/tools/address-utils/export";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { dedupeEntries, parseAddressList } from "@/lib/parse-addresses";

const ACCEPTED_FORMATS =
  'One address per line, or "address,amount" separated by a comma, semicolon, tab, or whitespace. Blank lines and lines starting with # or // are skipped.';

type ExportFormat = "csv" | "json" | "txt";

/** Normalize an uploaded .csv file's text into the plain line format parseAddressList expects, respecting quoted fields. */
function normalizeCsv(text: string): string {
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
  return parsed.data
    .map((row) =>
      row
        .map((field) => field.trim())
        .filter((field) => field !== "")
        .join(","),
    )
    .filter((line) => line !== "")
    .join("\n");
}

/**
 * Paste or upload an address list, review validation/duplicate issues, and
 * export a cleaned CSV/JSON/TXT. Entirely client-side: parsing, deduping, and
 * downloads all happen in the browser.
 */
export function AddressUtilsTool() {
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [removeDuplicates, setRemoveDuplicates] = useState(true);
  const [sumAmounts, setSumAmounts] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseResult = useMemo(() => parseAddressList(rawText), [rawText]);

  const cleaned = useMemo(() => {
    if (!removeDuplicates) return parseResult.entries;
    return dedupeEntries(
      parseResult.entries,
      sumAmounts ? "merge-amounts" : "keep-first",
    );
  }, [parseResult.entries, removeDuplicates, sumAmounts]);

  const totalRows = parseResult.entries.length + parseResult.invalid.length;
  const duplicatesRemoved = removeDuplicates
    ? parseResult.entries.length - cleaned.length
    : 0;
  const hasInput = rawText.trim() !== "";

  async function handleFile(file: File) {
    try {
      const text = await file.text();
      const isCsv = file.name.toLowerCase().endsWith(".csv");
      setRawText(isCsv ? normalizeCsv(text) : text);
      setFileName(file.name);
    } catch {
      toast.error("Could not read that file.");
    }
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void handleFile(file);
    event.target.value = "";
  }

  function handleExport(format: ExportFormat) {
    if (cleaned.length === 0) return;
    if (format === "csv") {
      downloadText(
        "addresses-clean.csv",
        entriesToCsv(cleaned, parseResult.hasAmounts),
        "text/csv",
      );
    } else if (format === "json") {
      downloadText(
        "addresses-clean.json",
        entriesToJson(cleaned, parseResult.hasAmounts),
        "application/json",
      );
    } else {
      downloadText("addresses-clean.txt", entriesToTxt(cleaned), "text/plain");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="address-input">Addresses</Label>
            <div className="flex items-center gap-2">
              {fileName ? (
                <span className="text-xs text-muted-foreground">
                  {fileName}
                </span>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload data-icon="inline-start" />
                Upload file
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                className="hidden"
                onChange={handleFileInputChange}
              />
            </div>
          </div>
          <Textarea
            id="address-input"
            className="min-h-48 font-mono text-xs"
            spellCheck={false}
            placeholder={"0xAbC...123\n0xDeF...456,1.5"}
            value={rawText}
            onChange={(event) => {
              setRawText(event.target.value);
              setFileName(null);
            }}
          />
          {!hasInput ? (
            <p className="text-xs text-muted-foreground">{ACCEPTED_FORMATS}</p>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="dedupe"
              checked={removeDuplicates}
              onCheckedChange={(checked) =>
                setRemoveDuplicates(checked === true)
              }
            />
            <Label htmlFor="dedupe" className="font-normal">
              Remove duplicates
            </Label>
          </div>
          {parseResult.hasAmounts ? (
            <div className="flex items-center gap-2">
              <Checkbox
                id="sum-amounts"
                checked={sumAmounts}
                disabled={!removeDuplicates}
                onCheckedChange={(checked) => setSumAmounts(checked === true)}
              />
              <Label htmlFor="sum-amounts" className="font-normal">
                Keep amounts (sum on duplicates)
              </Label>
            </div>
          ) : null}
        </div>
      </div>

      {hasInput ? (
        <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <AddressResults
            totalRows={totalRows}
            validCount={parseResult.entries.length}
            invalid={parseResult.invalid}
            duplicatesRemoved={duplicatesRemoved}
            cleaned={cleaned}
            hasAmounts={parseResult.hasAmounts}
          />

          <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={cleaned.length === 0}
              onClick={() => handleExport("csv")}
            >
              <Download data-icon="inline-start" />
              Export CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={cleaned.length === 0}
              onClick={() => handleExport("json")}
            >
              <Download data-icon="inline-start" />
              Export JSON
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={cleaned.length === 0}
              onClick={() => handleExport("txt")}
            >
              <Download data-icon="inline-start" />
              Export TXT
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-card p-5 text-sm text-muted-foreground ring-1 ring-foreground/10">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <FileUp className="size-4" />
            Accepted formats
          </div>
          <p className="mt-2">{ACCEPTED_FORMATS}</p>
        </div>
      )}
    </div>
  );
}
