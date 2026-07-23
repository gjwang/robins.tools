"use client";

import { useState } from "react";
import { formatUnits, parseUnits } from "viem";

import { CopyButton } from "@/components/copy-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const UNITS = [
  { key: "wei", label: "Wei", decimals: 0 },
  { key: "gwei", label: "Gwei", decimals: 9 },
  { key: "ether", label: "Ether", decimals: 18 },
] as const;

type UnitKey = (typeof UNITS)[number]["key"];

const EMPTY_VALUES: Record<UnitKey, string> = { wei: "", gwei: "", ether: "" };

/** True if `value` is a non-negative decimal string with at most `decimals` fractional digits. */
function isValidDecimal(value: string, decimals: number): boolean {
  if (!/^\d+(\.\d+)?$/.test(value)) return false;
  const fraction = value.split(".")[1] ?? "";
  return fraction.length <= decimals;
}

/**
 * Three linked wei / gwei / ether fields. Typing a valid value in one recomputes
 * the other two via bigint wei, with no floats and no silent rounding. Invalid input
 * blanks the other fields and shows an inline error instead of guessing.
 */
export function UnitsConverter() {
  const [values, setValues] = useState<Record<UnitKey, string>>(EMPTY_VALUES);
  const [errorField, setErrorField] = useState<UnitKey | null>(null);

  function handleChange(key: UnitKey, raw: string) {
    if (raw.trim() === "") {
      setValues(EMPTY_VALUES);
      setErrorField(null);
      return;
    }

    const decimals = UNITS.find((unit) => unit.key === key)!.decimals;
    if (!isValidDecimal(raw, decimals)) {
      setValues({ ...EMPTY_VALUES, [key]: raw });
      setErrorField(key);
      return;
    }

    try {
      const wei = parseUnits(raw, decimals);
      setValues({
        wei: formatUnits(wei, 0),
        gwei: formatUnits(wei, 9),
        ether: formatUnits(wei, 18),
      });
      setErrorField(null);
    } catch {
      setValues({ ...EMPTY_VALUES, [key]: raw });
      setErrorField(key);
    }
  }

  const errorUnit = errorField
    ? UNITS.find((unit) => unit.key === errorField)
    : null;

  return (
    <div className="space-y-4">
      {UNITS.map((unit) => (
        <div key={unit.key} className="space-y-1.5">
          <Label htmlFor={`unit-${unit.key}`}>{unit.label}</Label>
          <div className="flex items-center gap-1.5">
            <Input
              id={`unit-${unit.key}`}
              className="font-mono"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              placeholder="0"
              value={values[unit.key]}
              onChange={(event) => handleChange(unit.key, event.target.value)}
              aria-invalid={errorField === unit.key}
            />
            <CopyButton
              value={values[unit.key]}
              label={`Copy ${unit.label.toLowerCase()}`}
            />
          </div>
        </div>
      ))}
      {errorUnit ? (
        <p className="text-sm text-destructive">
          Enter a non-negative number with up to {errorUnit.decimals} decimal
          places.
        </p>
      ) : null}
    </div>
  );
}
