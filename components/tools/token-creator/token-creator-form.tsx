"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronDown,
  Coins,
  Loader2,
  Rocket,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import {
  encodeDeployData,
  formatGwei,
  getAddress,
  isAddress,
  type Address,
  type Hex,
} from "viem";
import { useAccount, useWalletClient } from "wagmi";

import { DeploySuccess } from "@/components/tools/token-creator/deploy-success";
import {
  formatEthFee,
  humanizeError,
  parseSupply,
  tokenAbi,
  tokenBytecode,
} from "@/components/tools/token-creator/helpers";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { robinhoodChain } from "@/lib/chain";
import { txUrl } from "@/lib/explorer";
import { formatTokenAmount, truncateAddress } from "@/lib/format";
import { publicClient } from "@/lib/public-client";

type DeployStatus = "idle" | "deploying" | "success" | "error";

export function TokenCreatorForm() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [nameInput, setNameInput] = useState("");
  const [symbolInput, setSymbolInput] = useState("");
  const [decimalsInput, setDecimalsInput] = useState("18");
  const [supplyInput, setSupplyInput] = useState("1000000");
  const [mintable, setMintable] = useState(false);
  const [burnable, setBurnable] = useState(false);
  const [ownerInput, setOwnerInput] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);

  const [status, setStatus] = useState<DeployStatus>("idle");
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [deployedAddress, setDeployedAddress] = useState<Address | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function markTouched(field: string) {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }

  const showError = (field: string) => submitted || touched[field];

  // --- Derived / validated values ---------------------------------------
  const nameTrimmed = nameInput.trim();
  const nameError =
    nameTrimmed.length < 1
      ? "Name is required."
      : nameTrimmed.length > 64
        ? "Name must be 64 characters or fewer."
        : null;

  const symbolTrimmed = symbolInput.trim();
  const symbolError =
    symbolTrimmed.length < 1
      ? "Symbol is required."
      : symbolTrimmed.length > 11
        ? "Symbol must be 11 characters or fewer."
        : null;

  const decimalsValid =
    /^\d+$/.test(decimalsInput.trim()) && Number(decimalsInput) <= 36;
  const decimals = decimalsValid ? Number.parseInt(decimalsInput, 10) : 18;
  const decimalsError = decimalsValid
    ? null
    : "Decimals must be a whole number from 0 to 36.";

  const supplyParse = parseSupply(supplyInput, decimals);
  const supplyError = supplyParse.ok ? null : supplyParse.error;

  const ownerTrimmed = ownerInput.trim();
  const ownerError =
    ownerTrimmed !== "" && !isAddress(ownerTrimmed)
      ? "Enter a valid address."
      : null;
  const ownerAddress: Address | undefined =
    ownerTrimmed === ""
      ? (address as Address | undefined)
      : isAddress(ownerTrimmed)
        ? getAddress(ownerTrimmed)
        : undefined;

  const isValid =
    !!address &&
    !nameError &&
    !symbolError &&
    !decimalsError &&
    supplyParse.ok &&
    !ownerError &&
    !!ownerAddress;

  // --- Live fee estimate -------------------------------------------------
  const estimate = useQuery({
    queryKey: [
      "token-creator-estimate",
      address,
      nameTrimmed,
      symbolTrimmed,
      decimals,
      supplyParse.ok ? supplyParse.value.toString() : "",
      mintable,
      burnable,
      ownerAddress,
    ],
    enabled: isValid && status === "idle",
    retry: false,
    staleTime: 15_000,
    queryFn: async () => {
      if (!address || !ownerAddress || !supplyParse.ok) {
        throw new Error("Form is not ready for estimation.");
      }
      const data = encodeDeployData({
        abi: tokenAbi,
        bytecode: tokenBytecode,
        args: [
          nameTrimmed,
          symbolTrimmed,
          decimals,
          supplyParse.value,
          mintable,
          burnable,
          ownerAddress,
        ],
      });
      const [gas, gasPrice] = await Promise.all([
        publicClient.estimateGas({ account: address, data }),
        publicClient.getGasPrice(),
      ]);
      return { gas, gasPrice, feeWei: gas * gasPrice };
    },
  });

  // --- Summary line ------------------------------------------------------
  const summary = useMemo(() => {
    const displayName = nameTrimmed || "Your token";
    const displaySymbol = symbolTrimmed || "TKN";
    const supplyText = supplyParse.ok
      ? `${formatTokenAmount(supplyParse.value, decimals)} ${displaySymbol}`
      : `- ${displaySymbol}`;
    const ownerText = ownerAddress
      ? truncateAddress(ownerAddress)
      : "your wallet";
    return {
      displayName,
      supplyText,
      ownerText,
      noSupply: supplyParse.ok && supplyParse.value === 0n,
    };
  }, [nameTrimmed, symbolTrimmed, supplyParse, decimals, ownerAddress]);

  // --- Deploy ------------------------------------------------------------
  async function handleDeploy() {
    setSubmitted(true);
    if (
      !isValid ||
      !walletClient ||
      !address ||
      !ownerAddress ||
      !supplyParse.ok
    ) {
      return;
    }

    setStatus("deploying");
    setErrorMessage(null);
    setTxHash(null);
    setDeployedAddress(null);

    try {
      const hash = await walletClient.deployContract({
        abi: tokenAbi,
        bytecode: tokenBytecode,
        args: [
          nameTrimmed,
          symbolTrimmed,
          decimals,
          supplyParse.value,
          mintable,
          burnable,
          ownerAddress,
        ],
        account: address,
        chain: robinhoodChain,
      });
      setTxHash(hash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success" || !receipt.contractAddress) {
        throw new Error(
          "The deployment transaction reverted. No token was created.",
        );
      }

      setDeployedAddress(receipt.contractAddress);
      setStatus("success");
      toast.success(`${symbolTrimmed} deployed`);
    } catch (err) {
      setStatus("error");
      setErrorMessage(humanizeError(err));
    }
  }

  function resetForm() {
    setStatus("idle");
    setTxHash(null);
    setDeployedAddress(null);
    setErrorMessage(null);
    setSubmitted(false);
    setTouched({});
    setNameInput("");
    setSymbolInput("");
    setDecimalsInput("18");
    setSupplyInput("1000000");
    setMintable(false);
    setBurnable(false);
    setOwnerInput("");
    setAdvancedOpen(false);
  }

  if (status === "success" && deployedAddress) {
    return (
      <DeploySuccess
        address={deployedAddress}
        name={nameTrimmed}
        symbol={symbolTrimmed}
        decimals={decimals}
        txHash={txHash}
        onReset={resetForm}
      />
    );
  }

  const deploying = status === "deploying";

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-5">
          {/* Name + symbol */}
          <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="tc-name">Name</Label>
              <Input
                id="tc-name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={() => markTouched("name")}
                placeholder="Robinhood Points"
                maxLength={64}
                disabled={deploying}
                aria-invalid={showError("name") && !!nameError}
              />
              <FieldError show={showError("name")} message={nameError} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tc-symbol">Symbol</Label>
              <Input
                id="tc-symbol"
                value={symbolInput}
                onChange={(e) => setSymbolInput(e.target.value)}
                onBlur={() => markTouched("symbol")}
                placeholder="RHP"
                maxLength={11}
                disabled={deploying}
                className="sm:w-40 font-mono"
                aria-invalid={showError("symbol") && !!symbolError}
              />
              <FieldError
                show={showError("symbol")}
                message={symbolError}
                fallback="Ticker, usually uppercase."
              />
            </div>
          </div>

          {/* Decimals + supply */}
          <div className="grid gap-5 sm:grid-cols-[8rem_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="tc-decimals">Decimals</Label>
              <Input
                id="tc-decimals"
                type="number"
                inputMode="numeric"
                min={0}
                max={36}
                step={1}
                value={decimalsInput}
                onChange={(e) => setDecimalsInput(e.target.value)}
                onBlur={() => markTouched("decimals")}
                disabled={deploying}
                aria-invalid={showError("decimals") && !!decimalsError}
              />
              <FieldError
                show={showError("decimals")}
                message={decimalsError}
                fallback="Usually 18."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tc-supply">Initial supply</Label>
              <Input
                id="tc-supply"
                inputMode="decimal"
                value={supplyInput}
                onChange={(e) => setSupplyInput(e.target.value)}
                onBlur={() => markTouched("supply")}
                placeholder="1000000"
                disabled={deploying}
                className="font-mono"
                aria-invalid={showError("supply") && !!supplyError}
              />
              <FieldError
                show={showError("supply")}
                message={supplyError}
                fallback="Whole tokens, minted to the owner. Use 0 for none."
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="grid gap-3 sm:grid-cols-2">
            <ToggleRow
              id="tc-mintable"
              label="Mintable"
              hint="Owner can mint more later."
              checked={mintable}
              onCheckedChange={setMintable}
              disabled={deploying}
            />
            <ToggleRow
              id="tc-burnable"
              label="Burnable"
              hint="Holders can burn their tokens."
              checked={burnable}
              onCheckedChange={setBurnable}
              disabled={deploying}
            />
          </div>

          {/* Advanced */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-1.5 text-muted-foreground"
              >
                <Settings2 />
                Advanced
                <ChevronDown
                  className={`transition-transform ${advancedOpen ? "rotate-180" : ""}`}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="space-y-1.5">
                <Label htmlFor="tc-owner">Owner address</Label>
                <Input
                  id="tc-owner"
                  value={ownerInput}
                  onChange={(e) => setOwnerInput(e.target.value)}
                  onBlur={() => markTouched("owner")}
                  placeholder={address ?? "0x…"}
                  disabled={deploying}
                  className="font-mono"
                  aria-invalid={showError("owner") && !!ownerError}
                />
                <FieldError
                  show={showError("owner")}
                  message={ownerError}
                  fallback="Receives the initial supply and any owner rights. Defaults to your connected wallet."
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Live summary */}
      <div className="rounded-xl bg-primary/10 p-4 ring-1 ring-primary/25">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-foreground">
            <Coins className="size-4" />
          </span>
          <div className="space-y-1 text-sm">
            <p className="font-medium">
              Deploy {summary.displayName}:{" "}
              <span className="font-mono">{summary.supplyText}</span>
              {summary.noSupply ? " (no initial supply)" : null} to{" "}
              <span className="font-mono">{summary.ownerText}</span>
            </p>
            <p className="text-muted-foreground">
              {mintable ? "Mintable" : "Not mintable"} ·{" "}
              {burnable ? "Burnable" : "Not burnable"} · {decimals} decimals
            </p>
          </div>
        </div>
      </div>

      {/* Fee estimate */}
      {isValid ? (
        <FeeEstimate
          isFetching={estimate.isFetching}
          isError={estimate.isError}
          data={estimate.data}
        />
      ) : null}

      {/* Error */}
      {status === "error" && errorMessage ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Deployment failed</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {/* Pending */}
      {deploying ? (
        <Alert>
          <Loader2 className="animate-spin" />
          <AlertTitle>
            {txHash ? "Waiting for confirmation" : "Confirm in your wallet"}
          </AlertTitle>
          <AlertDescription>
            {txHash ? (
              <>
                Your token is being deployed.{" "}
                <a
                  href={txUrl(txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground underline underline-offset-4"
                >
                  View transaction
                </a>
              </>
            ) : (
              "Approve the deployment transaction in your wallet to continue."
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Deploy */}
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          size="lg"
          onClick={handleDeploy}
          disabled={deploying || !walletClient}
        >
          {deploying ? <Loader2 className="animate-spin" /> : <Rocket />}
          {deploying ? "Deploying…" : "Deploy token"}
        </Button>
        <p className="text-xs text-muted-foreground">
          You pay only the network gas for this deployment. robins.tools adds no
          fees and never takes custody.
        </p>
      </div>
    </div>
  );
}

// --- Small presentational helpers ----------------------------------------

function FieldError({
  show,
  message,
  fallback,
}: {
  show: boolean;
  message: string | null;
  fallback?: string;
}) {
  if (show && message) {
    return <p className="text-xs text-destructive">{message}</p>;
  }
  if (fallback) {
    return <p className="text-xs text-muted-foreground">{fallback}</p>;
  }
  return null;
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  onCheckedChange,
  disabled,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
      <div className="space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  );
}

function FeeEstimate({
  isFetching,
  isError,
  data,
}: {
  isFetching: boolean;
  isError: boolean;
  data: { gas: bigint; gasPrice: bigint; feeWei: bigint } | undefined;
}) {
  if (isFetching && !data) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Estimating network fee…
      </p>
    );
  }
  if (isError || !data) {
    return (
      <p className="text-sm text-muted-foreground">
        Fee estimate unavailable right now, but you can still deploy.
      </p>
    );
  }
  return (
    <p className="text-sm">
      <span className="text-muted-foreground">Estimated network fee</span>{" "}
      <span className="font-mono font-medium">
        ≈ {formatEthFee(data.feeWei)} ETH
      </span>{" "}
      <span className="text-muted-foreground">
        ({data.gas.toString()} gas × {formatGwei(data.gasPrice)} gwei)
      </span>
    </p>
  );
}
