/** Shared, framework-free types for the Multisender tool. */

/** Which asset is being sent. */
export type TokenKind = "native" | "erc20";

/** How per-recipient amounts are derived from the imported list. */
export type AmountMode = "custom" | "fixed" | "split" | "proportional";

/**
 * ERC-20 approval strategy. `total` grants one allowance covering every chunk
 * (fewer signatures); `per-chunk` grants exactly one chunk's worth before each
 * disperse (tighter, shorter-lived allowances).
 */
export type ApprovalStrategy = "total" | "per-chunk";

/** The resolved token the user is dispersing. */
export type SelectedToken =
  | { kind: "native"; symbol: "ETH"; decimals: 18 }
  | {
      kind: "erc20";
      address: `0x${string}`;
      name: string;
      symbol: string;
      decimals: number;
      /** Sender's balance at load time, base units. */
      balance: bigint;
    };

/** The ERC-20 branch of `SelectedToken`, loaded from chain. */
export type Erc20Token = Extract<SelectedToken, { kind: "erc20" }>;

/** One resolved payout: an address and its exact amount in base units. */
export interface Allocation {
  address: `0x${string}`;
  value: bigint;
}
