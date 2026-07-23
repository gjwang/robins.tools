import {
  type Abi,
  type AbiEvent,
  type AbiFunction,
  type AbiParameter,
  type Address,
  type Hex,
  type Log,
  TransactionNotFoundError,
  TransactionReceiptNotFoundError,
  decodeEventLog,
  decodeFunctionData,
  parseAbiItem,
  size,
  slice,
  toEventSelector,
  toFunctionSelector,
} from "viem";

import { EXPLORER_API } from "@/lib/explorer";
import { publicClient } from "@/lib/public-client";

import { knownEventAbi, localFunctionAbi } from "./known-abis";
import type {
  CalldataResult,
  Decoded,
  DecodedArg,
  DecodedLog,
  InputMode,
  RawWord,
  TxOverview,
} from "./types";

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const HEX_RE = /^0x[0-9a-fA-F]*$/;

/** Human-readable error whose message is safe to show the user directly. */
export class DecoderError extends Error {}

/**
 * Detect whether the raw input is a tx hash or calldata. A bare hex string
 * (no `0x`) is tolerated. Tx-hash shape (exactly 32 bytes) wins over calldata.
 */
export function detectInput(
  raw: string,
): { mode: InputMode; value: Hex } | { error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { error: "Enter a transaction hash or calldata." };

  const value = (trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`) as Hex;

  if (!HEX_RE.test(value)) {
    return { error: "Input is not valid hex." };
  }
  if ((value.length - 2) % 2 !== 0) {
    return { error: "Hex has an odd number of digits." };
  }
  if (TX_HASH_RE.test(value)) return { mode: "tx", value };
  if (value.length >= 10) return { mode: "calldata", value };

  return {
    error:
      "Enter a 32-byte transaction hash, or calldata (0x + a 4-byte selector).",
  };
}

// ---------------------------------------------------------------------------
// Signature formatting
// ---------------------------------------------------------------------------

function paramTypeString(param: AbiParameter): string {
  if (param.type.startsWith("tuple")) {
    const components = "components" in param ? param.components : [];
    const inner = components.map(paramTypeString).join(",");
    const arraySuffix = param.type.slice("tuple".length);
    return `(${inner})${arraySuffix}`;
  }
  return param.type;
}

function formatParam(param: AbiParameter): string {
  const type = paramTypeString(param);
  const indexed = "indexed" in param && param.indexed ? " indexed" : "";
  return param.name ? `${type}${indexed} ${param.name}` : `${type}${indexed}`;
}

function formatSignature(
  name: string,
  inputs: readonly AbiParameter[],
): string {
  return `${name}(${inputs.map(formatParam).join(", ")})`;
}

// ---------------------------------------------------------------------------
// Calldata decoding
// ---------------------------------------------------------------------------

function buildDecoded(
  name: string,
  inputs: readonly AbiParameter[],
  args: readonly unknown[] | Record<string, unknown> | undefined,
): Decoded {
  const argAt = (input: AbiParameter, i: number): unknown => {
    if (args == null) return undefined;
    if (Array.isArray(args)) return args[i];
    return (args as Record<string, unknown>)[input.name ?? String(i)];
  };
  return {
    name,
    signature: formatSignature(name, inputs),
    args: inputs.map<DecodedArg>((input, i) => ({
      name: input.name || `#${i}`,
      param: input,
      value: argAt(input, i),
    })),
  };
}

function decodeWithAbi(calldata: Hex, abi: Abi): Decoded | null {
  try {
    const { args } = decodeFunctionData({ abi, data: calldata });
    const selector = slice(calldata, 0, 4);
    const fn = abi.find(
      (item): item is AbiFunction =>
        item.type === "function" && toFunctionSelector(item) === selector,
    );
    if (!fn) return null;
    return buildDecoded(fn.name, fn.inputs, args as readonly unknown[]);
  } catch {
    return null;
  }
}

/**
 * Fetch a verified contract's ABI from Blockscout. For proxies, the
 * implementation ABI(s) are fetched and merged ahead of the proxy's own ABI so
 * delegated calls decode. Any failure degrades to null (skip this rung).
 */
