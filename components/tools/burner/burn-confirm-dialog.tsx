"use client";

import { useState } from "react";
import { Flame } from "lucide-react";

import { AddressDisplay } from "@/components/address-display";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type BurnPath,
  DEAD_ADDRESS,
  type TokenInfo,
} from "@/components/tools/burner/burner";

interface BurnConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: TokenInfo;
  /** Human-readable amount for the summary (e.g. "1,000"). */
  amountDisplay: string;
  path: BurnPath;
  /** Runs the burn. The dialog closes itself right before calling this. */
  onConfirm: () => void;
}

/**
 * Deliberate two-factor confirmation for an irreversible burn: the user must
 * type the token symbol exactly and acknowledge irreversibility before the
 * destructive action unlocks. The confirmation fields live in a child that only
 * mounts while the dialog is open, so every open starts from a clean slate.
 */
export function BurnConfirmDialog({
  open,
  onOpenChange,
  token,
  amountDisplay,
  path,
  onConfirm,
}: BurnConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <Flame />
          </AlertDialogMedia>
          <AlertDialogTitle>Burn {token.symbol}?</AlertDialogTitle>
        </AlertDialogHeader>

        <ConfirmBody
          token={token}
          amountDisplay={amountDisplay}
          path={path}
          onConfirm={() => {
            onOpenChange(false);
            onConfirm();
          }}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ConfirmBody({
  token,
  amountDisplay,
  path,
  onConfirm,
}: {
  token: TokenInfo;
  amountDisplay: string;
  path: BurnPath;
  onConfirm: () => void;
}) {
  const [typedSymbol, setTypedSymbol] = useState("");
  const [understood, setUnderstood] = useState(false);

  const symbolMatches = typedSymbol.trim() === token.symbol;
  const canBurn = symbolMatches && understood;

  return (
    <div className="space-y-4">
      <dl className="space-y-2.5 rounded-lg bg-muted/50 p-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Token</dt>
          <dd className="flex items-center gap-1.5 font-medium">
            {token.symbol}
            <AddressDisplay
              address={token.address}
              copyable={false}
              className="text-muted-foreground"
            />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Amount</dt>
          <dd className="font-mono font-medium">
            {amountDisplay} {token.symbol}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Method</dt>
          <dd>
            {path === "burn" ? (
              <Badge variant="secondary">burn(): supply decreases</Badge>
            ) : (
              <span className="flex items-center gap-1.5 text-sm">
                <Badge variant="outline">transfer to dead address</Badge>
                <AddressDisplay
                  address={DEAD_ADDRESS}
                  copyable={false}
                  className="text-muted-foreground"
                />
              </span>
            )}
          </dd>
        </div>
      </dl>

      <p className="text-sm text-destructive">
        This is irreversible. Burned tokens can never be recovered, and you pay
        the gas.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="confirm-symbol">
          Type <span className="font-mono font-medium">{token.symbol}</span> to
          confirm
        </Label>
        <Input
          id="confirm-symbol"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={typedSymbol}
          onChange={(event) => setTypedSymbol(event.target.value)}
          aria-invalid={typedSymbol.length > 0 && !symbolMatches}
          placeholder={token.symbol}
        />
      </div>

      <Label className="flex items-start gap-2.5 text-sm font-normal">
        <Checkbox
          checked={understood}
          onCheckedChange={(value) => setUnderstood(value === true)}
          className="mt-0.5"
        />
        <span>I understand this is irreversible.</span>
      </Label>

      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <Button variant="destructive" disabled={!canBurn} onClick={onConfirm}>
          <Flame />
          Burn {token.symbol}
        </Button>
      </AlertDialogFooter>
    </div>
  );
}
