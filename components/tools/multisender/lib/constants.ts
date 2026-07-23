import type { Abi } from "viem";

import disperseArtifact from "@/lib/abis/robins-disperse.json";

/**
 * Max recipients per transaction. Native ETH sends stay smaller because each
 * payout is a full value-bearing call (disperseEther loop / Multicall3 sub-call);
 * ERC-20 transferFrom loops are cheaper per element, so they pack denser.
 */
export const ETH_CHUNK_SIZE = 200;
export const TOKEN_CHUNK_SIZE = 300;

/** Hard cap on total recipients per run (all chunks combined). */
export const MAX_RECIPIENTS = 1000;

/** localStorage key holding a user-deployed disperse address, namespaced per chain. */
export const DISPERSE_STORAGE_KEY = "robins.disperse.4663";

/** Optional pre-deployed disperse address supplied via env. */
export const ENV_DISPERSE_ADDRESS =
  process.env.NEXT_PUBLIC_DISPERSE_ADDRESS ?? "";

/**
 * RobinsDisperse ABI (fixed by the artifact). Declared `as const` here so viem
 * type-checks the call args; the deploy bytecode is imported from the artifact.
 */
export const DISPERSE_ABI = [
  {
    type: "function",
    name: "disperseEther",
    stateMutability: "payable",
    inputs: [
      { name: "recipients", type: "address[]" },
      { name: "values", type: "uint256[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "disperseToken",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "recipients", type: "address[]" },
      { name: "values", type: "uint256[]" },
    ],
    outputs: [],
  },
  { type: "error", name: "LengthMismatch", inputs: [] },
  {
    type: "error",
    name: "EtherTransferFailed",
    inputs: [{ name: "recipient", type: "address" }],
  },
  {
    type: "error",
    name: "SafeERC20FailedOperation",
    inputs: [{ name: "token", type: "address" }],
  },
] as const;

/** Deploy bytecode for the disperse helper, straight from the artifact. */
export const DISPERSE_BYTECODE = disperseArtifact.bytecode as `0x${string}`;

/**
 * Runtime (deployed) bytecode of RobinsDisperse. Because the contract has no
 * constructor args or immutables, a genuine deployment's on-chain code equals
 * this exactly; so it doubles as an identity check before any approval.
 */
export const DISPERSE_DEPLOYED_BYTECODE =
  disperseArtifact.deployedBytecode as `0x${string}`;

/** ABI used for the artifact-shaped deploy (imported, satisfies deployContract). */
export const DISPERSE_ARTIFACT_ABI = disperseArtifact.abi as Abi;

/**
 * Minimal Multicall3 ABI; only `aggregate3Value`, which forwards ETH to each
 * target. Used as the fallback ETH path when no disperse deployment exists.
 */
export const MULTICALL3_ABI = [
  {
    type: "function",
    name: "aggregate3Value",
    stateMutability: "payable",
    inputs: [
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "allowFailure", type: "bool" },
          { name: "value", type: "uint256" },
          { name: "callData", type: "bytes" },
        ],
      },
    ],
    outputs: [
      {
        name: "returnData",
        type: "tuple[]",
        components: [
          { name: "success", type: "bool" },
          { name: "returnData", type: "bytes" },
        ],
      },
    ],
  },
] as const;
