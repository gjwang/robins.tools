import { BaseError } from "viem";

/** Human-readable message from an unknown thrown value, preferring viem's shortMessage. */
export function errorMessage(err: unknown): string {
  if (err instanceof BaseError) return err.shortMessage;
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}

/** A small example list users can download to see the expected CSV shape. */
export const EXAMPLE_CSV = `address,amount
0x70997970C51812dc3A010C7d01b50e0d17dc79C8,1.5
0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC,0.25
0x90F79bf6EB2c4f870365E785982E1f101E93b906,2
`;

/** Trigger a client-side download of `content` as `filename`. */
export function downloadTextFile(
  filename: string,
  content: string,
  type = "text/csv",
): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
