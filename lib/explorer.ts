import { robinhoodChain } from "@/lib/chain";

/** Blockscout explorer base URL, e.g. https://robinhoodchain.blockscout.com */
export const EXPLORER_URL = robinhoodChain.blockExplorers.default.url;

/** Blockscout REST API v2 base, e.g. https://robinhoodchain.blockscout.com/api/v2 */
export const EXPLORER_API = `${EXPLORER_URL}/api/v2`;

export function txUrl(hash: string): string {
  return `${EXPLORER_URL}/tx/${hash}`;
}

export function addressUrl(address: string): string {
  return `${EXPLORER_URL}/address/${address}`;
}

export function tokenUrl(address: string): string {
  return `${EXPLORER_URL}/token/${address}`;
}

export function blockUrl(block: number | bigint): string {
  return `${EXPLORER_URL}/block/${block}`;
}
