import { formatUnits } from "viem";

/**
 * Shorten an address to `0x1234…cdef`. `chars` controls how many hex characters
 * are kept on each side (default 4). Short strings are returned unchanged.
 */
export function truncateAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}

/**
 * Format a raw token amount (bigint, base units) for display: integer part gets
 * thousand separators, the fractional part is trimmed to `maxFrac` significant
 * decimals. Integer precision is never lost; only display decimals are capped.
 */
export function formatTokenAmount(
  value: bigint,
  decimals: number,
  maxFrac = 6,
): string {
  const raw = formatUnits(value, decimals);
  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [intPart, fracPart = ""] = unsigned.split(".");
  const intFormatted = BigInt(intPart).toLocaleString("en-US");
  const frac = fracPart.slice(0, maxFrac).replace(/0+$/, "");
  const body = frac ? `${intFormatted}.${frac}` : intFormatted;
  return negative ? `-${body}` : body;
}
