import { loader } from "fumadocs-core/source";

// fumadocs-mdx 15 emits environment-specific runtimes (server/browser/dynamic)
// into `.source`; there is no re-exporting `index.ts` from the standalone CLI.
// `source` is only ever imported from Server Components / route handlers (the
// docs layout passes `pageTree` down as a prop), so the server runtime is the
// correct, build- and typecheck-stable entry.
import { docs } from "@/.source/server";

// The docs tree is served under `/docs`. `docs.toFumadocsSource()` comes from
// the fumadocs-mdx generated `.source` runtime (run `pnpm exec fumadocs-mdx`).
export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
});
