"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAddress, isAddress, type Address, type WalletClient } from "viem";

import { robinhoodChain } from "@/lib/chain";
import { publicClient } from "@/lib/public-client";

import {
  DISPERSE_ARTIFACT_ABI,
  DISPERSE_BYTECODE,
  DISPERSE_DEPLOYED_BYTECODE,
  DISPERSE_STORAGE_KEY,
  ENV_DISPERSE_ADDRESS,
} from "./lib/constants";
import { errorMessage } from "./lib/util";

export type DisperseSource = "env" | "local" | "deployed";
type Status = "checking" | "available" | "unavailable";

/** Shown when a configured/saved address exists on-chain but isn't RobinsDisperse. */
const MISMATCH_WARNING =
  "Address at NEXT_PUBLIC_DISPERSE_ADDRESS / saved deployment does not match the RobinsDisperse bytecode and was ignored.";

export interface UseDisperse {
  status: Status;
  address: `0x${string}` | null;
  source: DisperseSource | null;
  /** Set when an env/localStorage address was ignored for failing the bytecode check. */
  warning: string | null;
  deploying: boolean;
  deployError: string | null;
  deploy: (walletClient: WalletClient, account: Address) => Promise<void>;
}

/**
 * True only when `address` holds *exactly* the RobinsDisperse runtime bytecode.
 * The contract has no constructor args/immutables, so an authentic deployment's
 * on-chain code is byte-for-byte equal to the artifact's `deployedBytecode`.
 * Any other code (a look-alike, a proxy, an unrelated contract) is rejected
 * before the app would ever grant it an ERC-20 approval.
 */
async function isDisperseDeployment(
  address: `0x${string}`,
): Promise<boolean> {
  const code = await publicClient.getCode({ address });
  if (code === undefined) return false;
  return code.toLowerCase() === DISPERSE_DEPLOYED_BYTECODE.toLowerCase();
}

function readStored(): `0x${string}` | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(DISPERSE_STORAGE_KEY);
  if (raw && isAddress(raw)) return getAddress(raw);
  return null;
}

/**
 * Resolve a usable RobinsDisperse deployment: `NEXT_PUBLIC_DISPERSE_ADDRESS`
 * first, then a previously self-deployed address in localStorage; each verified
 * to actually hold code on-chain. If none is found the caller can `deploy()` a
 * fresh one (owned by the user) which is then cached for next time.
 */
export function useDisperse(): UseDisperse {
  const [status, setStatus] = useState<Status>("checking");
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [source, setSource] = useState<DisperseSource | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    void (async () => {
      try {
        if (ENV_DISPERSE_ADDRESS && isAddress(ENV_DISPERSE_ADDRESS)) {
          const envAddr = getAddress(ENV_DISPERSE_ADDRESS);
          if (await isDisperseDeployment(envAddr)) {
            if (cancelled.current) return;
            setAddress(envAddr);
            setSource("env");
            setStatus("available");
            return;
          }
          // Configured address exists but is not RobinsDisperse; ignore it.
          if (cancelled.current) return;
          setWarning(MISMATCH_WARNING);
        }
        const stored = readStored();
        if (stored) {
          if (await isDisperseDeployment(stored)) {
            if (cancelled.current) return;
            setAddress(stored);
            setSource("local");
            setStatus("available");
            return;
          }
          // Saved deployment no longer matches; drop it so it isn't reused.
          window.localStorage.removeItem(DISPERSE_STORAGE_KEY);
          if (cancelled.current) return;
          setWarning(MISMATCH_WARNING);
        }
        if (cancelled.current) return;
        setStatus("unavailable");
      } catch {
        if (cancelled.current) return;
        // A failed code check shouldn't hard-block the ETH/Multicall3 path.
        setStatus("unavailable");
      }
    })();
    return () => {
      cancelled.current = true;
    };
  }, []);

  const deploy = useCallback(
    async (walletClient: WalletClient, account: Address) => {
      setDeploying(true);
      setDeployError(null);
      try {
        const hash = await walletClient.deployContract({
          abi: DISPERSE_ARTIFACT_ABI,
          bytecode: DISPERSE_BYTECODE,
          account,
          chain: robinhoodChain,
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success" || !receipt.contractAddress) {
          throw new Error("Deployment transaction failed.");
        }
        const deployed = getAddress(receipt.contractAddress);
        window.localStorage.setItem(DISPERSE_STORAGE_KEY, deployed);
        setAddress(deployed);
        setSource("deployed");
        setWarning(null);
        setStatus("available");
      } catch (err) {
        setDeployError(errorMessage(err));
        throw err;
      } finally {
        setDeploying(false);
      }
    },
    [],
  );

  return { status, address, source, warning, deploying, deployError, deploy };
}