export async function fetchContractAbi(address: Address): Promise<Abi | null> {
  try {
    const res = await fetch(`${EXPLORER_API}/smart-contracts/${address}`);
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (typeof data !== "object" || data === null) return null;

    const record = data as {
      abi?: unknown;
      implementations?: unknown;
    };
    let abi: Abi | null = Array.isArray(record.abi)
      ? (record.abi as Abi)
      : null;

    const implementations = Array.isArray(record.implementations)
      ? record.implementations
      : [];
    if (implementations.length > 0) {
      const implAbi: Abi[number][] = [];
      for (const impl of implementations) {
        const implAddr =
          typeof impl === "object" && impl !== null
            ? ((impl as { address?: string; address_hash?: string }).address ??
              (impl as { address_hash?: string }).address_hash)
            : undefined;
        if (!implAddr) continue;
        try {
          const implRes = await fetch(
            `${EXPLORER_API}/smart-contracts/${implAddr}`,
          );
          if (!implRes.ok) continue;
          const implData = (await implRes.json()) as { abi?: unknown };
          if (Array.isArray(implData.abi))
            implAbi.push(...(implData.abi as Abi));
        } catch {
          // ignore a single implementation fetch failure
        }
      }
      if (implAbi.length > 0) abi = [...implAbi, ...(abi ?? [])];
    }

    return abi;
  } catch {
    return null;
  }
}

/** Rung 3: openchain.xyz 4-byte selector database. Only the selector is sent. */
async function decodeViaSignatureDb(
  calldata: Hex,
  selector: Hex,
): Promise<Decoded | null> {
  try {
    const res = await fetch(
      `https://api.openchain.xyz/signature-database/v1/lookup?function=${selector}&filter=true`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      result?: {
        function?: Record<
          string,
          { name: string; hasVerifiedContract?: boolean }[]
        >;
      };
    };
    const candidates = data.result?.function?.[selector] ?? [];
    // Prefer signatures backed by a verified contract; they win selector collisions.
    // `hasVerifiedContract` may be undefined; coerce through Boolean so the
    // comparator stays 0/1 (Number(undefined) is NaN, which breaks the sort).
    const sorted = [...candidates].sort(
      (a, b) =>
        Number(Boolean(b.hasVerifiedContract)) -
        Number(Boolean(a.hasVerifiedContract)),
    );
    for (const candidate of sorted) {
      try {
        const item = parseAbiItem(`function ${candidate.name}`);
        if (item.type !== "function") continue;
        const decoded = decodeWithAbi(calldata, [item]);
        if (decoded) return decoded;
      } catch {
        // malformed signature; try the next candidate
      }
    }
    return null;
  } catch {
    return null;
  }
}

function toWords(calldata: Hex): RawWord[] {
  if (size(calldata) <= 4) return [];
  const body = calldata.slice(2 + 8); // strip "0x" + 4-byte selector
  const words: RawWord[] = [];
  for (let i = 0; i < body.length; i += 64) {
    words.push({ offset: i / 2, word: `0x${body.slice(i, i + 64)}` as Hex });
  }
  return words;
}

/**
 * Run the ABI-resolution ladder against calldata:
 *  1. verified contract ABI (tx mode with a `to` address, proxies followed),
 *  2. local well-known token ABIs,
 *  3. openchain.xyz selector lookup,
 *  4. raw 32-byte words.
 */
export async function resolveAndDecodeCalldata(
  calldata: Hex,
  opts: { toAbi?: Abi | null },
): Promise<CalldataResult> {
  const selector = size(calldata) >= 4 ? slice(calldata, 0, 4) : calldata;
  const words = toWords(calldata);
  const base = { calldata, selector, words };

  if (opts.toAbi) {
    const decoded = decodeWithAbi(calldata, opts.toAbi);
    if (decoded) return { ...base, source: "explorer", decoded };
  }

  const local = decodeWithAbi(calldata, localFunctionAbi);
  if (local) return { ...base, source: "local", decoded: local };

  const viaDb = await decodeViaSignatureDb(calldata, selector);
  if (viaDb) return { ...base, source: "signature", decoded: viaDb };

  return { ...base, source: null, decoded: null };
}

// ---------------------------------------------------------------------------
// Transaction fetch
// ---------------------------------------------------------------------------

