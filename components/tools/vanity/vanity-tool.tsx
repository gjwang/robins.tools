"use client";

import { useEffect, useRef, useState } from "react";
import {
  Clock,
  Cpu,
  Download,
  Eye,
  EyeOff,
  Gauge,
  Hash,
  Play,
  ShieldAlert,
  Square,
  TriangleAlert,
} from "lucide-react";
import { getAddress } from "viem";
import { toast } from "sonner";

import { CopyButton } from "@/components/copy-button";
import { ShareResult, type ShareCardContent } from "@/components/share-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import {
  ADDRESS_NIBBLES,
  MAX_COMBINED_LENGTH,
  type VanityMatchMessage,
  type VanityResponse,
  type VanityStartMessage,
} from "./types";

const HEX_ONLY = /[^0-9a-fA-F]/g;

function sanitizePrefix(value: string): string {
  return value
    .replace(/^0x/i, "")
    .replace(HEX_ONLY, "")
    .toLowerCase()
    .slice(0, MAX_COMBINED_LENGTH);
}

function sanitizeSuffix(value: string): string {
  return value
    .replace(HEX_ONLY, "")
    .toLowerCase()
    .slice(0, MAX_COMBINED_LENGTH);
}

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatInteger(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

function formatCompact(n: number): string {
  return compactFormatter.format(n);
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "-";
  if (seconds < 1) return "under a second";
  const minutes = seconds / 60;
  const hours = minutes / 60;
  const days = hours / 24;
  const years = days / 365;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (minutes < 60)
    return `${Math.floor(minutes)}m ${Math.round(seconds % 60)}s`;
  if (hours < 24) return `${Math.floor(hours)}h ${Math.round(minutes % 60)}m`;
  if (days < 365) return `${Math.floor(days)}d ${Math.round(hours % 24)}h`;
  if (years < 1000) {
    return `${years < 10 ? years.toFixed(1) : formatInteger(years)} years`;
  }
  return "effectively forever";
}

type Difficulty = { tone: "info" | "warn" | "danger"; label: string };

function difficultyFor(combinedLength: number): Difficulty | null {
  if (combinedLength < 1) return null;
  if (combinedLength <= 3) {
    return { tone: "info", label: "Quick: usually found within seconds." };
  }
  if (combinedLength <= 5) {
    return { tone: "info", label: "Moderate: often just a minute or two." };
  }
  if (combinedLength <= 7) {
    return { tone: "warn", label: "Slow: can take several minutes to hours." };
  }
  if (combinedLength <= 9) {
    return {
      tone: "warn",
      label: "Very slow: expect hours, keep this tab open.",
    };
  }
  return {
    tone: "danger",
    label: "Extremely slow: this could take days or effectively forever.",
  };
}

const difficultyToneClasses: Record<Difficulty["tone"], string> = {
  info: "text-muted-foreground",
  warn: "text-amber-600 dark:text-amber-400",
  danger: "text-destructive",
};

interface StatProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}

function Stat({ icon: Icon, label, value }: StatProps) {
  return (
    <div className="rounded-lg bg-muted/40 p-3 ring-1 ring-foreground/5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-1 font-mono text-sm font-medium tabular-nums">
        {value}
      </div>
    </div>
  );
}

interface LiveStats {
  attempts: number;
  rate: number;
  elapsed: number;
}

