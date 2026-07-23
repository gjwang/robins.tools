import { parseUnits } from "viem";

import type { ParsedEntry } from "@/lib/parse-addresses";

import type { Allocation, AmountMode } from "./types";

export interface ComputeInput {
  /** Deduplicated, valid recipient rows in source order. */
  entries: ParsedEntry[];
  mode: AmountMode;
  decimals: number;
  /** Used by `fixed`: amount every wallet receives (human units). */
  fixedAmount: string;
  /** Used by `split` and `proportional`: the pool to distribute (human units). */
  totalAmount: string;
}

export interface ComputeResult {
  allocations: Allocation[];
  /** Sum of all allocations, base units. */
  total: bigint;
  /** Non-blocking explanations to surface to the user (e.g. remainder handling). */
  notes: string[];
  /** Blocking problems; when non-empty the plan is not sendable. */
  errors: string[];
}

/** Split a decimal string into its integer digits scaled to `scale` fractionals. */
function scaleToBigInt(dec: string, scale: number): bigint {
  const [intPart, fracPart = ""] = dec.split(".");
  return BigInt(intPart + fracPart.padEnd(scale, "0"));
}

function fractionDigits(dec: string): number {
  const [, fracPart = ""] = dec.split(".");
  return fracPart.length;
}

/** Parse a human amount to base units, returning null on overflow/precision errors. */
function toBaseUnits(amount: string, decimals: number): bigint | null {
  try {
    return parseUnits(amount, decimals);
  } catch {
    return null;
  }
}

const EMPTY: ComputeResult = {
  allocations: [],
  total: 0n,
  notes: [],
  errors: [],
};

/**
 * Resolve the imported recipients + amount mode into exact per-recipient payouts
 * in base units. All arithmetic is bigint; no floating point ever touches an
 * amount. Rounding remainders are assigned deterministically and disclosed via
 * `notes`; any zero payout is a blocking error (the tool never sends zero).
 */
export function computeAllocations(input: ComputeInput): ComputeResult {
  const { entries, mode, decimals, fixedAmount, totalAmount } = input;
  if (entries.length === 0) return EMPTY;

  const notes: string[] = [];
  const errors: string[] = [];
  let allocations: Allocation[] = [];

  if (mode === "custom") {
    const missing = entries.filter((e) => e.amount === undefined).length;
    if (missing > 0) {
      errors.push(
        `Custom amounts need an amount on every row (address,amount). ${missing} row(s) have no amount.`,
      );
      return { allocations: [], total: 0n, notes, errors };
    }
    allocations = entries.map((e) => {
      const value = toBaseUnits(e.amount as string, decimals) ?? -1n;
      return { address: e.address, value };
    });
    if (allocations.some((a) => a.value < 0n)) {
      errors.push(
        `Some amounts have more than ${decimals} decimal places for this token.`,
      );
      return { allocations: [], total: 0n, notes, errors };
    }
  } else if (mode === "fixed") {
    if (fixedAmount.trim() === "") {
      errors.push("Enter the amount each wallet should receive.");
      return { allocations: [], total: 0n, notes, errors };
    }
    const per = toBaseUnits(fixedAmount, decimals);
    if (per === null) {
      errors.push(
        `Amount has more than ${decimals} decimal places for this token.`,
      );
      return { allocations: [], total: 0n, notes, errors };
    }
    allocations = entries.map((e) => ({ address: e.address, value: per }));
  } else if (mode === "split") {
    if (totalAmount.trim() === "") {
      errors.push("Enter the total amount to split equally.");
      return { allocations: [], total: 0n, notes, errors };
    }
    const total = toBaseUnits(totalAmount, decimals);
    if (total === null) {
      errors.push(
        `Total has more than ${decimals} decimal places for this token.`,
      );
      return { allocations: [], total: 0n, notes, errors };
    }
    const n = BigInt(entries.length);
    const per = total / n;
    const remainder = total - per * n;
    allocations = entries.map((e, i) => ({
      address: e.address,
      value: i === 0 ? per + remainder : per,
    }));
    if (remainder > 0n) {
      notes.push(
        `Not evenly divisible: the remainder of ${remainder.toString()} base unit(s) goes to the first recipient.`,
      );
    }
  } else {
    // proportional
    const missing = entries.filter((e) => e.amount === undefined).length;
    if (missing > 0) {
      errors.push(
        `Proportional mode needs a weight on every row (address,weight). ${missing} row(s) have no weight.`,
      );
      return { allocations: [], total: 0n, notes, errors };
    }
    if (totalAmount.trim() === "") {
      errors.push("Enter the total amount to distribute by weight.");
      return { allocations: [], total: 0n, notes, errors };
    }
    const total = toBaseUnits(totalAmount, decimals);
    if (total === null) {
      errors.push(
        `Total has more than ${decimals} decimal places for this token.`,
      );
      return { allocations: [], total: 0n, notes, errors };
    }
    const scale = Math.max(
      ...entries.map((e) => fractionDigits(e.amount as string)),
    );
    const weights = entries.map((e) =>
      scaleToBigInt(e.amount as string, scale),
    );
    const sumWeights = weights.reduce((acc, w) => acc + w, 0n);
    if (sumWeights === 0n) {
      errors.push("Weights must add up to more than zero.");
      return { allocations: [], total: 0n, notes, errors };
    }
    allocations = entries.map((e, i) => ({
      address: e.address,
      value: (total * weights[i]) / sumWeights,
    }));
    const assigned = allocations.reduce((acc, a) => acc + a.value, 0n);
    const remainder = total - assigned;
    if (remainder > 0n) {
      let largest = 0;
      for (let i = 1; i < weights.length; i++) {
        if (weights[i] > weights[largest]) largest = i;
      }
      allocations[largest] = {
        address: allocations[largest].address,
        value: allocations[largest].value + remainder,
      };
      notes.push(
        `Rounded down per recipient: the remainder of ${remainder.toString()} base unit(s) goes to the largest-weight recipient.`,
      );
    }
  }

  const zeros = allocations.filter((a) => a.value === 0n).length;
  if (zeros > 0) {
    errors.push(
      `${zeros} recipient(s) would receive zero. Remove them or raise the total or amount. Zero sends are not allowed.`,
    );
  }

  const total = allocations.reduce((acc, a) => acc + a.value, 0n);
  return { allocations, total, notes, errors };
}

/** Split an array into fixed-size chunks (last chunk may be shorter). */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
