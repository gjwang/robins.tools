"use client";

import { type AbiParameter } from "viem";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { isJsonParam } from "@/components/tools/contract/lib";

export type ArgValues = Record<number, string | boolean>;

export function initialArgValues(inputs: readonly AbiParameter[]): ArgValues {
  const values: ArgValues = {};
  inputs.forEach((param, index) => {
    values[index] = param.type === "bool" ? false : "";
  });
  return values;
}

function placeholderFor(param: AbiParameter): string {
  const { type } = param;
  if (type.includes("[") || type.startsWith("tuple")) {
    if (type.startsWith("tuple")) {
      return '["0x…", "123"]  // quote large numbers';
    }
    return '["0x…", "0x…"]  // JSON array, quote large numbers';
  }
  if (type === "address") return "0x…";
  if (type === "string") return "text";
  if (type === "bytes" || /^bytes\d+$/.test(type)) return "0x…";
  if (type.startsWith("uint")) return "0";
  if (type.startsWith("int")) return "0  (negatives allowed)";
  return "";
}

interface ArgFieldsProps {
  inputs: readonly AbiParameter[];
  values: ArgValues;
  onChange: (index: number, value: string | boolean) => void;
  idPrefix: string;
  disabled?: boolean;
}

/** Renders one labelled input per function argument, typed by ABI param. */
export function ArgFields({
  inputs,
  values,
  onChange,
  idPrefix,
  disabled,
}: ArgFieldsProps) {
  if (inputs.length === 0) return null;

  return (
    <div className="space-y-3">
      {inputs.map((param, index) => {
        const id = `${idPrefix}-arg-${index}`;
        const name =
          param.name && param.name.length > 0 ? param.name : `arg${index}`;
        const raw = values[index];

        return (
          <div key={id} className="space-y-1.5">
            <Label htmlFor={id} className="gap-1.5">
              <span className="font-mono">{name}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {param.type}
              </span>
            </Label>

            {param.type === "bool" ? (
              <div className="flex h-8 items-center gap-2">
                <Switch
                  id={id}
                  checked={raw === true}
                  onCheckedChange={(checked) => onChange(index, checked)}
                  disabled={disabled}
                />
                <span className="font-mono text-sm text-muted-foreground">
                  {raw === true ? "true" : "false"}
                </span>
              </div>
            ) : isJsonParam(param) ? (
              <Textarea
                id={id}
                value={typeof raw === "string" ? raw : ""}
                onChange={(event) => onChange(index, event.target.value)}
                placeholder={placeholderFor(param)}
                spellCheck={false}
                disabled={disabled}
                className="min-h-16 font-mono text-xs"
              />
            ) : (
              <Input
                id={id}
                value={typeof raw === "string" ? raw : ""}
                onChange={(event) => onChange(index, event.target.value)}
                placeholder={placeholderFor(param)}
                spellCheck={false}
                autoComplete="off"
                disabled={disabled}
                className="font-mono"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
