import { createPublicClient, http } from "viem";

import { RPC_URL, robinhoodChain } from "@/lib/chain";

/**
 * Read-only viem client for tools that talk to the chain without a wallet.
 * Multicall batching is on, so many reads collapse into a single RPC round-trip.
 */
export const publicClient = createPublicClient({
  chain: robinhoodChain,
  transport: http(RPC_URL),
  batch: { multicall: true },
});
