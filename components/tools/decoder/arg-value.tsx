import { type AbiParameter, isAddress } from "viem";

import { AddressDisplay } from "@/components/address-display";
import { CopyButton } from "@/components/copy-button";
import { formatTokenAmount } from "@/lib/format";

function isArrayType(type: string): boolean {
  return /\[\d*\]$/.test(type);
}

function elementParam(param: AbiParameter): AbiParameter {
  return { ...param, type: param.type.replace(/\[\d*\]$/, "") } as AbiParameter;
}

function tupleComponents(param: AbiParameter): readonly AbiParameter[] {
  return "components" in param && param.components ? param.components : [];
}

const LARGE_18_DEC = 10n ** 15n;

function NumericValue({
  value,
  type,
}: {
  value: bigint | number;
  type: string;
}) {
  if (typeof value === "number") {
    return <span className="font-mono text-sm break-all">{value}</span>;
  }
  const abs = value < 0n ? -value : value;
  const isBigUint = /^u?int(256|128)?$/.test(type);
  const showHint = isBigUint && abs >= LARGE_18_DEC;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      <span className="font-mono text-sm break-all">
        {value.toLocaleString("en-US")}
      </span>
      {showHint ? (
        <span className="font-mono text-xs text-muted-foreground">
          ≈ {formatTokenAmount(value, 18)} if 18 decimals
        </span>
      ) : null}
    </span>
  );
}

function ScalarValue({
  param,
  value,
}: {
  param: AbiParameter;
  value: unknown;
}) {
  if (value === undefined || value === null) {
    return <span className="font-mono text-sm text-muted-foreground">-</span>;
  }

  if (typeof value === "bigint" || typeof value === "number") {
    return <NumericValue value={value} type={param.type} />;
  }

  if (typeof value === "boolean") {
    return (
      <span className="font-mono text-sm">{value ? "true" : "false"}</span>
    );
  }

  if (typeof value === "string") {
    if (param.type === "address" || isAddress(value)) {
      return <AddressDisplay address={value} />;
    }
    if (value.startsWith("0x")) {
      return (
        <span className="inline-flex max-w-full items-start gap-1">
          <span className="font-mono text-sm break-all">{value}</span>
          <CopyButton value={value} label="Copy value" />
        </span>
      );
    }
    return <span className="text-sm break-words">&quot;{value}&quot;</span>;
  }

  return <span className="font-mono text-sm break-all">{String(value)}</span>;
}

/**
 * Recursively render a decoded ABI value. Scalars render inline; arrays and
 * tuples nest with an indent guide. Addresses link out, bigints show an exact
 * grouped value plus an 18-decimal hint when large, bytes get a copy button.
 */
export function ArgValue({
  param,
  value,
}: {
  param: AbiParameter;
  value: unknown;
}) {
  if (isArrayType(param.type)) {
    const items = Array.isArray(value) ? value : [];
    if (items.length === 0) {
      return (
        <span className="font-mono text-sm text-muted-foreground">[]</span>
      );
    }
    const child = elementParam(param);
    return (
      <div className="ml-1 space-y-1 border-l border-border/60 pl-3">
        {items.map((item, i) => (
          <div key={i} className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-mono text-xs text-muted-foreground">
              [{i}]
            </span>
            <ArgValue param={child} value={item} />
          </div>
        ))}
      </div>
    );
  }

  if (param.type === "tuple") {
    const components = tupleComponents(param);
    return (
      <div className="ml-1 space-y-1 border-l border-border/60 pl-3">
        {components.map((component, i) => {
          const childValue = Array.isArray(value)
            ? value[i]
            : value && typeof value === "object"
              ? (value as Record<string, unknown>)[component.name ?? String(i)]
              : undefined;
          return (
            <div key={i} className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-xs text-muted-foreground">
                {component.name || `#${i}`}
                <span className="ml-1 opacity-70">
                  {paramTypeLabel(component)}
                </span>
              </span>
              <ArgValue param={component} value={childValue} />
            </div>
          );
        })}
      </div>
    );
  }

  return <ScalarValue param={param} value={value} />;
}

/** Short type label used beside nested tuple fields (e.g. `address`, `(uint256,bool)`). */
export function paramTypeLabel(param: AbiParameter): string {
  if (param.type.startsWith("tuple")) {
    const inner = tupleComponents(param).map(paramTypeLabel).join(",");
    return `(${inner})${param.type.slice("tuple".length)}`;
  }
  return param.type;
}
