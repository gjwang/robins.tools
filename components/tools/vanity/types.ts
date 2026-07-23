/**
 * Message protocol shared between the vanity UI (main thread) and each grinder
 * Web Worker. Keys never leave the worker except via a `match` message, which
 * stays inside the page; nothing is ever sent over the network.
 */

/** Main thread → worker: begin grinding for the given hex pattern. */
export interface VanityStartMessage {
  type: "start";
  /** Lowercase hex nibbles the address must start with (no `0x`). */
  prefix: string;
  /** Lowercase hex nibbles the address must end with. */
  suffix: string;
}

/** Main thread → worker: stop grinding and go idle. */
export interface VanityStopMessage {
  type: "stop";
}

export type VanityRequest = VanityStartMessage | VanityStopMessage;

/** Worker → main thread: number of addresses tried since the last report. */
export interface VanityProgressMessage {
  type: "progress";
  attempts: number;
}

/** Worker → main thread: a matching keypair was found; the worker has stopped. */
export interface VanityMatchMessage {
  type: "match";
  /** `0x` + 40 lowercase hex chars. */
  address: string;
  /** `0x` + 64 lowercase hex chars. */
  privateKey: string;
}

export type VanityResponse = VanityProgressMessage | VanityMatchMessage;

/** An Ethereum address is 20 bytes = 40 hex nibbles. */
export const ADDRESS_NIBBLES = 40;

/** Combined prefix + suffix length beyond which the search is impractical. */
export const MAX_COMBINED_LENGTH = 12;
