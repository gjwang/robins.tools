"use client";

import { useMemo, useState } from "react";
import { getAddress, isAddress } from "viem";
import { CheckCircle2, XCircle } from "lucide-react";

import { CopyButton } from "@/components/copy-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Explains why `trimmed` failed EIP-55 validation (assumes it already failed). */
function explainInvalid(trimmed: string): string {
  if (!trimmed.startsWith("0x") && !trimmed.startsWith("0X")) {
    return "Address must start with 0x.";
  }
  const body = trimmed.slice(2);
  if (!/^[0-9a-fA-F]*$/.test(body)) {
    return "Contains characters outside 0-9 and a-f.";
  }
  if (body.length !== 40) {
    return `Wrong length: ${body.length} hex characters after 0x, expected 40.`;
  }
  return "Mixed-case checksum doesn't match EIP-55, likely a typo.";
}

interface ChecksumResult {
  valid: boolean;
  checksummed: string;
  lower: string;
  error: string;
}

/**
 * Validates a single address against EIP-55 (all-lowercase/uppercase input is
 * treated as valid but un-checksummed; mixed-case input must match exactly) and
 * shows both the checksummed and lowercase forms.
 */
export function ChecksumConverter() {
  const [raw, setRaw] = useState("");

  const result: ChecksumResult = useMemo(() => {
    const trimmed = raw.trim();
    if (trimmed === "") {
      return { valid: false, checksummed: "", lower: "", error: "" };
    }
    if (!isAddress(trimmed, { strict: true })) {
      return {
        valid: false,
        checksummed: "",
        lower: "",
        error: explainInvalid(trimmed),
      };
    }
    const checksummed = getAddress(trimmed);
    return {
      valid: true,
      checksummed,
      lower: checksummed.toLowerCase(),
      error: "",
    };
  }, [raw]);

  const showStatus = raw.trim() !== "";

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="checksum-input">Address</Label>
        <Input
          id="checksum-input"
          className="font-mono"
          autoComplete="off"
          spellCheck={false}
          placeholder="0x..."
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          aria-invalid={showStatus && !result.valid}
        />
      </div>

      {showStatus ? (
        <div
          className={cn(
            "flex items-center gap-2 text-sm",
            result.valid ? "text-foreground" : "text-destructive",
          )}
        >
          {result.valid ? (
            <CheckCircle2 className="size-4 shrink-0" />
          ) : (
            <XCircle className="size-4 shrink-0" />
          )}
          <span>{result.valid ? "Valid address" : result.error}</span>
        </div>
      ) : null}

      {result.valid ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="checksum-mixed">Checksummed (EIP-55)</Label>
            <div className="flex items-center gap-1.5">
              <Input
                id="checksum-mixed"
                readOnly
                className="font-mono"
                value={result.checksummed}
              />
              <CopyButton
                value={result.checksummed}
                label="Copy checksummed address"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="checksum-lower">Lowercase</Label>
            <div className="flex items-center gap-1.5">
              <Input
                id="checksum-lower"
                readOnly
                className="font-mono"
                value={result.lower}
              />
              <CopyButton value={result.lower} label="Copy lowercase address" />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
