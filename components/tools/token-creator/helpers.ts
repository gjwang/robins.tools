import { BaseError, formatEther, parseUnits, type Abi, type Hex } from "viem";

import robinsToken from "@/lib/abis/robins-token.json";

/** Compiled RobinsToken ABI (loose-typed so viem uses the runtime-value overloads). */
export const tokenAbi = robinsToken.abi as Abi;

/** Creation bytecode for RobinsToken. */
export const tokenBytecode = robinsToken.bytecode as Hex;

/** Solidity compiler version the artifact was built with (for the verification hint). */
export const solcLongVersion = robinsToken.solcVersion;

/** Contract name as it appears in the standard-JSON sources. */
export const contractName = robinsToken.contractName;

/** Result of validating the human-entered initial supply. */
export type SupplyParse =
  { ok: true; value: bigint } | { ok: false; error: string };

/**
 * Validate and scale a human-entered supply (e.g. "1000000.5") into raw base
 * units for the given `decimals`. Rejects non-numeric input and amounts with
 * more fractional digits than the token supports.
 */
export function parseSupply(input: string, decimals: number): SupplyParse {
  let s = input.trim();
  if (s === "")
    return { ok: false, error: "Enter an initial supply (use 0 for none)." };
  if (!/^\d*\.?\d*$/.test(s))
    return { ok: false, error: "Supply must be a positive number." };
  if (s.startsWith(".")) s = `0${s}`;
  if (s.endsWith(".")) s = s.slice(0, -1);
  if (s === "")
    return { ok: false, error: "Supply must be a positive number." };

  const frac = s.includes(".") ? s.split(".")[1] : "";
  if (frac.length > decimals) {
    return {
      ok: false,
      error: `Too many decimal places for a ${decimals}-decimal token.`,
    };
  }

  try {
    return { ok: true, value: parseUnits(s, decimals) };
  } catch {
    return { ok: false, error: "Invalid supply amount." };
  }
}

/** Format a wei fee as a trimmed ETH string (max 8 fractional digits), no floats. */
export function formatEthFee(wei: bigint): string {
  const [int, frac = ""] = formatEther(wei).split(".");
  const trimmed = frac.slice(0, 8).replace(/0+$/, "");
  return trimmed ? `${int}.${trimmed}` : int;
}

/** Turn an unknown thrown value into a human-readable, single-line message. */
export function humanizeError(err: unknown): string {
  if (err instanceof BaseError) return err.shortMessage || err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}

/**
 * Trigger a client-side download of the Solidity standard-JSON input used to
 * verify the deployed contract on Blockscout.
 */
export function downloadVerificationJson(): void {
  const json = JSON.stringify(robinsToken.standardJsonInput, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "robins-token-verification.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
