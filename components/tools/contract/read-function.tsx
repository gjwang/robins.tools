"use client";

import { useState } from "react";
import { type Abi, type AbiFunction } from "viem";
import { Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  ArgFields,
  type ArgValues,
  initialArgValues,
} from "@/components/tools/contract/arg-fields";
import {
  buildArgs,
  errorMessage,
  stringifyResult,
} from "@/components/tools/contract/lib";
import { ResultValue } from "@/components/tools/contract/result-value";
import { publicClient } from "@/lib/public-client";

interface ReadFunctionProps {
  address: `0x${string}`;
  abi: Abi;
  fn: AbiFunction;
  idPrefix: string;
}

export function ReadFunction({
  address,
  abi,
  fn,
  idPrefix,
}: ReadFunctionProps) {
  const [values, setValues] = useState<ArgValues>(() =>
    initialArgValues(fn.inputs),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(undefined);
  const [hasResult, setHasResult] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  function setValue(index: number, value: string | boolean) {
    setValues((prev) => ({ ...prev, [index]: value }));
  }

  async function onQuery() {
    setError(null);
    let args: unknown[];
    try {
      args = buildArgs(fn.inputs, values);
    } catch (buildError) {
      setError(errorMessage(buildError));
      return;
    }

    setLoading(true);
    setHasResult(false);
    try {
      const data = await publicClient.readContract({
        address,
        abi,
        functionName: fn.name,
        args,
      });
      setResult(data);
      setHasResult(true);
    } catch (callError) {
      setError(errorMessage(callError));
    } finally {
      setLoading(false);
    }
  }

  const outputs = fn.outputs;
  const outputValues =
    hasResult && outputs.length > 1 && Array.isArray(result)
      ? (result as unknown[])
      : hasResult
        ? [result]
        : [];

  return (
    <div className="space-y-4">
      <ArgFields
        inputs={fn.inputs}
        values={values}
        onChange={setValue}
        idPrefix={idPrefix}
        disabled={loading}
      />

      <Button onClick={onQuery} disabled={loading} size="sm">
        {loading ? <Loader2 className="animate-spin" /> : null}
        {loading ? "Querying…" : "Query"}
      </Button>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {hasResult ? (
        <div className="rounded-lg bg-muted/40 p-3 ring-1 ring-foreground/10">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Result
            </span>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Raw JSON
              <Switch
                size="sm"
                checked={showRaw}
                onCheckedChange={setShowRaw}
              />
            </label>
          </div>

          {outputs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              This function returns no value.
            </p>
          ) : showRaw ? (
            <pre className="overflow-x-auto rounded bg-background p-2 font-mono text-xs">
              {stringifyResult(outputs.length > 1 ? outputValues : result)}
            </pre>
          ) : (
            <div className="space-y-2 text-sm">
              {outputs.map((output, index) => (
                <div key={index} className="space-y-0.5">
                  {outputs.length > 1 || output.name ? (
                    <span className="font-mono text-xs text-muted-foreground">
                      {output.name || `output ${index}`} ({output.type})
                    </span>
                  ) : null}
                  <ResultValue param={output} value={outputValues[index]} />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
