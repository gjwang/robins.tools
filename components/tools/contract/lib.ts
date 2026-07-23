import {
  type Abi,
  type AbiFunction,
  type AbiParameter,
  BaseError,
  getAddress,
  isAddress,
  isHex,
  parseAbi,
} from "viem";

import { EXPLORER_API } from "@/lib/explorer";

export type ContractSource = "verified" | "pasted";

export interface LoadedContract {
  address: `0x${string}`;
  abi: Abi;
  /** Contract name from the explorer, or null for pasted / unnamed contracts. */
  name: string | null;
  source: ContractSource;
  /** Set when the address is a proxy and we loaded the implementation's ABI. */
  proxyImplementation: `0x${string}` | null;
}

export type FetchAbiResult =
  | {
      status: "verified";
      abi: Abi;
      name: string | null;
      proxyImplementation: `0x${string}` | null;
    }
  | { status: "unverified" };

/** Subset of the Blockscout `smart-contracts/{address}` response we rely on. */
interface BlockscoutContract {
  abi?: Abi | null;
  name?: string | null;
  is_verified?: boolean;
  proxy_type?: string | null;
  implementations?: Array<{
    address?: string;
    address_hash?: string;
    name?: string | null;
  }> | null;
}

function extractImplementationAddress(
  data: BlockscoutContract,
): string | undefined {
  const impls = data.implementations ?? [];
  for (const impl of impls) {
    const candidate = impl.address ?? impl.address_hash;
    if (candidate && isAddress(candidate)) return candidate;
  }
  return undefined;
}

async function fetchContract(
  address: string,
): Promise<BlockscoutContract | null> {
  const res = await fetch(`${EXPLORER_API}/smart-contracts/${address}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Explorer responded with ${res.status}. Try again.`);
  }
  return (await res.json()) as BlockscoutContract;
}

/**
 * Load a contract's ABI from Blockscout. Follows proxies: when the address is a
 * proxy with a known implementation, the implementation's ABI is returned but is
 * meant to be used AT the proxy address.
 */
export async function fetchVerifiedAbi(
  address: `0x${string}`,
): Promise<FetchAbiResult> {
  const data = await fetchContract(address);
  if (!data || !Array.isArray(data.abi) || data.abi.length === 0) {
    return { status: "unverified" };
  }

  const implAddress = extractImplementationAddress(data);
  if (implAddress) {
    try {
      const impl = await fetchContract(implAddress);
      if (impl && Array.isArray(impl.abi) && impl.abi.length > 0) {
        return {
          status: "verified",
          abi: impl.abi,
          name: data.name ?? impl.name ?? null,
          proxyImplementation: getAddress(implAddress),
        };
      }
    } catch {
      // Fall back to the proxy's own ABI if the implementation fetch fails.
    }
  }

  return {
    status: "verified",
    abi: data.abi,
    name: data.name ?? null,
    proxyImplementation: null,
  };
}

/**
 * Parse a pasted ABI. Accepts a JSON array, a Hardhat/Foundry artifact object
 * with an `abi` field, or newline-separated human-readable signatures.
 */