export async function fetchTxData(
  hash: Hex,
): Promise<{ tx: TxOverview; logs: readonly Log[] }> {
  let transaction;
  try {
    transaction = await publicClient.getTransaction({ hash });
  } catch (error) {
    if (error instanceof TransactionNotFoundError) {
      throw new DecoderError("Transaction not found on Robinhood Chain.");
    }
    throw error;
  }

  let receipt = null;
  try {
    receipt = await publicClient.getTransactionReceipt({ hash });
  } catch (error) {
    if (!(error instanceof TransactionReceiptNotFoundError)) throw error;
    // No receipt yet → transaction is still pending.
  }

  let timestamp: bigint | null = null;
  if (transaction.blockNumber != null) {
    try {
      const block = await publicClient.getBlock({
        blockNumber: transaction.blockNumber,
      });
      timestamp = block.timestamp;
    } catch {
      timestamp = null;
    }
  }

  const gasUsed = receipt?.gasUsed ?? null;
  const effectiveGasPrice = receipt?.effectiveGasPrice ?? null;
  const fee =
    gasUsed != null && effectiveGasPrice != null
      ? gasUsed * effectiveGasPrice
      : null;

  return {
    tx: {
      hash,
      status: receipt ? receipt.status : "pending",
      blockNumber: transaction.blockNumber,
      timestamp,
      from: transaction.from,
      to: transaction.to,
      value: transaction.value,
      gasUsed,
      effectiveGasPrice,
      fee,
      nonce: transaction.nonce,
      contractAddress: receipt?.contractAddress ?? null,
      input: transaction.input,
    },
    logs: receipt?.logs ?? [],
  };
}

// ---------------------------------------------------------------------------
// Log decoding
// ---------------------------------------------------------------------------

/**
 * Pick the event whose selector (topic0) AND indexed-argument count both match
 * the log; this is what disambiguates ERC-20 vs ERC-721 `Transfer`/`Approval`,
 * which share a topic0 but index a different number of arguments.
 */
function pickEventItem(
  abi: readonly AbiEvent[],
  topics: readonly Hex[],
): AbiEvent | null {
  if (topics.length === 0) return null;
  const signature = topics[0];
  const indexedCount = topics.length - 1;
  const matches = abi.filter((event) => toEventSelector(event) === signature);
  if (matches.length === 0) return null;
  const exact = matches.find(
    (event) =>
      event.inputs.filter((input) => "indexed" in input && input.indexed)
        .length === indexedCount,
  );
  return exact ?? matches[0];
}

function decodeLogWithAbi(log: Log, abi: readonly AbiEvent[]): Decoded | null {
  const item = pickEventItem(abi, log.topics);
  if (!item) return null;
  try {
    const { args } = decodeEventLog({
      abi: [item],
      topics: log.topics,
      data: log.data,
    });
    return buildDecoded(
      item.name,
      item.inputs,
      args as readonly unknown[] | Record<string, unknown> | undefined,
    );
  } catch {
    return null;
  }
}

/**
 * Decode a transaction's logs. Every log is first matched against the local
 * known-event ABI; logs that don't match have their emitting contract's verified
 * ABI fetched from Blockscout (deduped) and are retried. Anything still
 * undecoded is returned raw.
 */
export async function decodeLogs(logs: readonly Log[]): Promise<DecodedLog[]> {
  const firstPass = logs.map((log) => ({
    log,
    decoded: decodeLogWithAbi(log, knownEventAbi),
  }));

  const unknownAddresses = [
    ...new Set(
      firstPass
        .filter((entry) => !entry.decoded)
        .map((entry) => entry.log.address.toLowerCase()),
    ),
  ];

  const abiEntries = await Promise.all(
    unknownAddresses.map(
      async (address) =>
        [address, await fetchContractAbi(address as Address)] as const,
    ),
  );
  const abiByAddress = new Map(abiEntries);

  return firstPass.map(({ log, decoded }): DecodedLog => {
    const logIndex = log.logIndex == null ? -1 : Number(log.logIndex);
    if (decoded) {
      return {
        address: log.address,
        logIndex,
        decoded,
        source: "known",
        topics: log.topics,
        data: log.data,
      };
    }

    const abi = abiByAddress.get(log.address.toLowerCase());
    if (abi) {
      const events = abi.filter(
        (item): item is AbiEvent => item.type === "event",
      );
      const viaExplorer = decodeLogWithAbi(log, events);
      if (viaExplorer) {
        return {
          address: log.address,
          logIndex,
          decoded: viaExplorer,
          source: "explorer",
          topics: log.topics,
          data: log.data,
        };
      }
    }

    return {
      address: log.address,
      logIndex,
      decoded: null,
      source: null,
      topics: log.topics,
      data: log.data,
    };
  });
}
