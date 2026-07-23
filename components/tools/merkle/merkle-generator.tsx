"use client";

import { useRef, useState } from "react";
import { Download, FileUp, ListTree, TriangleAlert } from "lucide-react";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import Link from "next/link";
import { toast } from "sonner";

import { AddressDisplay } from "@/components/address-display";
import { CopyButton } from "@/components/copy-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ShareResult, type ShareCardContent } from "@/components/share-card";
import { parseAddressList, type InvalidEntry } from "@/lib/parse-addresses";
import { truncateAddress } from "@/lib/format";

/** How many rows we render before capping (the exports always include all rows). */
const MAX_ROWS = 200;

type LeafFormat = ["address"] | ["address", "uint256"];

interface MerkleRow {
  index: number;
  address: `0x${string}`;
  amount?: string;
  proof: string[];
}

interface MerkleResult {
  root: string;
  format: LeafFormat;
  rows: MerkleRow[];
  treeJson: string;
  claimsJson: string;
}

interface DecimalIssue {
  line: number;
  raw: string;
  amount: string;
}

interface DuplicateIssue {
  address: string;
  count: number;
}

interface BuildIssues {
  invalid: InvalidEntry[];
  decimals: DecimalIssue[];
  duplicates: DuplicateIssue[];
  mixedFormat: boolean;
  empty: boolean;
}

function hasBlockingIssues(issues: BuildIssues): boolean {
  return (
    issues.invalid.length > 0 ||
    issues.decimals.length > 0 ||
    issues.duplicates.length > 0 ||
    issues.mixedFormat ||
    issues.empty
  );
}

