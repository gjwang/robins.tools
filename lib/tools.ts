import {
  Activity,
  ArrowLeftRight,
  Braces,
  Coins,
  FileSearch,
  Flame,
  ListChecks,
  ListTree,
  type LucideIcon,
  PenLine,
  Send,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";

export type ToolCategory = "transact" | "read" | "offline";

export interface ToolMeta {
  /** URL slug; the tool lives at `/tools/<slug>`. */
  slug: string;
  /** Display name. */
  name: string;
  /** One-line pitch shown on cards and tool headers. */
  tagline: string;
  /** One to two sentence description shown on cards and the tool page. */
  description: string;
  /** Grouping used by the tools grid filter and the tool-page badge. */
  category: ToolCategory;
  /** lucide-react icon component. */
  icon: LucideIcon;
  /** Whether the tool needs a connected wallet to do its core job. */
  requiresWallet: boolean;
  /** Path to this tool's documentation page. */
  docsSlug: string;
}

export const tools: ToolMeta[] = [
  {
    slug: "multisender",
    name: "Multisender",
    tagline: "Send ETH or any token to hundreds of wallets in one batch.",
    description:
      "Airdrop ETH or any ERC-20 to a whole list of addresses in a single batch. Upload a CSV or paste rows, set equal or per-wallet amounts, review the totals and gas, then send. You pay the fees, and nothing is ever custodied.",
    category: "transact",
    icon: Send,
    requiresWallet: true,
    docsSlug: "/docs/tools/multisender",
  },
  {
    slug: "token-creator",
    name: "Token Creator",
    tagline: "Deploy an ERC-20 on Robinhood Chain in one transaction.",
    description:
      "Launch your own ERC-20 without writing Solidity. Choose a name, symbol, decimals, and supply, flag it mintable or burnable, and deploy straight from your wallet. The contract address and explorer link appear once it's mined.",
    category: "transact",
    icon: Coins,
    requiresWallet: true,
    docsSlug: "/docs/tools/token-creator",
  },
  {
    slug: "approvals",
    name: "Approval Manager",
    tagline: "Audit and revoke ERC-20 spending approvals.",
    description:
      "See every ERC-20 allowance your wallet has granted, with unlimited approvals flagged. Revoke anything you no longer trust in one click to shrink your attack surface.",
    category: "transact",
    icon: ShieldCheck,
    requiresWallet: true,
    docsSlug: "/docs/tools/approvals",
  },
  {
    slug: "burner",
    name: "Token Burner",
    tagline: "Permanently destroy tokens, with explicit confirmation.",
    description:
      "Take tokens out of circulation for good by burning them on-chain. A deliberate, multi-step confirmation makes sure the amount and token are exactly what you intend before anything is sent.",
    category: "transact",
    icon: Flame,
    requiresWallet: true,
    docsSlug: "/docs/tools/burner",
  },
  {
    slug: "contract",
    name: "Contract Interactor",
    tagline: "Read and write any contract from its ABI.",
    description:
      "Point at any contract address to auto-load its verified ABI, or paste one in. Every read and write function gets a generated form, with return values decoded for you. Reads are free; writes prompt your wallet.",
    category: "transact",
    icon: Braces,
    requiresWallet: false,
    docsSlug: "/docs/tools/contract",
  },
  {
    slug: "balances",
    name: "Batch Balance Checker",
    tagline: "Check native and token balances for hundreds of addresses.",
    description:
      "Paste or import a list of addresses and fetch their native ETH and token balances in a single multicall. Sort the results and export a clean CSV.",
    category: "read",
    icon: Wallet,
    requiresWallet: false,
    docsSlug: "/docs/tools/balances",
  },
  {
    slug: "decoder",
    name: "Transaction Decoder",
    tagline: "Turn tx hashes and calldata into human-readable actions.",
    description:
      "Drop in a transaction hash or raw calldata to decode the function, its parameters, and the value moved. Known ABIs and signature lookups turn hex into plain English.",
    category: "read",
    icon: FileSearch,
    requiresWallet: false,
    docsSlug: "/docs/tools/decoder",
  },
  {
    slug: "network",
    name: "Network Tracker",
    tagline: "Live gas, blocks, and RPC health for Robinhood Chain.",
    description:
      "A live dashboard of gas price, the latest blocks, average block time, and RPC status for Robinhood Chain.",
    category: "read",
    icon: Activity,
    requiresWallet: false,
    docsSlug: "/docs/tools/network",
  },
  {
    slug: "merkle",
    name: "Merkle Tree Generator",
    tagline: "Build airdrop merkle roots and proofs, fully offline.",
    description:
      "Paste an address list, optionally with amounts, to generate a merkle root and a proof for every entry. It runs entirely in your browser and exports JSON that verifies against standard OpenZeppelin proofs.",
    category: "offline",
    icon: ListTree,
    requiresWallet: false,
    docsSlug: "/docs/tools/merkle",
  },
  {
    slug: "sign",
    name: "Sign & Verify",
    tagline: "Sign messages and verify signatures.",
    description:
      "Sign an arbitrary message with your connected wallet, or verify any message and signature to recover the address that produced it. Verification needs no wallet and no network.",
    category: "offline",
    icon: PenLine,
    requiresWallet: false,
    docsSlug: "/docs/tools/sign",
  },
  {
    slug: "converter",
    name: "Unit & Hex Converter",
    tagline: "wei, gwei, ether, hex, keccak256, checksums.",
    description:
      "Convert between wei, gwei, and ether, flip hex and decimal, hash with keccak256, and checksum addresses, instantly and entirely in the browser.",
    category: "offline",
    icon: ArrowLeftRight,
    requiresWallet: false,
    docsSlug: "/docs/tools/converter",
  },
  {
    slug: "vanity",
    name: "Vanity Address Generator",
    tagline: "Grind a custom address prefix in your browser.",
    description:
      "Generate a wallet whose address starts or ends with the characters you choose, using Web Workers so the search never leaves your machine. The private key is shown locally and never touches the network.",
    category: "offline",
    icon: Sparkles,
    requiresWallet: false,
    docsSlug: "/docs/tools/vanity",
  },
  {
    slug: "address-utils",
    name: "Address List Utilities",
    tagline: "Validate, checksum, dedupe, and clean address lists.",
    description:
      "Tidy up messy address lists: validate each entry, apply checksum casing, drop duplicates and malformed rows, and export clean CSV or JSON. The natural prep step before a multisend.",
    category: "offline",
    icon: ListChecks,
    requiresWallet: false,
    docsSlug: "/docs/tools/address-utils",
  },
];

export function getTool(slug: string): ToolMeta | undefined {
  return tools.find((tool) => tool.slug === slug);
}
