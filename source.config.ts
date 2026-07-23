import { defineConfig, defineDocs } from "fumadocs-mdx/config";

// All documentation content lives under `content/docs`. The default frontmatter
// schema (title + description, with optional `icon` and `full`) is sufficient,
// so no custom schema is supplied.
export const docs = defineDocs({
  dir: "content/docs",
});

export default defineConfig();
