"use client";

import { useState } from "react";
import { BadgeCheck, PenLine, ShieldCheck, ShieldX } from "lucide-react";
import {
  BaseError,
  getAddress,
  isAddress,
  isHex,
  recoverMessageAddress,
  UserRejectedRequestError,
} from "viem";
import { useAccount, useSignMessage } from "wagmi";
import { toast } from "sonner";

import { AddressDisplay } from "@/components/address-display";
import { CopyButton } from "@/components/copy-button";
import { WalletGate } from "@/components/wallet-gate";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export function SignVerify() {
  return (
    <Tabs defaultValue="sign" className="w-full">
      <TabsList className="w-full max-w-xs">
        <TabsTrigger value="sign">Sign</TabsTrigger>
        <TabsTrigger value="verify">Verify</TabsTrigger>
      </TabsList>

      <TabsContent value="sign" className="mt-6">
        <WalletGate>
          <SignPanel />
        </WalletGate>
      </TabsContent>

      <TabsContent value="verify" className="mt-6">
        <VerifyPanel />
      </TabsContent>
    </Tabs>
  );
}

function friendlyError(error: unknown): string {
  if (error instanceof BaseError) {
    const rejected = error.walk((e) => e instanceof UserRejectedRequestError);
    if (rejected) return "You rejected the signature request.";
    return error.shortMessage;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

interface SignResult {
  message: string;
  signature: string;
  signer: `0x${string}`;
}

function SignPanel() {
  const { address } = useAccount();
  const { signMessageAsync, isPending } = useSignMessage();
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<SignResult | null>(null);

  async function sign() {
    if (!address) return;
    try {
      const signature = await signMessageAsync({ message });
      setResult({ message, signature, signer: address });
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="sign-message">Message</Label>
        <Textarea
          id="sign-message"
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
            if (result) setResult(null);
          }}
          placeholder="Type any message to sign with your wallet…"
          rows={5}
          spellCheck={false}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={sign} disabled={isPending || message === ""}>
          <PenLine />
          {isPending ? "Check your wallet…" : "Sign message"}
        </Button>
        <p className="text-xs text-muted-foreground">
          EIP-191 <span className="font-mono">personal_sign</span>. Nothing is
          sent on-chain.
        </p>
      </div>

      {result ? (
        <div className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Signer</p>
            <AddressDisplay address={result.signer} />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Signature
            </p>
            <div className="flex items-start gap-2">
              <code className="min-w-0 flex-1 break-all font-mono text-xs">
                {result.signature}
              </code>
              <CopyButton value={result.signature} label="Copy signature" />
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Message</p>
            <p className="break-words whitespace-pre-wrap text-sm">
              {result.message}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface VerifyOutcome {
  recovered: `0x${string}`;
  match: boolean | null;
}

function VerifyPanel() {
  const [message, setMessage] = useState("");
  const [signature, setSignature] = useState("");
  const [expected, setExpected] = useState("");
  const [outcome, setOutcome] = useState<VerifyOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function verify() {
    setOutcome(null);
    setError(null);

    const sig = signature.trim();
    if (!isHex(sig)) {
      setError("Signature must be a 0x-prefixed hex string.");
      return;
    }

    const expectedTrimmed = expected.trim();
    if (expectedTrimmed !== "" && !isAddress(expectedTrimmed)) {
      setError("Expected signer is not a valid address.");
      return;
    }

    setPending(true);
    try {
      const recovered = await recoverMessageAddress({
        message,
        signature: sig,
      });
      const match =
        expectedTrimmed === ""
          ? null
          : getAddress(recovered) === getAddress(expectedTrimmed);
      setOutcome({ recovered, match });
    } catch {
      setError("Could not recover a signer. Check the message and signature.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="verify-message">Message</Label>
        <Textarea
          id="verify-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="The exact message that was signed…"
          rows={4}
          spellCheck={false}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="verify-signature">Signature</Label>
        <Textarea
          id="verify-signature"
          value={signature}
          onChange={(event) => setSignature(event.target.value)}
          placeholder="0x…"
          rows={2}
          spellCheck={false}
          className="font-mono text-xs"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="verify-expected">Expected signer (optional)</Label>
        <Input
          id="verify-expected"
          value={expected}
          onChange={(event) => setExpected(event.target.value)}
          placeholder="0x… to check the recovered address matches"
          spellCheck={false}
          className="font-mono"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={verify}
          disabled={pending || message === "" || signature.trim() === ""}
        >
          <ShieldCheck />
          Verify signature
        </Button>
        <p className="text-xs text-muted-foreground">
          Runs fully in your browser, with no wallet or network involved.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <ShieldX />
          <AlertTitle>Verification failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {outcome ? (
        <div className="space-y-4">
          {outcome.match === true ? (
            <Badge className="gap-1">
              <BadgeCheck />
              Signature valid, signer matches
            </Badge>
          ) : null}
          {outcome.match === false ? (
            <Badge variant="destructive" className="gap-1">
              <ShieldX />
              Signer does not match the expected address
            </Badge>
          ) : null}

          <div className="space-y-1.5 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
            <p className="text-xs font-medium text-muted-foreground">
              Recovered signer
            </p>
            <AddressDisplay address={outcome.recovered} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
