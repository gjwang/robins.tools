/**
 * Vanity address grinder; runs entirely inside a dedicated Web Worker so the
 * search never blocks the UI and the generated private key never leaves the
 * tab. No network access is used or available here.
 *
 * Strategy: seed one cryptographically random scalar `k` (the private key),
 * compute `P = k·G` once, then walk the curve incrementally; each step is a
 * single point addition (`P += G`, `k += 1`) instead of a full scalar
 * multiplication, which is orders of magnitude faster per candidate address.
 */
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";

import {
  ADDRESS_NIBBLES,
  type VanityRequest,
  type VanityResponse,
} from "./types";

// `self` inside a worker is a DedicatedWorkerGlobalScope. We only need
// postMessage/onmessage, typed to our own protocol, so cast to a minimal shape
// (avoids pulling in the conflicting "webworker" lib alongside "dom").
type WorkerScope = {
  postMessage(message: VanityResponse): void;
  onmessage: ((event: MessageEvent<VanityRequest>) => void) | null;
};
const ctx = self as unknown as WorkerScope;

const Point = secp256k1.Point;
const CURVE_ORDER = Point.Fn.ORDER;

const REPORT_INTERVAL_MS = 250;
/** Addresses tried per scheduled chunk before yielding to the event loop. */
const CHUNK_SIZE = 4096;

let running = false;
let prefixNibbles: number[] = [];
let suffixNibbles: number[] = [];

let scalar = 1n;
let point = Point.BASE;
let attemptsSinceReport = 0;
let lastReportAt = 0;

function toNibbles(hex: string): number[] {
  const out: number[] = [];
  for (const ch of hex) out.push(parseInt(ch, 16));
  return out;
}

/** Compare the leading nibbles of the 20-byte address against the prefix. */
function matchesPrefix(address: Uint8Array): boolean {
  for (let i = 0; i < prefixNibbles.length; i++) {
    const byte = address[i >> 1];
    const nibble = (i & 1) === 0 ? byte >> 4 : byte & 0x0f;
    if (nibble !== prefixNibbles[i]) return false;
  }
  return true;
}

/** Compare the trailing nibbles of the 20-byte address against the suffix. */
function matchesSuffix(address: Uint8Array): boolean {
  const start = ADDRESS_NIBBLES - suffixNibbles.length;
  for (let j = 0; j < suffixNibbles.length; j++) {
    const i = start + j;
    const byte = address[i >> 1];
    const nibble = (i & 1) === 0 ? byte >> 4 : byte & 0x0f;
    if (nibble !== suffixNibbles[j]) return false;
  }
  return true;
}

/** 256-bit CSPRNG seed reduced into the valid scalar range [1, n-1]. */
function randomScalar(): bigint {
  const seed = crypto.getRandomValues(new Uint8Array(32));
  let k = 0n;
  for (let i = 0; i < seed.length; i++) k = (k << 8n) | BigInt(seed[i]);
  k %= CURVE_ORDER;
  return k === 0n ? 1n : k;
}

function toPrivateKeyHex(k: bigint): string {
  return "0x" + k.toString(16).padStart(64, "0");
}

function toAddressHex(address: Uint8Array): string {
  let hex = "0x";
  for (let i = 0; i < address.length; i++) {
    hex += address[i].toString(16).padStart(2, "0");
  }
  return hex;
}

/** Derive the 20-byte address from the current curve point. */
function currentAddress(): Uint8Array {
  // Uncompressed SEC1 encoding: 0x04 || X(32) || Y(32). Ethereum hashes the
  // 64-byte public key (X||Y), so drop the 0x04 prefix byte.
  const uncompressed = point.toBytes(false);
  const hashed = keccak_256(uncompressed.subarray(1));
  return hashed.subarray(12);
}

function advance(): void {
  scalar += 1n;
  if (scalar >= CURVE_ORDER) {
    // Practically unreachable, but keep the scalar valid (never 0, never ≥ n).
    scalar = 1n;
    point = Point.BASE;
  } else {
    point = point.add(Point.BASE);
  }
}

function grindChunk(): void {
  if (!running) return;

  for (let i = 0; i < CHUNK_SIZE; i++) {
    const address = currentAddress();
    attemptsSinceReport++;
    if (matchesPrefix(address) && matchesSuffix(address)) {
      running = false;
      ctx.postMessage({
        type: "match",
        address: toAddressHex(address),
        privateKey: toPrivateKeyHex(scalar),
      });
      return;
    }
    advance();
  }

  const now = Date.now();
  if (now - lastReportAt >= REPORT_INTERVAL_MS) {
    ctx.postMessage({ type: "progress", attempts: attemptsSinceReport });
    attemptsSinceReport = 0;
    lastReportAt = now;
  }

  if (running) setTimeout(grindChunk, 0);
}

ctx.onmessage = (event) => {
  const message = event.data;

  if (message.type === "stop") {
    running = false;
    return;
  }

  prefixNibbles = toNibbles(message.prefix);
  suffixNibbles = toNibbles(message.suffix);
  scalar = randomScalar();
  point = Point.BASE.multiply(scalar);
  attemptsSinceReport = 0;
  lastReportAt = Date.now();
  running = true;
  grindChunk();
};