function downloadJson(filename: string, json: string) {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function MerkleGenerator() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<MerkleResult | null>(null);
  const [issues, setIssues] = useState<BuildIssues | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setResult(null);
    setIssues(null);
  }

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      setText(content);
      reset();
    } catch {
      toast.error("Could not read the file.");
    } finally {
      // Allow re-selecting the same file.
      event.target.value = "";
    }
  }

  function generate() {
    reset();

    const parsed = parseAddressList(text);
    const entries = parsed.entries;

    const withAmount = entries.filter((entry) => entry.amount !== undefined);
    const decimals: DecimalIssue[] = withAmount
      .filter((entry) => entry.amount!.includes("."))
      .map((entry) => ({
        line: entry.line,
        raw: entry.raw,
        amount: entry.amount!,
      }));

    const counts = new Map<string, number>();
    for (const entry of entries) {
      counts.set(entry.address, (counts.get(entry.address) ?? 0) + 1);
    }
    const duplicates: DuplicateIssue[] = [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([address, count]) => ({ address, count }));

    // Mixed format: some rows carry an amount and some don't.
    const mixedFormat =
      withAmount.length > 0 && withAmount.length < entries.length;

    const built: BuildIssues = {
      invalid: parsed.invalid,
      decimals,
      duplicates,
      mixedFormat,
      empty: entries.length === 0,
    };

    if (hasBlockingIssues(built)) {
      setIssues(built);
      return;
    }

    const format: LeafFormat = parsed.hasAmounts
      ? ["address", "uint256"]
      : ["address"];

    const values: string[][] = entries.map((entry) =>
      parsed.hasAmounts ? [entry.address, entry.amount!] : [entry.address],
    );

    let tree: StandardMerkleTree<string[]>;
    try {
      tree = StandardMerkleTree.of(values, format);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to build the merkle tree.";
      toast.error(message);
      return;
    }

    const rows: MerkleRow[] = entries.map((entry, index) => ({
      index,
      address: entry.address,
      amount: parsed.hasAmounts ? entry.amount : undefined,
      proof: tree.getProof(index),
    }));

    const dump = tree.dump();

    const claims: Record<
      string,
      { index: number; amount?: string; proof: string[] }
    > = {};
    for (const row of rows) {
      claims[row.address] = {
        index: row.index,
        ...(row.amount !== undefined ? { amount: row.amount } : {}),
        proof: row.proof,
      };
    }

    const claimsPayload = { root: tree.root, format, claims };

    setResult({
      root: tree.root,
      format,
      rows,
      treeJson: JSON.stringify(dump, null, 2),
      claimsJson: JSON.stringify(claimsPayload, null, 2),
    });
  }

  const showAmount = result?.format.length === 2;
  const visibleRows = result?.rows.slice(0, MAX_ROWS) ?? [];

  const shareContent: ShareCardContent | null = result
    ? {
        tool: "Merkle tree",
        headline: {
          value: `${result.rows.length.toLocaleString()} ${
            result.rows.length === 1 ? "recipient" : "recipients"
          }`,
          text: "in a merkle tree",
        },
        subline: {
          text: `Root ${truncateAddress(result.root, 8)}`,
          mono: true,
        },
      }
    : null;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Textarea
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            if (result || issues) reset();
          }}
          placeholder={
            "0xAddress\n0xAddress,1000000000000000000\n… one entry per line"
          }
          rows={10}
          spellCheck={false}
          className="font-mono text-xs"
          aria-label="Address list"
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={generate} disabled={text.trim() === ""}>
            <ListTree />
            Generate tree
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            className="hidden"
            onChange={onFile}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileUp />
            Upload .csv / .txt
          </Button>
          {result ? (
            <span className="text-sm text-muted-foreground">
              {result.rows.length.toLocaleString()}{" "}
              {result.rows.length === 1 ? "entry" : "entries"}
            </span>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          One <span className="font-mono">address</span> or{" "}
          <span className="font-mono">address,amount</span> per line. Amounts
          are raw token units (wei-style), so scale by your token&apos;s decimals
          first. Everything runs offline in your browser; no data leaves the
          page.
        </p>
      </div>

      {issues ? <IssuesPanel issues={issues} /> : null}

      {result ? (
        <div className="space-y-6">
          <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Merkle root</p>
              <Badge variant="secondary" className="font-mono">
                {result.format.join(", ")}
              </Badge>
            </div>
            <div className="mt-2 flex items-start gap-2">
              <code className="min-w-0 flex-1 break-all font-mono text-sm">
                {result.root}
              </code>
              <CopyButton value={result.root} label="Copy root" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => downloadJson("tree.json", result.treeJson)}
            >
              <Download />
              Full tree JSON
            </Button>
            <Button
              variant="outline"
              onClick={() => downloadJson("claims.json", result.claimsJson)}
            >
              <Download />
              Claims JSON
            </Button>
          </div>

          {shareContent ? (
            <ShareResult
              content={shareContent}
              filename="robins-merkle.png"
              title="Merkle tree generated"
              shareText="Built a merkle tree with robins.tools"
            />
          ) : null}

          <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Address</TableHead>
                  {showAmount ? (
                    <TableHead className="text-right">Amount (raw)</TableHead>
                  ) : null}
                  <TableHead className="text-right">Proof</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((row) => (
                  <TableRow key={row.index}>
                    <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                      {row.index}
                    </TableCell>
                    <TableCell>
                      <AddressDisplay address={row.address} explorer={false} />
                    </TableCell>
                    {showAmount ? (
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {row.amount}
                      </TableCell>
                    ) : null}
                    <TableCell className="text-right">
                      <span className="inline-flex items-center justify-end gap-1">
                        <span className="text-xs text-muted-foreground">
                          {row.proof.length}{" "}
                          {row.proof.length === 1 ? "hash" : "hashes"}
                        </span>
                        <CopyButton
                          value={JSON.stringify(row.proof)}
                          label="Copy proof"
                        />
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {result.rows.length > MAX_ROWS ? (
            <p className="text-xs text-muted-foreground">
              Showing the first {MAX_ROWS.toLocaleString()} of{" "}
              {result.rows.length.toLocaleString()} entries. The exported JSON
              files include every entry.
            </p>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Proofs verify against OpenZeppelin&apos;s{" "}
            <span className="font-mono">MerkleProof</span> library. Reload the
            full tree JSON with{" "}
            <span className="font-mono">StandardMerkleTree.load()</span>.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function IssuesPanel({ issues }: { issues: BuildIssues }) {
  return (
    <Alert variant="destructive">
      <TriangleAlert />
      <AlertTitle>Fix these before generating a tree</AlertTitle>
      <AlertDescription>
        <div className="space-y-3">
          {issues.empty ? (
            <p>No valid entries found. Paste at least one address.</p>
          ) : null}

          {issues.mixedFormat ? (
            <p>
              Mixed rows: some lines have an amount and some don&apos;t. Pick
              one format: every line an{" "}
              <span className="font-mono">address</span>, or every line{" "}
              <span className="font-mono">address,amount</span>.
            </p>
          ) : null}

          {issues.duplicates.length > 0 ? (
            <div className="space-y-1">
              <p>
                Duplicate addresses (leaves must be unique). Clean the list with{" "}
                <Link href="/tools/address-utils">Address List Utilities</Link>{" "}
                first.
              </p>
              <ul className="space-y-0.5 font-mono text-xs">
                {issues.duplicates.slice(0, 20).map((dup) => (
                  <li key={dup.address}>
                    {dup.address} ×{dup.count}
                  </li>
                ))}
              </ul>
              {issues.duplicates.length > 20 ? (
                <p className="text-xs">
                  …and {issues.duplicates.length - 20} more.
                </p>
              ) : null}
            </div>
          ) : null}

          {issues.decimals.length > 0 ? (
            <div className="space-y-1">
              <p>
                Amounts must be whole numbers (raw uint256 token units). These
                have a decimal point:
              </p>
              <ul className="space-y-0.5 font-mono text-xs">
                {issues.decimals.slice(0, 20).map((issue) => (
                  <li key={issue.line}>
                    line {issue.line}: {issue.amount}
                  </li>
                ))}
              </ul>
              {issues.decimals.length > 20 ? (
                <p className="text-xs">
                  …and {issues.decimals.length - 20} more.
                </p>
              ) : null}
            </div>
          ) : null}

          {issues.invalid.length > 0 ? (
            <div className="space-y-1">
              <p>Invalid rows:</p>
              <ul className="space-y-0.5 font-mono text-xs">
                {issues.invalid.slice(0, 20).map((entry) => (
                  <li key={entry.line}>
                    line {entry.line}: {entry.reason}
                  </li>
                ))}
              </ul>
              {issues.invalid.length > 20 ? (
                <p className="text-xs">
                  …and {issues.invalid.length - 20} more.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </AlertDescription>
    </Alert>
  );
}
