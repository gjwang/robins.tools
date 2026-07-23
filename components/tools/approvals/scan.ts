import { type Address, erc20Abi, parseAbiItem } from "viem";

import { publicClient } from "@/lib/public-client";
import { EXPLORER_API } from "@/lib/explorer";

/** Allowances at or above this are treated as effectively unlimited. */
export const UNLIMITED_THRESHOLD = 2n ** 255n;

const APPROVAL_EVENT = parseAbiItem(
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
);

export interface ApprovalRow {
  /** Stable identity: `${token}-${spender}`, lowercased. */
  key: string;
  token: Address;
  tokenSymbol: string;
  tokenName: string;
  tokenDecimals: number;
  spender: Address;
  /** Verified-contract name from Blockscout, if any (fail-soft). */
  spenderName?: string;
  allowance: bigint;
  isUnlimited: boolean;
  /** Block of the latest approval for this pair. */
  blockNumber: bigint;
  /** Unix seconds of that block, or null if it couldn't be resolved. */
  timestamp: number | null;
}

type ProgressFn = (message: string) => void;

async function getLogsRange(
  owner: Address,
  fromBlock: bigint,
  toBlock: bigint | "latest",
) {
  return publicClient.getLogs({
    event: APPROVAL_EVENT,
    args: { owner },
    fromBlock,
    toBlock,
  });
}

type ApprovalLog = Awaited<ReturnType<typeof getLogsRange>>[number];

/**
 * Owner-filtered Approval logs across all history. The topic-filtered full-range
 * query works in a single request on this RPC; if it ever errors (range/result
 * limits), fall back to recursively bisecting the block range until each chunk
 * succeeds, then merge.
 */
async function fetchApprovalLogs(
  owner: Address,
  onProgress: ProgressFn,
): Promise<ApprovalLog[]> {
  try {
    return [...(await getLogsRange(owner, 1n, "latest"))];
  } catch {
    onProgress("Scanning a large history in block ranges…");
    const latest = await publicClient.getBlockNumber();
    return bisect(owner, 1n, latest, onProgress);
  }
}

async function bisect(
  owner: Address,
  from: bigint,
  to: bigint,
  onProgress: ProgressFn,
): Promise<ApprovalLog[]> {
  try {
    onProgress(`Scanning blocks ${from.toString()} to ${to.toString()}…`);
    return [...(await getLogsRange(owner, from, to))];
  } catch (err) {
    if (from >= to) throw err;
    const mid = from + (to - from) / 2n;
    const left = await bisect(owner, from, mid, onProgress);
    const right = await bisect(owner, mid + 1n, to, onProgress);
    return [...left, ...right];
  }
}

function isLater(a: ApprovalLog, b: ApprovalLog): boolean {
  const ab = a.blockNumber ?? 0n;
  const bb = b.blockNumber ?? 0n;
  if (ab !== bb) return ab > bb;
  const at = a.transactionIndex ?? 0;
  const bt = b.transactionIndex ?? 0;
  if (at !== bt) return at > bt;
  return (a.logIndex ?? 0) > (b.logIndex ?? 0);
}

async function fetchSpenderName(spender: Address): Promise<string | undefined> {
  try {
    const res = await fetch(`${EXPLORER_API}/smart-contracts/${spender}`);
    if (!res.ok) return undefined;
    const data = (await res.json()) as { name?: string | null };
    return data.name ?? undefined;
  } catch {
    return undefined;
  }
}

async function fetchTimestamp(blockNumber: bigint): Promise<number | null> {
  try {
    const block = await publicClient.getBlock({ blockNumber });
    return Number(block.timestamp);
  } catch {
    return null;
  }
}

/**
 * Full approval scan for one owner: read history, keep the latest approval per
 * (token, spender), check the live allowance, drop anything that's back to zero,
 * then enrich the survivors with token metadata, spender names, and ages.
 */
