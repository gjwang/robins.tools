"use client";

import { useState } from "react";

import { CopyButton } from "@/components/copy-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const HEX_BODY_RE = /^[0-9a-fA-F]+$/;
const DECIMAL_RE = /^\d+$/;

function stripHexPrefix(value: string): string {
  return value.startsWith("0x") || value.startsWith("0X")
    ? value.slice(2)
    : value;
}

/**
 * Two linked fields: hex (with or without `0x`, case-insensitive) and arbitrary-
 * precision decimal. Conversion goes through bigint, so there's no precision loss
 * regardless of size. Negative and malformed input are rejected, not guessed at.
 */
export function HexDecimalConverter() {
  const [hex, setHex] = useState("");
  const [decimal, setDecimal] = useState("");
  const [errorField, setErrorField] = useState<"hex" | "decimal" | null>(null);

  function handleHexChange(raw: string) {
    setHex(raw);
    if (raw.trim() === "") {
      setDecimal("");
      setErrorField(null);
      return;
    }
    const body = stripHexPrefix(raw.trim());
    if (body === "" || !HEX_BODY_RE.test(body)) {
      setDecimal("");
      setErrorField("hex");
      return;
    }
    setDecimal(BigInt(`0x${body}`).toString(10));
    setErrorField(null);
  }

  function handleDecimalChange(raw: string) {
    setDecimal(raw);
    if (raw.trim() === "") {
      setHex("");
      setErrorField(null);
      return;
    }
    const trimmed = raw.trim();
    if (!DECIMAL_RE.test(trimmed)) {
      setHex("");
      setErrorField("decimal");
      return;
    }
    setHex(`0x${BigInt(trimmed).toString(16)}`);
    setErrorField(null);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="hex-field">Hex</Label>
        <div className="flex items-center gap-1.5">
          <Input
            id="hex-field"
            className="font-mono"
            autoComplete="off"
            spellCheck={false}
            placeholder="0x..."
            value={hex}
            onChange={(event) => handleHexChange(event.target.value)}
            aria-invalid={errorField === "hex"}
          />
          <CopyButton value={hex} label="Copy hex" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="decimal-field">Decimal</Label>
        <div className="flex items-center gap-1.5">
          <Input
            id="decimal-field"
            className="font-mono"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            placeholder="0"
            value={decimal}
            onChange={(event) => handleDecimalChange(event.target.value)}
            aria-invalid={errorField === "decimal"}
          />
          <CopyButton value={decimal} label="Copy decimal" />
        </div>
      </div>
      {errorField === "hex" ? (
        <p className="text-sm text-destructive">
          Enter valid hex (0-9, a-f), with or without a 0x prefix.
        </p>
      ) : null}
      {errorField === "decimal" ? (
        <p className="text-sm text-destructive">
          Enter a non-negative whole number.
        </p>
      ) : null}
    </div>
  );
}
