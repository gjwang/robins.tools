import type { AbiParameter, Address, Hex } from "viem";

/** Which shape the smart input resolved to. */
export type InputMode = "tx" | "calldata";

/** Where a decoded ABI came from; surfaced to the user as a small badge. */
export type AbiSource = "explorer" | "local" | "signature";

/** A single decoded argument: its label, its ABI type info, and the raw value. */
export interface DecodedArg {
  /** Parameter name from the ABI, or `#i` when unnamed. */
  name: string;
  /** ABI parameter (carries the solidity type and, for tuples, `components`). */
  param: AbiParameter;
  /** Raw decoded value (bigint, string, boolean, array, tuple object, …). */
  value: unknown;
}

/** A decoded function call or event, ready to render. */
export interface Decoded {
  /** Function or event name. */
  name: string;
  /** Human-readable signature with parameter names. */
  signature: string;
  args: DecodedArg[];
}

/** One 32-byte word of raw calldata, with its byte offset into the argument data. */
export interface RawWord {
  offset: number;
  word: Hex;
}

/** Result of running the calldata-decoding ladder. */
export interface CalldataResult {
  calldata: Hex;
  /** 4-byte function selector. */
  selector: Hex;
  /** Which ladder rung produced `decoded`, or null when nothing decoded. */
  source: AbiSource | null;
  /** Decoded call, or null when the selector is unknown. */
  decoded: Decoded | null;
  /** Argument data split into 32-byte words (fallback view for unknown calls). */
  words: RawWord[];
}

/** Overview of a fetched transaction. */
export interface TxOverview {
  hash: Hex;
  status: "success" | "reverted" | "pending";
  blockNumber: bigint | null;
  timestamp: bigint | null;
  from: Address;
  to: Address | null;
  value: bigint;
  gasUsed: bigint | null;
  effectiveGasPrice: bigint | null;
  /** gasUsed × effectiveGasPrice, in wei. */
  fee: bigint | null;
  nonce: number;
  /** Set when the tx created a contract (`to` is null). */
  contractAddress: Address | null;
  input: Hex;
}

/** A single decoded (or raw) event log. */
export interface DecodedLog {
  address: Address;
  logIndex: number;
  decoded: Decoded | null;
  /** "known" = local token ABI, "explorer" = emitter's verified ABI. */
  source: "known" | "explorer" | null;
  topics: readonly Hex[];
  data: Hex;
}
