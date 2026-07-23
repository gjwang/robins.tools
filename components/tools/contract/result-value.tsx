"use client";

import { type AbiParameter, isAddress } from "viem";

import { AddressDisplay } from "@/components/address-display";
import { CopyButton } from "@/components/copy-button";

function tupleComponents(param: AbiParameter): readonly AbiParameter[] {
  return (param as { components?: readonly AbiParameter[] }).components ?? [];
}

/** Renders a decoded ABI value as a typed, nested tree. */
export function ResultValue({
  param,
  value,
}: {
  param: AbiParameter;
  value: unknown;
}) {
  const arrayMatch = param.type.match(/^(.*)\[(\d*)\]$/);
  if (arrayMatch && Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted-foreground">[] (empty)</span>;
    }
    const baseParam = { ...param, type: arrayMatch[1] } as AbiParameter;
    return (
      <ul className="space-y-1 border-l border-border/60 pl-3">
        {value.map((element, index) => (
          <li key={index} className="flex gap-2">
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {index}
            </span>
            <ResultValue param={baseParam} value={element} />
          </li>
        ))}
      </ul>
    );
  }

  if (param.type === "tuple") {
    const components = tupleComponents(param);
    return (
      <ul className="space-y-1 border-l border-border/60 pl-3">
        {components.map((component, index) => {
          const child = Array.isArray(value)
            ? value[index]
            : value && typeof value === "object"
              ? (value as Record<string, unknown>)[component.name ?? ""]
              : undefined;
          return (
            <li key={index} className="flex flex-wrap gap-2">
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {component.name || index}
              </span>
              <ResultValue param={component} value={child} />
            </li>
          );
        })}
      </ul>
    );
  }

  const { type } = param;

  if (type === "address" && typeof value === "string" && isAddress(value)) {
    return <AddressDisplay address={value} />;
  }

  if (type === "bool") {
    return <span className="font-mono">{value ? "true" : "false"}</span>;
  }

  if (type.startsWith("uint") || type.startsWith("int")) {
    return (
      <span className="font-mono break-all">
        {typeof value === "bigint" ? value.toString() : String(value)}
      </span>
    );
  }

  if (type === "bytes" || /^bytes\d+$/.test(type)) {
    const hex = String(value);
    return (
      <span className="inline-flex items-center gap-1">
        <span className="font-mono text-sm break-all">{hex}</span>
        <CopyButton value={hex} label="Copy value" />
      </span>
    );
  }

  if (type === "string") {
    const text = String(value);
    return text === "" ? (
      <span className="text-muted-foreground">(empty string)</span>
    ) : (
      <span className="break-words">{text}</span>
    );
  }

  return <span className="font-mono break-all">{String(value)}</span>;
}
