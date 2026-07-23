import { type Address, parseAbi } from "viem";

/**
 * Standard burn entry point. Detected by simulation before use; tokens that
 * don't expose it fall back to a dead-address transfer.
 */
export const burnAbi = parseAbi(["function burn(uint256 amount)"]);

/** Canonical "dead" address used to take tokens out of circulation. */
export const DEAD_ADDRESS: Address =
  "0x000000000000000000000000000000000000dEaD";

/** Which mechanism a burn will use for a given token. */
export type BurnPath = "burn" | "transfer";

export interface TokenInfo {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  balance: bigint;
}