export function parsePastedAbi(text: string): Abi {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Paste an ABI to continue.");

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    let json: unknown;
    try {
      json = JSON.parse(trimmed);
    } catch {
      throw new Error(
        "Invalid JSON. Check for trailing commas or stray quotes.",
      );
    }
    const arr = Array.isArray(json) ? json : (json as { abi?: unknown }).abi;
    if (!Array.isArray(arr)) {
      throw new Error(
        'Expected a JSON ABI array, or an artifact object with an "abi" field.',
      );
    }
    return arr as Abi;
  }

  const lines = trimmed
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  try {
    return parseAbi(lines);
  } catch (error) {
    throw new Error(
      `Could not parse human-readable ABI: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
  }
}

function isFunction(item: Abi[number]): item is AbiFunction {
  return item.type === "function";
}

export function getReadFunctions(abi: Abi): AbiFunction[] {
  return abi
    .filter(isFunction)
    .filter(
      (fn) => fn.stateMutability === "view" || fn.stateMutability === "pure",
    );
}

export function getWriteFunctions(abi: Abi): AbiFunction[] {
  return abi
    .filter(isFunction)
    .filter(
      (fn) =>
        fn.stateMutability === "nonpayable" || fn.stateMutability === "payable",
    );
}

export function functionSignature(fn: AbiFunction): string {
  return `${fn.name}(${fn.inputs.map((input) => input.type).join(", ")})`;
}

export function paramLabel(param: AbiParameter, index: number): string {
  const name = param.name && param.name.length > 0 ? param.name : `arg${index}`;
  return `${name} (${param.type})`;
}

function tupleComponents(param: AbiParameter): readonly AbiParameter[] {
  return (param as { components?: readonly AbiParameter[] }).components ?? [];
}

/** True for array or tuple params, which are collected as JSON in a textarea. */
export function isJsonParam(param: AbiParameter): boolean {
  return param.type.includes("[") || param.type.startsWith("tuple");
}

function coerceInteger(type: string, value: string, label: string): bigint {
  if (!/^-?\d+$/.test(value)) {
    throw new Error(`${label}: must be a whole number.`);
  }
  let parsed: bigint;
  try {
    parsed = BigInt(value);
  } catch {
    throw new Error(`${label}: not a valid integer.`);
  }
  if (type.startsWith("uint") && parsed < 0n) {
    throw new Error(`${label}: unsigned values cannot be negative.`);
  }
  return parsed;
}

function coerceScalar(type: string, raw: unknown, label: string): unknown {
  if (type === "bool") {
    if (typeof raw === "boolean") return raw;
    if (raw === "true") return true;
    if (raw === "false") return false;
    throw new Error(`${label}: must be true or false.`);
  }

  const value = typeof raw === "string" ? raw.trim() : String(raw);

  if (type === "address") {
    if (!isAddress(value)) throw new Error(`${label}: not a valid address.`);
    return getAddress(value);
  }

  if (type.startsWith("uint") || type.startsWith("int")) {
    return coerceInteger(type, value, label);
  }

  if (type === "string") {
    return typeof raw === "string" ? raw : value;
  }

  if (type === "bytes" || /^bytes\d+$/.test(type)) {
    if (!isHex(value)) throw new Error(`${label}: must be 0x-prefixed hex.`);
    const fixed = type.match(/^bytes(\d+)$/);
    if (fixed) {
      const expected = Number(fixed[1]);
      const actual = (value.length - 2) / 2;
      if (actual !== expected) {
        throw new Error(
          `${label}: must be exactly ${expected} bytes (${expected * 2} hex chars).`,
        );
      }
    }
    return value;
  }

  // Uncommon types (fixed, function) pass through as-is.
  return value;
}

/** Recursively coerce a parsed JS value into the type viem expects for `param`. */
export function coerceArg(
  param: AbiParameter,
  raw: unknown,
  label: string,
): unknown {
  const arrayMatch = param.type.match(/^(.*)\[(\d*)\]$/);
  if (arrayMatch) {
    if (!Array.isArray(raw)) {
      throw new Error(`${label}: expected a JSON array.`);
    }
    const [, baseType, fixedLength] = arrayMatch;
    if (fixedLength && raw.length !== Number(fixedLength)) {
      throw new Error(
        `${label}: expected ${fixedLength} items, got ${raw.length}.`,
      );
    }
    const baseParam = { ...param, type: baseType } as AbiParameter;
    return raw.map((element, i) =>
      coerceArg(baseParam, element, `${label}[${i}]`),
    );
  }

  if (param.type === "tuple") {
    const components = tupleComponents(param);
    if (Array.isArray(raw)) {
      if (raw.length !== components.length) {
        throw new Error(
          `${label}: expected ${components.length} tuple values, got ${raw.length}.`,
        );
      }
      return components.map((component, i) =>
        coerceArg(component, raw[i], `${label}.${component.name || i}`),
      );
    }
    if (raw && typeof raw === "object") {
      const record = raw as Record<string, unknown>;
      return components.map((component, i) =>
        coerceArg(
          component,
          record[component.name ?? ""],
          `${label}.${component.name || i}`,
        ),
      );
    }
    throw new Error(`${label}: expected a JSON object or array for the tuple.`);
  }

  return coerceScalar(param.type, raw, label);
}

/**
 * Build the positional argument list for a call from the raw field values.
 * Throws a human-readable error naming the offending field on invalid input.
 */
export function buildArgs(
  inputs: readonly AbiParameter[],
  values: Record<number, string | boolean>,
): unknown[] {
  return inputs.map((param, index) => {
    const label = paramLabel(param, index);
    const raw = values[index];

    if (isJsonParam(param)) {
      const text = typeof raw === "string" ? raw.trim() : "";
      if (text === "") throw new Error(`${label}: enter a JSON value.`);
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error(`${label}: invalid JSON.`);
      }
      return coerceArg(param, parsed, label);
    }

    if (param.type === "bool") {
      return coerceArg(param, typeof raw === "boolean" ? raw : false, label);
    }

    const text = typeof raw === "string" ? raw : "";
    if (param.type === "string") {
      // Empty string is a valid string argument.
      return text;
    }
    if (text.trim() === "") throw new Error(`${label}: required.`);
    return coerceArg(param, text.trim(), label);
  });
}

/** Recursively convert bigints to strings so a result can be JSON-serialised. */
export function toJsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [
        key,
        toJsonSafe(val),
      ]),
    );
  }
  return value;
}

export function stringifyResult(value: unknown): string {
  return JSON.stringify(toJsonSafe(value), null, 2);
}

/** Best-effort human-readable message from a viem/unknown error. */
export function errorMessage(error: unknown): string {
  if (error instanceof BaseError) return error.shortMessage;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}
