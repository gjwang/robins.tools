"use client";

import { type ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { type Config, cookieToInitialState, WagmiProvider } from "wagmi";
import { ThemeProvider } from "next-themes";

import { AppKitThemeSync } from "@/components/appkit-theme-sync";
import { robinhoodChain } from "@/lib/chain";
import {
  appKitEnabled,
  networks,
  projectId,
  wagmiAdapter,
  wagmiConfig,
} from "@/lib/wagmi";

// Initialise AppKit once, at module load. Skipped entirely when no project id
// is configured so the rest of the app keeps working without wallet support.
if (appKitEnabled) {
  createAppKit({
    adapters: [wagmiAdapter],
    networks,
    defaultNetwork: robinhoodChain,
    projectId,
    metadata: {
      name: "robins.tools",
      description: "Open-source, privacy-first toolkit for Robinhood Chain.",
      url: "https://robins.tools",
      icons: ["https://robins.tools/logo.png"],
    },
    features: {
      analytics: false,
      email: false,
      socials: false,
      onramp: false,
      swaps: false,
      history: false,
    },
    allowUnsupportedChain: false,
    themeVariables: {
      "--w3m-accent": "#CFFF00",
    },
  });
}

export function Providers({
  children,
  cookies,
}: {
  children: ReactNode;
  cookies: string | null;
}) {
  const [queryClient] = useState(() => new QueryClient());
  const initialState = cookieToInitialState(wagmiConfig as Config, cookies);

  return (
    <WagmiProvider config={wagmiConfig as Config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {appKitEnabled ? <AppKitThemeSync /> : null}
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
