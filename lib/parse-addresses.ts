import { getAddress, isAddress } from "viem";

export interface ParsedEntry {
  /** EIP-55 checksummed address */
  address: `0x${string}`;
  /** Decimal amount string exactly as written (validated), if the row had one */
  amount?: string;
  /** 1-based line number in the source text */
  line: number;
  raw: string;
}

export interface InvalidEntry {
  line: number;
  raw: string;
  reason: string;
}

export interface ParseResult {
  /** All valid rows in source order, duplicates included */
  entries: ParsedEntry[];
  invalid: InvalidEntry[];
  /** True if at least one valid row carried an amount */
  hasAmounts: boolean;
  /** Number of distinct addresses among entries */
  uniqueCount: number;
}

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const AMOUNT_RE = /^\d+(\.\d+)?$/;

function stripQuotes(token: string): string {
  return token.replace(/^["']|["']$/g, "").trim();
}

/**
 * Parse a pasted or uploaded list of `address` / `address,amount` rows.
 * Accepts comma, semicolon, tab, or whitespace separators; skips blank lines
 * and lines starting with `#` or `//`; extra columns beyond the amount are ignored.
 */
export function parseAddressList(text: string): ParseResult {
  const entries: ParsedEntry[] = [];
  const invalid: InvalidEntry[] = [];
  const seen = new Set<string>();
  let hasAmounts = false;

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    const line = i + 1;
    if (raw === "" || raw.startsWith("#") || raw.startsWith("//")) continue;

    const tokens = raw
      .split(/[,;\t]|\s+/)
      .map(stripQuotes)
      .filter((t) => t !== "");

    const addressToken = tokens[0] ?? "";
    if (!ADDRESS_RE.test(addressToken)) {
      invalid.push({
        line,
        raw,
        reason:
          addressToken.startsWith("0x") || /^[0-9a-fA-F]+$/.test(addressToken)
            ? "Not a valid address (must be 0x + 40 hex characters)"
            : "Row does not start with an address",
      });
      continue;
    }

    // getAddress alone would silently "fix" a wrong mixed-case checksum;
    // EIP-55 says such addresses are likely typos and must be rejected.
    if (!isAddress(addressToken, { strict: true })) {
      invalid.push({
        line,
        raw,
        reason: "Invalid EIP-55 checksum (mixed-case)",
      });
      continue;
    }
    const address = getAddress(addressToken);

    let amount: string | undefined;
    if (tokens.length > 1 && tokens[1] !== "") {
      if (!AMOUNT_RE.test(tokens[1])) {
        invalid.push({ line, raw, reason: `Invalid amount "${tokens[1]}"` });
        continue;
      }
      amount = tokens[1];
      hasAmounts = true;
    }

    entries.push({ address, amount, line, raw });
    seen.add(address);
  }

  return { entries, invalid, hasAmounts, uniqueCount: seen.size };
}

/** Add two non-negative decimal strings exactly (no floats). */
export function addDecimalStrings(a: string, b: string): string {
  const [aInt, aFrac = ""] = a.split(".");
  const [bInt, bFrac = ""] = b.split(".");
  const scale = Math.max(aFrac.length, bFrac.length);
  const toScaled = (int: string, frac: string) =>
    BigInt(int + frac.padEnd(scale, "0"));
  const sum = toScaled(aInt, aFrac) + toScaled(bInt, bFrac);
  if (scale === 0) return sum.toString();
  const s = sum.toString().padStart(scale + 1, "0");
  const intPart = s.slice(0, -scale);
  const fracPart = s.slice(-scale).replace(/0+$/, "");
  return fracPart === "" ? intPart : `${intPart}.${fracPart}`;
}

/**
 * Collapse duplicate addresses. `keep-first` drops repeats;
 * `merge-amounts` sums their amounts (rows without amounts merge to one row).
 */
export function dedupeEntries(
  entries: ParsedEntry[],
  mode: "keep-first" | "merge-amounts" = "keep-first",
): ParsedEntry[] {
  const byAddress = new Map<string, ParsedEntry>();
  for (const entry of entries) {
    const existing = byAddress.get(entry.address);
    if (!existing) {
      byAddress.set(entry.address, { ...entry });
    } else if (mode === "merge-amounts" && entry.amount !== undefined) {
      existing.amount =
        existing.amount === undefined
          ? entry.amount
          : addDecimalStrings(existing.amount, entry.amount);
    }
  }
  return [...byAddress.values()];
}
