import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { ReactNode } from "react";

import { source } from "@/lib/source";

import "./docs.css";

/**
 * Docs section layout.
 *
 * The root app layout already renders next-themes and the global SiteHeader on
 * every route, so here:
 *  - `RootProvider` runs with `theme={{ enabled: false }}`; next-themes stays
 *    the single theme source; fumadocs only wires search + context.
 *  - Search uses the static Orama index (`/api/search`), so it needs no server.
 *  - `DocsLayout` runs with `nav={{ enabled: false }}` so fumadocs' own navbar
 *    does not stack a second header under the site header. Navigation is the
 *    left sidebar (page tree) + right TOC; search is available via Ctrl/Cmd+K.
 */
export default function DocsRootLayout({ children }: { children: ReactNode }) {
  return (
    <RootProvider
      theme={{ enabled: false }}
      search={{ options: { type: "static" } }}
    >
      <DocsLayout
        tree={source.pageTree}
        nav={{ enabled: false }}
        sidebar={{ defaultOpenLevel: 1 }}
      >
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
