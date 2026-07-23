import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "robins.tools: open-source toolkit for Robinhood Chain",
    short_name: "robins.tools",
    description:
      "Open-source, privacy-first on-chain tools for Robinhood Chain. Transactions are built in your browser and signed by your wallet, with no server in between.",
    start_url: "/",
    display: "standalone",
    background_color: "#0E0B09",
    theme_color: "#CFFF00",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
