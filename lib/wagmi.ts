import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import type { AppKitNetwork } from "@reown/appkit/networks";
import { cookieStorage, createStorage, http } from "wagmi";

import { RPC_URL, robinhoodChain } from "@/lib/chain";

/** Reown AppKit project id. Empty in dev is allowed; the app degrades gracefully. */
export const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? "";

/** Wallet features are only wired up when a project id is configured. */
export const appKitEnabled = projectId.length > 0;

/** Single-network app: Robinhood Chain is the only selectable network. */
export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [robinhoodChain];

export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
  transports: { [robinhoodChain.id]: http(RPC_URL) },
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;
