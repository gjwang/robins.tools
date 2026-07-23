import type { MetadataRoute } from "next";

import { source } from "@/lib/source";
import { tools } from "@/lib/tools";

const BASE_URL = "https://robins.tools";

// Priority by route class. There is no reliable per-page modification time
// (content is not tracked with git timestamps here), so `lastModified` is
// intentionally omitted rather than stamped with a misleading build date.
function priorityFor(path: string): number {
  if (path === "") return 1;
  if (path === "/tools") return 0.9;
  if (path.startsWith("/tools/")) return 0.8;
  if (path === "/docs") return 0.7;
  return 0.6;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = ["", "/tools", "/docs", "/token"];
  const toolPaths = tools.map((tool) => `/tools/${tool.slug}`);
  const docPaths = source.getPages().map((page) => page.url);

  const paths = Array.from(
    new Set([...staticPaths, ...toolPaths, ...docPaths]),
  );

  return paths.map((path) => ({
    url: `${BASE_URL}${path}`,
    changeFrequency: "weekly",
    priority: priorityFor(path),
  }));
}