export function VanityTool() {
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<VanityMatchMessage | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [stats, setStats] = useState<LiveStats>({
    attempts: 0,
    rate: 0,
    elapsed: 0,
  });
  // Worker count is derived from navigator at Start time (not during render), so
  // the server and first client render agree and there is no hydration mismatch.
  const [threads, setThreads] = useState<number | null>(null);

  const workersRef = useRef<Worker[]>([]);
  const attemptsRef = useRef(0);
  const startTimeRef = useRef(0);
  const rateRef = useRef(0);
  const lastSampleRef = useRef({ time: 0, attempts: 0 });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Terminate everything on unmount so no worker keeps grinding after the user
  // navigates away.
  useEffect(() => {
    return () => {
      for (const worker of workersRef.current) worker.terminate();
      workersRef.current = [];
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, []);

  const combinedLength = prefix.length + suffix.length;
  const tooLong = combinedLength > MAX_COMBINED_LENGTH;
  const hasPattern = combinedLength >= 1;
  const canStart = hasPattern && !tooLong;
  const expectedAttempts =
    hasPattern && !tooLong ? Math.pow(16, combinedLength) : 0;
  const difficulty = tooLong ? null : difficultyFor(combinedLength);

  function clearTimers() {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  function tick() {
    const now = Date.now();
    const elapsed = (now - startTimeRef.current) / 1000;
    const attempts = attemptsRef.current;
    const sample = lastSampleRef.current;
    const dt = (now - sample.time) / 1000;
    if (dt > 0) {
      const instant = (attempts - sample.attempts) / dt;
      // Exponential moving average keeps the rate readable instead of jittery.
      rateRef.current =
        rateRef.current === 0 ? instant : rateRef.current * 0.6 + instant * 0.4;
      lastSampleRef.current = { time: now, attempts };
    }
    setStats({ attempts, rate: rateRef.current, elapsed });
  }

  function handleMatch(match: VanityMatchMessage) {
    const workers = workersRef.current;
    if (workers.length === 0) return; // A later worker's message, already handled.
    workersRef.current = [];
    for (const worker of workers) worker.terminate();
    clearTimers();
    setStats((prev) => ({
      attempts: attemptsRef.current,
      rate: prev.rate,
      elapsed: (Date.now() - startTimeRef.current) / 1000,
    }));
    setRunning(false);
    setResult(match);
    toast.success("Vanity address found.");
  }

  function handleStop() {
    const workers = workersRef.current;
    workersRef.current = [];
    for (const worker of workers) worker.terminate();
    clearTimers();
    setStats({
      attempts: attemptsRef.current,
      rate: rateRef.current,
      elapsed: (Date.now() - startTimeRef.current) / 1000,
    });
    setRunning(false);
  }

  function handleStart() {
    if (!canStart || running) return;

    setResult(null);
    setRevealed(false);
    attemptsRef.current = 0;
    rateRef.current = 0;
    const now = Date.now();
    startTimeRef.current = now;
    lastSampleRef.current = { time: now, attempts: 0 };
    setStats({ attempts: 0, rate: 0, elapsed: 0 });
    setRunning(true);

    const workerCount = Math.max(1, (navigator.hardwareConcurrency || 4) - 1);
    setThreads(workerCount);
    const request: VanityStartMessage = { type: "start", prefix, suffix };
    const workers: Worker[] = [];

    for (let i = 0; i < workerCount; i++) {
      const worker = new Worker(
        new URL("./vanity-worker.ts", import.meta.url),
        {
          type: "module",
        },
      );
      worker.onmessage = (event: MessageEvent<VanityResponse>) => {
        const message = event.data;
        if (message.type === "progress") {
          attemptsRef.current += message.attempts;
        } else {
          handleMatch(message);
        }
      };
      worker.onerror = () => {
        toast.error("A worker failed to start. Please try again.");
        handleStop();
      };
      worker.postMessage(request);
      workers.push(worker);
    }

    workersRef.current = workers;
    intervalRef.current = setInterval(tick, 250);
  }

  const checksummed = result ? getAddress(result.address) : null;

  function handleDownload() {
    if (!result || !checksummed) return;
    const payload = JSON.stringify(
      { address: checksummed, privateKey: result.privateKey },
      null,
      2,
    );
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `vanity-${checksummed}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  const showStats = running || stats.attempts > 0;
  const rate = stats.rate;
  const halfLifeSeconds =
    rate > 0 ? (Math.LN2 * expectedAttempts) / rate : Infinity;
  const averageSeconds = rate > 0 ? expectedAttempts / rate : Infinity;

  return (
    <div className="space-y-6">
      {/* Pattern input */}
      <Card>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vanity-prefix">Starts with</Label>
              <div className="flex items-center gap-2 rounded-lg border border-input bg-transparent px-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                <span className="font-mono text-sm text-muted-foreground">
                  0x
                </span>
                <Input
                  id="vanity-prefix"
                  value={prefix}
                  onChange={(event) =>
                    setPrefix(sanitizePrefix(event.target.value))
                  }
                  placeholder="dead"
                  spellCheck={false}
                  autoComplete="off"
                  disabled={running}
                  className="border-0 bg-transparent px-0 font-mono shadow-none focus-visible:border-0 focus-visible:ring-0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vanity-suffix">Ends with</Label>
              <Input
                id="vanity-suffix"
                value={suffix}
                onChange={(event) =>
                  setSuffix(sanitizeSuffix(event.target.value))
                }
                placeholder="beef"
                spellCheck={false}
                autoComplete="off"
                disabled={running}
                className="font-mono"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Hex characters only (0-9, a-f). Matching is{" "}
            <span className="font-medium text-foreground">
              case-insensitive
            </span>{" "}
            with no checksum casing required. Everything runs in your browser;
            nothing ever leaves this page.
          </p>

          {tooLong ? (
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <TriangleAlert className="size-4" />
              Combined length is {combinedLength}. Keep prefix + suffix to{" "}
              {MAX_COMBINED_LENGTH} characters or fewer.
            </p>
          ) : null}

          {difficulty ? (
            <div className="rounded-lg bg-muted/40 p-4 ring-1 ring-foreground/5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm text-muted-foreground">
                  Expected attempts
                </span>
                <span className="font-mono text-sm font-medium tabular-nums">
                  ~{formatCompact(expectedAttempts)}
                  <span className="ml-1 text-muted-foreground">
                    (1 in {formatCompact(expectedAttempts)})
                  </span>
                </span>
              </div>
              <p
                className={cn(
                  "mt-2 text-sm",
                  difficultyToneClasses[difficulty.tone],
                )}
              >
                {difficulty.label}
              </p>
              {running && Number.isFinite(averageSeconds) ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  At the current rate, about {formatDuration(averageSeconds)} on
                  average.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            {running ? (
              <Button type="button" variant="destructive" onClick={handleStop}>
                <Square />
                Stop
              </Button>
            ) : (
              <Button type="button" onClick={handleStart} disabled={!canStart}>
                <Play />
                Start grinding
              </Button>
            )}
            <span className="text-xs text-muted-foreground">
              {threads !== null
                ? `Using ${threads} worker thread${threads === 1 ? "" : "s"}.`
                : "Runs in parallel across your CPU cores."}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Live stats */}
      {showStats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            icon={Hash}
            label="Attempts"
            value={formatInteger(stats.attempts)}
          />
          <Stat
            icon={Gauge}
            label="Rate"
            value={`${formatCompact(stats.rate)}/s`}
          />
          <Stat
            icon={Clock}
            label="Elapsed"
            value={formatDuration(stats.elapsed)}
          />
          <Stat
            icon={Cpu}
            label="50% within"
            value={running ? formatDuration(halfLifeSeconds) : "-"}
          />
        </div>
      ) : null}

      {/* Result */}
      {result && checksummed ? (
        <Card>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Address</Label>
                <CopyButton value={checksummed} label="Copy address" />
              </div>
              <div className="overflow-x-auto rounded-lg bg-muted/40 p-3 ring-1 ring-foreground/5">
                <span className="font-mono text-sm break-all">
                  <span className="text-muted-foreground">0x</span>
                  <HighlightedAddress
                    body={checksummed.slice(2)}
                    prefixLength={prefix.length}
                    suffixLength={suffix.length}
                  />
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Private key</Label>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setRevealed((value) => !value)}
                  >
                    {revealed ? <EyeOff /> : <Eye />}
                    {revealed ? "Hide" : "Reveal"}
                  </Button>
                  <CopyButton
                    value={result.privateKey}
                    label="Copy private key"
                  />
                </div>
              </div>
              <div className="overflow-x-auto rounded-lg bg-muted/40 p-3 ring-1 ring-foreground/5">
                <span
                  className={cn(
                    "font-mono text-sm break-all",
                    revealed ? "" : "select-none blur-sm",
                  )}
                >
                  {result.privateKey}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={handleDownload}>
                <Download />
                Download JSON
              </Button>
              <Button type="button" variant="ghost" onClick={handleStart}>
                <Play />
                Grind another
              </Button>
            </div>

            {/*
              Share card content is built from the public address and attempt
              count only. The private key is NEVER passed to the renderer.
            */}
            <ShareResult
              content={
                {
                  tool: "Vanity address",
                  headline: { text: "Vanity address found" },
                  subline: {
                    text: checksummed,
                    tone: "accent",
                    mono: true,
                  },
                  detail: `${formatInteger(stats.attempts)} attempts`,
                } satisfies ShareCardContent
              }
              filename="robins-vanity.png"
              title="Vanity address found"
              shareText="Ground a vanity address with robins.tools"
            />

            <div className="flex gap-3 rounded-lg bg-destructive/10 p-4 text-destructive ring-1 ring-destructive/20">
              <ShieldAlert className="mt-0.5 size-5 shrink-0" />
              <div className="space-y-1 text-sm">
                <p className="font-medium">
                  Save this key now, and treat it as a hot wallet.
                </p>
                <p className="text-destructive/90">
                  It was generated locally in this tab and never transmitted
                  anywhere. There is no way to recover it if you lose it, and
                  anyone who obtains it controls every asset at this address.
                  Store it in a secure wallet or password manager immediately.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

interface HighlightedAddressProps {
  /** The 40 hex chars after `0x`. */
  body: string;
  prefixLength: number;
  suffixLength: number;
}

function HighlightedAddress({
  body,
  prefixLength,
  suffixLength,
}: HighlightedAddressProps) {
  const suffixStart = ADDRESS_NIBBLES - suffixLength;
  const head = body.slice(0, prefixLength);
  const middle = body.slice(prefixLength, suffixStart);
  const tail = suffixLength > 0 ? body.slice(suffixStart) : "";

  return (
    <>
      {head ? (
        <span className="rounded bg-primary px-0.5 text-primary-foreground">
          {head}
        </span>
      ) : null}
      <span>{middle}</span>
      {tail ? (
        <span className="rounded bg-primary px-0.5 text-primary-foreground">
          {tail}
        </span>
      ) : null}
    </>
  );
}
