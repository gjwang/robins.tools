import { erc20Abi, type Address, type WalletClient } from "viem";

import { publicClient } from "@/lib/public-client";

import { chunk } from "./compute";
import {
  DISPERSE_ABI,
  ETH_CHUNK_SIZE,
  MULTICALL3_ABI,
  TOKEN_CHUNK_SIZE,
} from "./constants";
import type { Allocation, ApprovalStrategy, SelectedToken } from "./types";

interface BaseOp {
  /** Stable id used as a React key and for retry/resume tracking. */
  id: string;
  /** Short label for the progress row. */
  title: string;
  /** Base units moved (disperse) or approved (approve). */
  total: bigint;
  /** Recipients covered by this op (0 for approvals with no address list). */
  recipients: number;
}

/** One signable transaction in the send sequence. */
export type SendOp =
  | (BaseOp & {
      kind: "approve";
      token: `0x${string}`;
      spender: `0x${string}`;
      amount: bigint;
    })
  | (BaseOp & {
      kind: "disperseEther";
      disperse: `0x${string}`;
      addrs: `0x${string}`[];
      values: bigint[];
    })
  | (BaseOp & {
      kind: "multicallEther";
      multicall: `0x${string}`;
      calls: {
        target: `0x${string}`;
        allowFailure: boolean;
        value: bigint;
        callData: "0x";
      }[];
    })
  | (BaseOp & {
      kind: "disperseToken";
      disperse: `0x${string}`;
      token: `0x${string}`;
      addrs: `0x${string}`[];
      values: bigint[];
    });

function sum(values: readonly bigint[]): bigint {
  return values.reduce((acc, v) => acc + v, 0n);
}

interface BuildOpsParams {
  token: SelectedToken;
  allocations: Allocation[];
  /** Resolved disperse deployment, or null when only the Multicall3 path is available. */
  disperseAddress: `0x${string}` | null;
  multicallAddress: `0x${string}`;
  approvalStrategy: ApprovalStrategy;
  /** Current allowance of disperse over the sender's token (0 for native). */
  currentAllowance: bigint;
}

/**
 * Turn a validated plan into the exact ordered list of transactions to sign.
 *
 * Native ETH uses the disperse helper when available, else Multicall3
 * `aggregate3Value` (never a token approval; Multicall3 must never be granted
 * an ERC-20 allowance). ERC-20 always uses the disperse helper: an `approve`
 * (skipped when the existing allowance already covers the run) followed by
 * `disperseToken` per chunk. `disperseToken` can only ever move the sender's
 * own allowance, which is why the dedicated contract, not Multicall3, holds it.
 */
export function buildOps(params: BuildOpsParams): SendOp[] {
  const {
    token,
    allocations,
    disperseAddress,
    multicallAddress,
    approvalStrategy,
    currentAllowance,
  } = params;

  if (token.kind === "native") {
    const chunks = chunk(allocations, ETH_CHUNK_SIZE);
    return chunks.map((c, i) => {
      const addrs = c.map((a) => a.address);
      const values = c.map((a) => a.value);
      const total = sum(values);
      const title = `Send ETH, batch ${i + 1} of ${chunks.length}`;
      if (disperseAddress) {
        return {
          id: `disperse-eth-${i}`,
          kind: "disperseEther",
          title,
          total,
          recipients: c.length,
          disperse: disperseAddress,
          addrs,
          values,
        };
      }
      return {
        id: `multicall-eth-${i}`,
        kind: "multicallEther",
        title,
        total,
        recipients: c.length,
        multicall: multicallAddress,
        calls: c.map((a) => ({
          target: a.address,
          allowFailure: false,
          value: a.value,
          callData: "0x" as const,
        })),
      };
    });
  }

  // ERC-20 requires the disperse helper.
  if (!disperseAddress) return [];

  const chunks = chunk(allocations, TOKEN_CHUNK_SIZE);
  const grandTotal = sum(allocations.map((a) => a.value));
  const ops: SendOp[] = [];

  const disperseOp = (c: Allocation[], i: number): SendOp => ({
    id: `disperse-token-${i}`,
    kind: "disperseToken",
    title: `Send ${token.symbol}, batch ${i + 1} of ${chunks.length}`,
    total: sum(c.map((a) => a.value)),
    recipients: c.length,
    disperse: disperseAddress,
    token: token.address,
    addrs: c.map((a) => a.address),
    values: c.map((a) => a.value),
  });

  const alreadyApproved = currentAllowance >= grandTotal;

  if (alreadyApproved) {
    chunks.forEach((c, i) => ops.push(disperseOp(c, i)));
    return ops;
  }

  if (approvalStrategy === "total") {
    ops.push({
      id: "approve-total",
      kind: "approve",
      title: `Approve ${token.symbol} for the disperse helper`,
      total: grandTotal,
      recipients: allocations.length,
      token: token.address,
      spender: disperseAddress,
      amount: grandTotal,
    });
    chunks.forEach((c, i) => ops.push(disperseOp(c, i)));
    return ops;
  }

  // per-chunk: approve exactly one chunk's worth before each disperse.
  chunks.forEach((c, i) => {
    const chunkTotal = sum(c.map((a) => a.value));
    ops.push({
      id: `approve-${i}`,
      kind: "approve",
      title: `Approve ${token.symbol}, batch ${i + 1} of ${chunks.length}`,
      total: chunkTotal,
      recipients: c.length,
      token: token.address,
      spender: disperseAddress,
      amount: chunkTotal,
    });
    ops.push(disperseOp(c, i));
  });
  return ops;
}

export type OpPhase = "simulating" | "confirming" | "mining";

interface RunContext {
  walletClient: WalletClient;
  account: Address;
  onPhase: (phase: OpPhase) => void;
  onHash: (hash: `0x${string}`) => void;
}

/**
 * Simulate, sign, broadcast, and await one op. Simulation runs first so reverts
 * surface before the wallet prompt; `onPhase`/`onHash` drive the progress UI.
 * Throws on simulation failure, user rejection, or an on-chain revert (the
 * receipt's `status`), so the caller can stop and offer retry/resume.
 */
export async function runOp(op: SendOp, ctx: RunContext): Promise<void> {
  const { walletClient, account, onPhase, onHash } = ctx;

  onPhase("simulating");
  let hash: `0x${string}`;

  if (op.kind === "approve") {
    const { request } = await publicClient.simulateContract({
      account,
      address: op.token,
      abi: erc20Abi,
      functionName: "approve",
      args: [op.spender, op.amount],
    });
    onPhase("confirming");
    hash = await walletClient.writeContract(request);
  } else if (op.kind === "disperseEther") {
    const { request } = await publicClient.simulateContract({
      account,
      address: op.disperse,
      abi: DISPERSE_ABI,
      functionName: "disperseEther",
      args: [op.addrs, op.values],
      value: op.total,
    });
    onPhase("confirming");
    hash = await walletClient.writeContract(request);
  } else if (op.kind === "multicallEther") {
    const { request } = await publicClient.simulateContract({
      account,
      address: op.multicall,
      abi: MULTICALL3_ABI,
      functionName: "aggregate3Value",
      args: [op.calls],
      value: op.total,
    });
    onPhase("confirming");
    hash = await walletClient.writeContract(request);
  } else {
    const { request } = await publicClient.simulateContract({
      account,
      address: op.disperse,
      abi: DISPERSE_ABI,
      functionName: "disperseToken",
      args: [op.token, op.addrs, op.values],
    });
    onPhase("confirming");
    hash = await walletClient.writeContract(request);
  }

  onHash(hash);
  onPhase("mining");
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("Transaction reverted on-chain.");
  }
}
