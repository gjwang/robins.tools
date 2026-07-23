import { type ContractFunctionParameters, erc20Abi, getAddress } from "viem";

import { robinhoodChain } from "@/lib/chain";
import { publicClient } from "@/lib/public-client";

/** Multicall3 address on Robinhood Chain (from the chain config, never hardcoded). */
export const MULTICALL3_ADDRESS = robinhoodChain.contracts.multicall3.address;

/** Multicall3 `getEthBalance(address)`; lets native ETH ride the same multicall pipeline. */
export const getEthBalanceAbi = [
  {
    type: "function",
    name: "getEthBalance",
    stateMutability: "view",
    inputs: [{ name: "addr", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
] as const;

/** Largest number of calls we pack into a single multicall request. */
export const CHUNK_SIZE = 300;
export const MAX_ADDRESSES = 500;
export const MAX_TOKENS = 5;

export interface TokenInfo {
  address: `0x${string}`;
  symbol: string;
  decimals: number;
}

/** A table column: the native ETH column has a null address, tokens carry theirs. */
export interface BalanceColumn {
  address: `0x${string}` | null;
  symbol: string;
  decimals: number;
}

/** The native ETH column, always first. */
export const ETH_COLUMN: BalanceColumn = {
  address: null,
  symbol: "ETH",
  decimals: 18,
};

/** One planned read: which cell (row × column) it fills and the call to make. */
export interface BalanceCall {
  rowIndex: number;
  colIndex: number;
  contract: ContractFunctionParameters;
}

/**
 * Read `symbol`/`decimals` for a candidate ERC-20. Throws when `decimals()` is
 * unreadable (i.e. the address is not a usable ERC-20); `symbol()` is optional
 * and falls back to a short form of the address.
 */
export async function fetchTokenMeta(
  address: `0x${string}`,
): Promise<TokenInfo> {
  const checksummed = getAddress(address);
  const [symbolRes, decimalsRes] = await publicClient.multicall({
    contracts: [
      { address: checksummed, abi: erc20Abi, functionName: "symbol" },
      { address: checksummed, abi: erc20Abi, functionName: "decimals" },
    ],
    allowFailure: true,
  });

  if (decimalsRes.status !== "success") {
    throw new Error("No readable ERC-20 at this address");
  }
  const decimals = Number(decimalsRes.result);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new Error("Token reports an invalid number of decimals");
  }

  const symbol =
    symbolRes.status === "success" &&
    typeof symbolRes.result === "string" &&
    symbolRes.result.trim() !== ""
      ? symbolRes.result.trim()
      : `${checksummed.slice(0, 6)}…${checksummed.slice(-4)}`;

  return { address: checksummed, symbol, decimals };
}

/** Build one call per (address, column): getEthBalance for ETH, balanceOf for tokens. */
export function buildBalanceCalls(
  addresses: readonly `0x${string}`[],
  tokens: readonly TokenInfo[],
): BalanceCall[] {
  const calls: BalanceCall[] = [];
  for (let row = 0; row < addresses.length; row++) {
    const addr = addresses[row];
    calls.push({
      rowIndex: row,
      colIndex: 0,
      contract: {
        address: MULTICALL3_ADDRESS,
        abi: getEthBalanceAbi,
        functionName: "getEthBalance",
        args: [addr],
      },
    });
    for (let t = 0; t < tokens.length; t++) {
      calls.push({
        rowIndex: row,
        colIndex: t + 1,
        contract: {
          address: tokens[t].address,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [addr],
        },
      });
    }
  }
  return calls;
}

/** Split a flat list into fixed-size chunks. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * Run one chunk of calls as a single multicall. Returns a value per call,
 * aligned with the input order; a per-call failure yields `null` for that cell.
 * A whole-request failure (network error) throws and the caller retries the chunk.
 */
export async function runBalanceChunk(
  calls: readonly BalanceCall[],
): Promise<(bigint | null)[]> {
  const results = await publicClient.multicall({
    contracts: calls.map((call) => call.contract),
    allowFailure: true,
  });
  return results.map((res) =>
    res.status === "success" ? (res.result as bigint) : null,
  );
}
