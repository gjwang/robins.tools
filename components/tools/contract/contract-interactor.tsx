"use client";

import { useRef, useState } from "react";
import { getAddress, isAddress } from "viem";
import { Loader2 } from "lucide-react";

import { AddressDisplay } from "@/components/address-display";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FunctionList } from "@/components/tools/contract/function-list";
import {
  type LoadedContract,
  errorMessage,
  fetchVerifiedAbi,
  getReadFunctions,
  getWriteFunctions,
  parsePastedAbi,
} from "@/components/tools/contract/lib";
import { truncateAddress } from "@/lib/format";

type LoadState = "idle" | "loading" | "unverified" | "error" | "done";

export function ContractInteractor() {
  const [addressInput, setAddressInput] = useState("");
  const [activeAddress, setActiveAddress] = useState<`0x${string}` | null>(
    null,
  );
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loaded, setLoaded] = useState<LoadedContract | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [pastedAbi, setPastedAbi] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);

  const requestId = useRef(0);

  const trimmed = addressInput.trim();
  const invalidAddress = trimmed !== "" && !isAddress(trimmed);

  function resetLoad() {
    requestId.current += 1;
    setActiveAddress(null);
    setLoadState("idle");
    setLoaded(null);
    setFetchError(null);
    setPastedAbi("");
    setPasteError(null);
  }

  async function loadContract(address: `0x${string}`) {
    const id = ++requestId.current;
    setActiveAddress(address);
    setLoaded(null);
    setFetchError(null);
    setPasteError(null);
    setPastedAbi("");
    setLoadState("loading");

    try {
      const result = await fetchVerifiedAbi(address);
      if (id !== requestId.current) return;
      if (result.status === "unverified") {
        setLoadState("unverified");
        return;
      }
      setLoaded({
        address,
        abi: result.abi,
        name: result.name,
        source: "verified",
        proxyImplementation: result.proxyImplementation,
      });
      setLoadState("done");
    } catch (error) {
      if (id !== requestId.current) return;
      setFetchError(errorMessage(error));
      setLoadState("error");
    }
  }

  function handleAddressChange(value: string) {
    setAddressInput(value);
    const next = value.trim();
    if (next === "" || !isAddress(next)) {
      resetLoad();
      return;
    }
    const address = getAddress(next);
    if (
      address === activeAddress &&
      (loadState === "loading" || loadState === "done")
    ) {
      return;
    }
    void loadContract(address);
  }

  function applyPastedAbi() {
    if (!activeAddress) return;
    try {
      const abi = parsePastedAbi(pastedAbi);
      if (!abi.some((item) => item.type === "function")) {
        throw new Error("This ABI has no callable functions.");
      }
      setLoaded({
        address: activeAddress,
        abi,
        name: null,
        source: "pasted",
        proxyImplementation: null,
      });
      setPasteError(null);
      setLoadState("done");
    } catch (error) {
      setPasteError(errorMessage(error));
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor="contract-address">Contract address</Label>
        <Input
          id="contract-address"
          value={addressInput}
          onChange={(event) => handleAddressChange(event.target.value)}
          placeholder="0x…"
          spellCheck={false}
          autoComplete="off"
          aria-invalid={invalidAddress}
          className="font-mono"
        />
        {invalidAddress ? (
          <p className="text-xs text-destructive">
            Enter a valid contract address.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            We auto-load the verified ABI from Blockscout. Reads go straight to
            the RPC. Nothing is proxied.
          </p>
        )}
      </div>

      {loadState === "loading" ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Fetching ABI from Blockscout…
        </div>
      ) : null}

      {loadState === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load the ABI</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{fetchError}</span>
            {activeAddress ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadContract(activeAddress)}
              >
                Retry
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {loadState === "unverified" ? (
        <div className="space-y-3">
          <Alert>
            <AlertTitle>Not verified on Blockscout</AlertTitle>
            <AlertDescription>
              No verified ABI was found for{" "}
              {truncateAddress(activeAddress ?? "")}. Paste an ABI below to
              interact with it: a JSON array, a build artifact with an{" "}
              {'"abi"'} field, or human-readable signatures (one per line).
            </AlertDescription>
          </Alert>
          <div className="space-y-1.5">
            <Label htmlFor="pasted-abi">ABI</Label>
            <Textarea
              id="pasted-abi"
              value={pastedAbi}
              onChange={(event) => setPastedAbi(event.target.value)}
              placeholder={
                '[{"type":"function","name":"balanceOf",…}]\n\nor\n\nfunction balanceOf(address) view returns (uint256)'
              }
              spellCheck={false}
              className="min-h-40 font-mono text-xs"
            />
            {pasteError ? (
              <p className="text-xs text-destructive">{pasteError}</p>
            ) : null}
          </div>
          <Button
            size="sm"
            onClick={applyPastedAbi}
            disabled={!pastedAbi.trim()}
          >
            Load ABI
          </Button>
        </div>
      ) : null}

      {loadState === "done" && loaded ? (
        <>
          <ContractSummary contract={loaded} />
          <FunctionList address={loaded.address} abi={loaded.abi} />
        </>
      ) : null}
    </div>
  );
}

function ContractSummary({ contract }: { contract: LoadedContract }) {
  const readCount = getReadFunctions(contract.abi).length;
  const writeCount = getWriteFunctions(contract.abi).length;

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-heading text-base font-medium">
            {contract.name ??
              (contract.source === "pasted"
                ? "Custom ABI"
                : "Unnamed contract")}
          </span>
          {contract.source === "verified" ? (
            <Badge variant="secondary">Verified</Badge>
          ) : (
            <Badge variant="outline">Custom ABI</Badge>
          )}
          {contract.proxyImplementation ? (
            <Badge variant="outline">
              Proxy → implementation{" "}
              {truncateAddress(contract.proxyImplementation)} ABI
            </Badge>
          ) : null}
        </div>

        <AddressDisplay address={contract.address} />

        <p className="text-xs text-muted-foreground">
          {readCount} read · {writeCount} write function
          {readCount + writeCount === 1 ? "" : "s"}
        </p>
      </CardContent>
    </Card>
  );
}
