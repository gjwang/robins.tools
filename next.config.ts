import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";
import path from "node:path";

// Reown AppKit's wagmi adapter pulls in the Coinbase Base Account connector,
// whose `@coinbase/cdp-sdk` lazily imports a family of optional `@x402/*`
// payment packages that are not installed. This app never uses x402 payments,
// so those specifiers are aliased to an empty stub to let the build resolve.
const x402Specifiers = [
  "@x402/core",
  "@x402/core/client",
  "@x402/core/server",
  "@x402/core/types",
  "@x402/evm",
  "@x402/evm/batch-settlement/client",
  "@x402/evm/exact/client",
  "@x402/evm/exact/server",
  "@x402/evm/exact/v1/client",
  "@x402/evm/upto/client",
  "@x402/evm/upto/server",
  "@x402/express",
  "@x402/extensions",
  "@x402/extensions/bazaar",
  "@x402/fetch",
  "@x402/svm",
  "@x402/svm/exact/client",
  "@x402/svm/exact/server",
  "@x402/svm/exact/v1/client",
];

const stub = "./stubs/x402-empty.ts";

const nextConfig: NextConfig = {
  // Pin the workspace root so Turbopack doesn't infer a parent directory that
  // happens to contain another lockfile.
  turbopack: {
    root: path.resolve(),
    resolveAlias: Object.fromEntries(
      x402Specifiers.map((specifier) => [specifier, stub]),
    ),
  },
};

// Wrap with fumadocs-mdx so `content/docs/**` MDX is compiled and the `.source`
// runtime is generated. `createMDX()` reads `source.config.ts` by default and
// preserves the Turbopack config above untouched.
const withMDX = createMDX();

export default withMDX(nextConfig);
