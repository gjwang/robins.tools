import type { ParsedEntry } from "@/lib/parse-addresses";

/** Trigger a client-side download of `content` as `filename`. No network involved. */
export function downloadText(
  filename: string,
  content: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function entriesToCsv(
  entries: ParsedEntry[],
  hasAmounts: boolean,
): string {
  const header = hasAmounts ? "address,amount" : "address";
  const rows = entries.map((entry) =>
    hasAmounts ? `${entry.address},${entry.amount ?? ""}` : entry.address,
  );
  return [header, ...rows].join("\n") + "\n";
}

export function entriesToJson(
  entries: ParsedEntry[],
  hasAmounts: boolean,
): string {
  const data = entries.map((entry) =>
    hasAmounts
      ? { address: entry.address, amount: entry.amount ?? null }
      : { address: entry.address },
  );
  return JSON.stringify(data, null, 2) + "\n";
}

export function entriesToTxt(entries: ParsedEntry[]): string {
  return entries.map((entry) => entry.address).join("\n") + "\n";
}
