"use client";

import { useMemo, useState } from "react";
import { hexToBytes, isHex, keccak256, stringToBytes } from "viem";

import { CopyButton } from "@/components/copy-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type InputMode = "utf8" | "hex";

const INVALID_HEX_MESSAGE =
  "Enter valid hex bytes (0x + an even number of hex characters).";

function hashHexBytes(input: string): { hash: string; error: string | null } {
  const trimmed = input.trim();
  const normalized =
    trimmed.startsWith("0x") || trimmed.startsWith("0X")
      ? trimmed
      : `0x${trimmed}`;

  if (!isHex(normalized)) {
    return { hash: "", error: INVALID_HEX_MESSAGE };
  }
  if (normalized.length % 2 !== 0) {
    return { hash: "", error: INVALID_HEX_MESSAGE };
  }
  return { hash: keccak256(hexToBytes(normalized)), error: null };
}

/**
 * Hashes the textarea contents live with keccak256, either as raw UTF-8 text or
 * as hex-encoded bytes. Entirely client-side.
 */
export function KeccakConverter() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<InputMode>("utf8");

  const { hash, error } = useMemo(() => {
    if (input.trim() === "") return { hash: "", error: null };
    if (mode === "utf8") {
      return { hash: keccak256(stringToBytes(input)), error: null };
    }
    return hashHexBytes(input);
  }, [input, mode]);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="keccak-input">Input</Label>
          <Select
            value={mode}
            onValueChange={(value) => setMode(value as InputMode)}
          >
            <SelectTrigger size="sm" className="w-40" aria-label="Input format">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="utf8">UTF-8 text</SelectItem>
              <SelectItem value="hex">Hex bytes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Textarea
          id="keccak-input"
          className="min-h-24 font-mono"
          spellCheck={false}
          placeholder={mode === "utf8" ? "Type or paste text..." : "0x..."}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          aria-invalid={Boolean(error)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="keccak-output">keccak256</Label>
        <div className="flex items-center gap-1.5">
          <Input
            id="keccak-output"
            readOnly
            className="font-mono"
            placeholder="0x..."
            value={hash}
          />
          <CopyButton value={hash} label="Copy hash" />
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
