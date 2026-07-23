"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  Plus,
  RotateCw,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import { BaseError, isAddress } from "viem";

import { ResultsTable } from "@/components/tools/balances/results-table";
import {
  type BalanceCall,
  type BalanceColumn,
  buildBalanceCalls,
  chunk,
  CHUNK_SIZE,
  ETH_COLUMN,
  fetchTokenMeta,
  MAX_ADDRESSES,
  MAX_TOKENS,
  runBalanceChunk,
  type TokenInfo,
} from "@/components/tools/balances/fetch-balances";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { dedupeEntries, parseAddressList } from "@/lib/parse-addresses";
import { truncateAddress } from "@/lib/format";

const PLACEHOLDER = `0x1234…  (one address per line)
0xabcd…, 100        # extra columns after the address are ignored
# comment lines and blanks are skipped`;

function buildColumns(tokens: readonly TokenInfo[]): BalanceColumn[] {
  return [ETH_COLUMN, ...tokens];
}

export function BalanceChecker() {
  const [rawInput, setRawInput] = useState("");
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [tokenInput, setTokenInput] = useState("");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [addingToken, setAddingToken] = useState(false);

  const [fetching, setFetching] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [failedChunks, setFailedChunks] = useState<number[]>([]);

  const [resultAddresses, setResultAddresses] = useState<
    `0x${string}`[] | null
  >(null);
  const [resultColumns, setResultColumns] = useState<BalanceColumn[]>([]);
  const [balances, setBalances] = useState<(bigint | null)[][]>([]);

  const chunksRef = useRef<BalanceCall[][]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseAddressList(rawInput), [rawInput]);
  const uniqueAddresses = useMemo(
    () => dedupeEntries(parsed.entries).map((entry) => entry.address),
    [parsed],
  );
  const duplicatesRemoved = parsed.entries.length - uniqueAddresses.length;
  const overCap = uniqueAddresses.length > MAX_ADDRESSES;
  const canFetch =
    uniqueAddresses.length > 0 && !overCap && !fetching && !addingToken;

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setRawInput(String(reader.result ?? ""));
    reader.readAsText(file);
    // Allow re-selecting the same file later.
    event.target.value = "";
  }

  async function addToken() {
    const trimmed = tokenInput.trim();
    setTokenError(null);
    if (!isAddress(trimmed)) {
      setTokenError("Enter a valid token contract address.");
      return;
    }
    if (tokens.length >= MAX_TOKENS) {
      setTokenError(`Up to ${MAX_TOKENS} tokens can be tracked at once.`);
      return;
    }
    if (
      tokens.some(
        (token) => token.address.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      setTokenError("That token is already in the list.");
      return;
    }
    setAddingToken(true);
    try {
      const meta = await fetchTokenMeta(trimmed);
      setTokens((prev) => [...prev, meta]);
      setTokenInput("");
    } catch (error) {
      const message =
        error instanceof BaseError
          ? error.shortMessage
          : error instanceof Error
            ? error.message
            : "Could not read this token.";
      setTokenError(message);
    } finally {
      setAddingToken(false);
    }
  }

  function removeToken(address: `0x${string}`) {
    setTokens((prev) => prev.filter((token) => token.address !== address));
  }

  function applyChunk(
    prev: (bigint | null)[][],
    calls: readonly BalanceCall[],
    values: readonly (bigint | null)[],
  ): (bigint | null)[][] {
    const next = prev.map((row) => row.slice());
    calls.forEach((call, index) => {
      next[call.rowIndex][call.colIndex] = values[index];
    });
    return next;
  }

  async function runChunks(indices: number[], alreadyDone: number) {
    setFetching(true);
    const chunks = chunksRef.current;
    const failed: number[] = [];
    let done = alreadyDone;
    setProgress({ done, total: chunks.length });
    for (const index of indices) {
      try {
        const values = await runBalanceChunk(chunks[index]);
        setBalances((prev) => applyChunk(prev, chunks[index], values));
      } catch {
        failed.push(index);
      }
      done += 1;
      setProgress({ done, total: chunks.length });
    }
    setFailedChunks(failed);
    setFetching(false);
  }

  function startFetch() {
    if (!canFetch) return;
    const addresses = uniqueAddresses;
    const columns = buildColumns(tokens);
    const calls = buildBalanceCalls(addresses, tokens);
    const chunks = chunk(calls, CHUNK_SIZE);
    chunksRef.current = chunks;
    setResultAddresses(addresses);
    setResultColumns(columns);
    setBalances(
      addresses.map(() => new Array<bigint | null>(columns.length).fill(null)),
    );
    setFailedChunks([]);
    void runChunks(
      chunks.map((_, index) => index),
      0,
    );
  }

  function retryFailed() {
    const failed = failedChunks;
    if (failed.length === 0) return;
    setFailedChunks([]);
    void runChunks(failed, chunksRef.current.length - failed.length);
  }

  const progressPct =
    progress.total > 0 ? (progress.done / progress.total) * 100 : 0;

  return (
    <div className="space-y-8">
      {/* Step 1: addresses */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="addresses">Addresses</Label>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="hidden"
              onChange={handleFile}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload data-icon="inline-start" />
              Upload CSV/TXT
            </Button>
          </div>
        </div>
        <Textarea
          id="addresses"
          value={rawInput}
          onChange={(event) => setRawInput(event.target.value)}
          placeholder={PLACEHOLDER}
          className="min-h-40 font-mono text-sm"
          spellCheck={false}
        />

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">
              {uniqueAddresses.length.toLocaleString("en-US")}
            </span>{" "}
            unique {uniqueAddresses.length === 1 ? "address" : "addresses"}
          </span>
          {duplicatesRemoved > 0 ? (
            <span>
              {duplicatesRemoved.toLocaleString("en-US")} duplicate removed
            </span>
          ) : null}
          {parsed.invalid.length > 0 ? (
            <span className="text-destructive">
              {parsed.invalid.length.toLocaleString("en-US")} invalid{" "}
              {parsed.invalid.length === 1 ? "line" : "lines"}
            </span>
          ) : null}
        </div>

        {overCap ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Too many addresses</AlertTitle>
            <AlertDescription>
              {uniqueAddresses.length.toLocaleString("en-US")} unique addresses
              exceed the limit. This checker handles up to {MAX_ADDRESSES} at a
              time. Remove
              some and try again.
            </AlertDescription>
          </Alert>
        ) : null}

        {parsed.invalid.length > 0 ? (
          <details className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
            <summary className="cursor-pointer font-medium text-muted-foreground">
              Show {parsed.invalid.length} invalid{" "}
              {parsed.invalid.length === 1 ? "line" : "lines"}
            </summary>
            <ul className="mt-2 space-y-1">
              {parsed.invalid.slice(0, 50).map((entry) => (
                <li key={entry.line} className="font-mono text-xs">
                  <span className="text-muted-foreground">
                    Line {entry.line}:
                  </span>{" "}
                  <span className="break-all">{entry.raw || "(empty)"}</span>{" "}
                  <span className="text-destructive">({entry.reason})</span>
                </li>
              ))}
              {parsed.invalid.length > 50 ? (
                <li className="text-xs text-muted-foreground">
                  …and {parsed.invalid.length - 50} more
                </li>
              ) : null}
            </ul>
          </details>
        ) : null}
      </section>

      {/* Step 2: tokens */}
      <section className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="token">Tokens (optional)</Label>
          <p className="text-sm text-muted-foreground">
            Native ETH is always included. Add up to {MAX_TOKENS} ERC-20 tokens
            by contract address.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="token"
            value={tokenInput}
            onChange={(event) => {
              setTokenInput(event.target.value);
              if (tokenError) setTokenError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void addToken();
              }
            }}
            placeholder="0x… token contract address"
            className="font-mono"
            aria-invalid={tokenError ? true : undefined}
            disabled={tokens.length >= MAX_TOKENS || addingToken}
          />
          <Button
            variant="outline"
            onClick={() => void addToken()}
            disabled={
              tokenInput.trim() === "" ||
              tokens.length >= MAX_TOKENS ||
              addingToken
            }
          >
            {addingToken ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : (
              <Plus data-icon="inline-start" />
            )}
            Add token
          </Button>
        </div>
        {tokenError ? (
          <p className="text-sm text-destructive">{tokenError}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-1.5">
            ETH
            <span className="text-muted-foreground">native</span>
          </Badge>
          {tokens.map((token) => (
            <Badge
              key={token.address}
              variant="outline"
              className="gap-1.5 pr-1"
            >
              <span className="font-medium">{token.symbol}</span>
              <span className="font-mono text-muted-foreground">
                {truncateAddress(token.address)}
              </span>
              <button
                type="button"
                onClick={() => removeToken(token.address)}
                className="rounded-sm text-muted-foreground transition-colors hover:text-foreground"
                aria-label={`Remove ${token.symbol}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      </section>

      {/* Step 3: fetch */}
      <section className="space-y-3">
        <Button onClick={startFetch} disabled={!canFetch} size="lg">
          {fetching ? (
            <Loader2 className="animate-spin" data-icon="inline-start" />
          ) : (
            <Wallet data-icon="inline-start" />
          )}
          {fetching ? "Fetching balances…" : "Fetch balances"}
        </Button>

        {fetching || (progress.total > 0 && progress.done < progress.total) ? (
          <div className="space-y-1.5">
            <Progress value={progressPct} />
            <p className="text-xs text-muted-foreground">
              Batch {progress.done} / {progress.total}
            </p>
          </div>
        ) : null}

        {!fetching && failedChunks.length > 0 ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>
              {failedChunks.length}{" "}
              {failedChunks.length === 1 ? "batch" : "batches"} failed
            </AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-2">
              Some balances could not be loaded. Retry the failed batches only.
              <Button variant="outline" size="sm" onClick={retryFailed}>
                <RotateCw data-icon="inline-start" />
                Retry failed
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
      </section>

      {/* Results */}
      {resultAddresses ? (
        <ResultsTable
          addresses={resultAddresses}
          columns={resultColumns}
          balances={balances}
          fetching={fetching}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-foreground/15 px-4 py-10 text-center text-sm text-muted-foreground">
          Paste addresses above, optionally add tokens, then fetch to see
          balances here.
        </div>
      )}
    </div>
  );
}