export async function scanApprovals(
  owner: Address,
  onProgress: ProgressFn,
): Promise<ApprovalRow[]> {
  onProgress("Scanning approval history…");
  const logs = await fetchApprovalLogs(owner, onProgress);

  // Latest approval per (token, spender).
  const latestByPair = new Map<string, ApprovalLog>();
  for (const log of logs) {
    const spender = log.args.spender;
    if (!spender || log.blockNumber === null) continue;
    const key = `${log.address.toLowerCase()}-${spender.toLowerCase()}`;
    const existing = latestByPair.get(key);
    if (!existing || isLater(log, existing)) latestByPair.set(key, log);
  }

  const pairs = [...latestByPair.values()].filter(
    (log): log is ApprovalLog & { args: { spender: Address } } =>
      log.args.spender !== undefined,
  );
  if (pairs.length === 0) return [];

  // Live allowances; keep only what's still active.
  onProgress("Checking current allowances…");
  const allowances = await publicClient.multicall({
    allowFailure: true,
    contracts: pairs.map((log) => ({
      address: log.address,
      abi: erc20Abi,
      functionName: "allowance" as const,
      args: [owner, log.args.spender] as const,
    })),
  });

  const active = pairs
    .map((log, index) => ({ log, result: allowances[index] }))
    .filter(
      (
        entry,
      ): entry is {
        log: (typeof pairs)[number];
        result: { status: "success"; result: bigint };
      } => entry.result.status === "success" && entry.result.result > 0n,
    );
  if (active.length === 0) return [];

  // Token metadata for the involved tokens.
  onProgress("Loading token details…");
  const tokens = [
    ...new Set(active.map((e) => e.log.address.toLowerCase())),
  ].map(
    (lower) =>
      active.find((e) => e.log.address.toLowerCase() === lower)!.log.address,
  );
  const metaResults = await publicClient.multicall({
    allowFailure: true,
    contracts: tokens.flatMap((address) => [
      { address, abi: erc20Abi, functionName: "symbol" as const },
      { address, abi: erc20Abi, functionName: "decimals" as const },
      { address, abi: erc20Abi, functionName: "name" as const },
    ]),
  });

  const metaByToken = new Map<
    string,
    { symbol: string; decimals: number; name: string }
  >();
  tokens.forEach((address, i) => {
    const symbol = metaResults[i * 3];
    const decimals = metaResults[i * 3 + 1];
    const name = metaResults[i * 3 + 2];
    metaByToken.set(address.toLowerCase(), {
      symbol: symbol.status === "success" ? (symbol.result as string) : "TOKEN",
      decimals: decimals.status === "success" ? Number(decimals.result) : 18,
      name: name.status === "success" ? (name.result as string) : "",
    });
  });

  // Spender names (Blockscout) and block timestamps, in parallel, fail-soft.
  onProgress("Resolving spenders…");
  const uniqueSpenders = [
    ...new Set(active.map((e) => e.log.args.spender.toLowerCase())),
  ].map(
    (lower) =>
      active.find((e) => e.log.args.spender.toLowerCase() === lower)!.log.args
        .spender,
  );
  const uniqueBlocks = [
    ...new Set(active.map((e) => e.log.blockNumber!.toString())),
  ].map((s) => BigInt(s));

  const [spenderNames, blockTimestamps] = await Promise.all([
    Promise.all(uniqueSpenders.map(fetchSpenderName)),
    Promise.all(uniqueBlocks.map(fetchTimestamp)),
  ]);

  const nameBySpender = new Map<string, string | undefined>();
  uniqueSpenders.forEach((spender, i) => {
    nameBySpender.set(spender.toLowerCase(), spenderNames[i]);
  });
  const tsByBlock = new Map<string, number | null>();
  uniqueBlocks.forEach((block, i) => {
    tsByBlock.set(block.toString(), blockTimestamps[i]);
  });

  const rows: ApprovalRow[] = active.map(({ log, result }) => {
    const token = log.address;
    const spender = log.args.spender;
    const meta = metaByToken.get(token.toLowerCase())!;
    const blockNumber = log.blockNumber!;
    return {
      key: `${token.toLowerCase()}-${spender.toLowerCase()}`,
      token,
      tokenSymbol: meta.symbol,
      tokenName: meta.name,
      tokenDecimals: meta.decimals,
      spender,
      spenderName: nameBySpender.get(spender.toLowerCase()),
      allowance: result.result,
      isUnlimited: result.result >= UNLIMITED_THRESHOLD,
      blockNumber,
      timestamp: tsByBlock.get(blockNumber.toString()) ?? null,
    };
  });

  rows.sort((a, b) => (b.blockNumber > a.blockNumber ? 1 : -1));
  return rows;
}
