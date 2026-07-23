# robins.tools

Open-source, privacy-first on-chain toolkit for [Robinhood Chain](https://robins.tools). Everything runs in your browser: reads and writes go straight from the page to the chain RPC and your own wallet, with no server in between. Nothing you enter is stored, logged, or proxied, and the offline tools make no network request at all.

Live at **https://robins.tools**.

## Tools

| Tool                     | What it does                                               | Path                   |
| ------------------------ | ---------------------------------------------------------- | ---------------------- |
| Multisender              | Send ETH or any ERC-20 to hundreds of wallets in one batch | `/tools/multisender`   |
| Token Creator            | Deploy an ERC-20 in a single wallet transaction            | `/tools/token-creator` |
| Approval Manager         | Audit and revoke ERC-20 spending approvals                 | `/tools/approvals`     |
| Token Burner             | Permanently destroy tokens with explicit confirmation      | `/tools/burner`        |
| Contract Interactor      | Read and write any contract from its ABI                   | `/tools/contract`      |
| Batch Balance Checker    | Check native and token balances for many addresses at once | `/tools/balances`      |
| Transaction Decoder      | Turn tx hashes and calldata into human-readable actions    | `/tools/decoder`       |
| Network Tracker          | Live gas, blocks, and RPC health for Robinhood Chain       | `/tools/network`       |
| Merkle Tree Generator    | Build airdrop merkle roots and proofs, fully offline       | `/tools/merkle`        |
| Sign & Verify            | Sign messages and verify signatures                        | `/tools/sign`          |
| Unit & Hex Converter     | wei, gwei, ether, hex, keccak256, checksums                | `/tools/converter`     |
| Vanity Address Generator | Grind a custom address prefix in your browser              | `/tools/vanity`        |
| Address List Utilities   | Validate, checksum, dedupe, and clean address lists        | `/tools/address-utils` |

Full guides for every tool live in-app under [`/docs`](https://robins.tools/docs).

## How it works

robins.tools is a static Next.js frontend with no server-side logic and no database. Each tool either computes locally in your browser or calls the chain directly:

- Reads go to the Robinhood Chain RPC. Writes are built in the browser and handed to your wallet to sign, so the app never touches funds, keys, or fees.
- The only third parties contacted are the chain RPC, the Blockscout explorer API (verified-contract names and ABIs), and openchain.xyz (looking up a 4-byte function selector in the decoder).
- The offline tools (converter, merkle generator, vanity generator, address utilities, and signature verification) make no network request at all.
- It is single-chain: the wallet is configured with Robinhood Chain as its only network.

See [Privacy by design](https://robins.tools/docs/concepts/privacy-by-design) for the complete list of what the app talks to.

## Stack

Next.js (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui · wagmi · viem · Reown AppKit · Fumadocs (MDX). Hosted on Vercel.

## Network

|           | Robinhood Chain (mainnet)               |
| --------- | --------------------------------------- |
| Chain ID  | 4663 (0x1237)                           |
| RPC       | https://rpc.mainnet.chain.robinhood.com |
| Explorer  | https://robinhoodchain.blockscout.com   |
| Gas token | ETH                                     |

Robinhood Chain is an Arbitrum Orbit L2 with full EVM compatibility. The RPC URL is configurable so a dedicated provider can replace the rate-limited public endpoint without code changes.

## Local development

Requires Node.js 20+ and [pnpm](https://pnpm.io).

```bash
pnpm install
cp .env.example .env.local
# Create a project at https://cloud.reown.com and paste its id into
# NEXT_PUBLIC_REOWN_PROJECT_ID in .env.local (wallet connection is disabled without it).
pnpm dev
```

The app runs at http://localhost:3000. Without a Reown project id everything still works except wallet connection, which shows a hint instead.

## Self-hosting / deploy

The app is a static-friendly Next.js project with no server database. Deploy it to Vercel or any Next.js host:

1. Fork the repository and import it into Vercel.
2. Set the environment variables below in the project settings.
3. Deploy. No build configuration changes are required.

### Environment variables

| Variable                       | Required    | Purpose                                                                                                          |
| ------------------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_REOWN_PROJECT_ID` | recommended | Reown AppKit project id ([cloud.reown.com](https://cloud.reown.com)). Without it, wallet connection is disabled. |
| `NEXT_PUBLIC_RPC_URL`          | optional    | Override the public mainnet RPC with a dedicated endpoint.                                                       |
| `NEXT_PUBLIC_GITHUB_URL`       | optional    | When set, GitHub links appear in the header and footer.                                                          |
| `NEXT_PUBLIC_DISPERSE_ADDRESS` | optional    | Pre-deployed RobinsDisperse contract for the Multisender; otherwise users deploy their own once.                 |
| `NEXT_PUBLIC_TOOLS_TOKEN_ADDRESS` | optional | Published $TOOLS community token contract address, shown on `/token` once set.                                   |

See [`.env.example`](.env.example) for the annotated list.

## License

[MIT](LICENSE). Copyright (c) 2026 robins.tools contributors.
