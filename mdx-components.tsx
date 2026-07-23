import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";

// Merge fumadocs' default MDX components (headings, code blocks, Callout, Card,
// tables, …) with any per-page overrides. Used by the docs page renderer.
export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...components,
  };
}
