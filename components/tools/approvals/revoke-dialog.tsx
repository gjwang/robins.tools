"use client";

import { Loader2, ShieldX } from "lucide-react";

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
import { type ApprovalRow } from "@/components/tools/approvals/scan";
import { formatTokenAmount } from "@/lib/format";

interface RevokeDialogProps {
  /** The row being revoked, or null when the dialog is closed. */
  row: ApprovalRow | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isRevoking: boolean;
}

/**
 * Confirmation for revoking a single ERC-20 allowance (an `approve(spender, 0)`
 * transaction). Not fund-destructive, so a single explicit confirm is enough.
 */
export function RevokeDialog({
  row,
  onOpenChange,
  onConfirm,
  isRevoking,
}: RevokeDialogProps) {
  return (
    <AlertDialog
      open={row !== null}
      onOpenChange={(open) => {
        // Don't let the user dismiss mid-transaction.
        if (!open && isRevoking) return;
        onOpenChange(open);
      }}
    >
      <AlertDialogContent className="max-w-md sm:max-w-md">
        {row ? (
          <>
            <AlertDialogHeader>
              <AlertDialogMedia>
                <ShieldX />
              </AlertDialogMedia>
              <AlertDialogTitle>
                Revoke {row.tokenSymbol} approval?
              </AlertDialogTitle>
            </AlertDialogHeader>

            <dl className="space-y-2.5 rounded-lg bg-muted/50 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Token</dt>
                <dd className="flex items-center gap-1.5 font-medium">
                  {row.tokenSymbol}
                  <AddressDisplay
                    address={row.token}
                    copyable={false}
                    className="text-muted-foreground"
                  />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Spender</dt>
                <dd className="flex items-center gap-1.5 font-medium">
                  {row.spenderName ? (
                    <span className="max-w-[10rem] truncate">
                      {row.spenderName}
                    </span>
                  ) : null}
                  <AddressDisplay
                    address={row.spender}
                    copyable={false}
                    className="text-muted-foreground"
                  />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Current allowance</dt>
                <dd>
                  {row.isUnlimited ? (
                    <Badge variant="destructive">Unlimited</Badge>
                  ) : (
                    <span className="font-mono font-medium">
                      {formatTokenAmount(row.allowance, row.tokenDecimals)}{" "}
                      {row.tokenSymbol}
                    </span>
                  )}
                </dd>
              </div>
            </dl>

            <p className="text-sm text-muted-foreground">
              This sets the allowance to zero in one transaction. You pay the
              gas.
            </p>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={isRevoking}>
                Cancel
              </AlertDialogCancel>
              <Button onClick={onConfirm} disabled={isRevoking}>
                {isRevoking ? <Loader2 className="animate-spin" /> : null}
                Revoke
              </Button>
            </AlertDialogFooter>
          </>
        ) : null}
      </AlertDialogContent>
    </AlertDialog>
  );
}
