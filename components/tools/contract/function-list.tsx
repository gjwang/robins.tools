"use client";

import { useMemo, useState } from "react";
import { type Abi, type AbiFunction } from "viem";
import { useAccount } from "wagmi";
import { Search } from "lucide-react";

import { ConnectButton } from "@/components/connect-button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  functionSignature,
  getReadFunctions,
  getWriteFunctions,
} from "@/components/tools/contract/lib";
import { ReadFunction } from "@/components/tools/contract/read-function";
import { WriteFunction } from "@/components/tools/contract/write-function";
import { robinhoodChain } from "@/lib/chain";
import { truncateAddress } from "@/lib/format";

interface FunctionListProps {
  address: `0x${string}`;
  abi: Abi;
}

function matches(fn: AbiFunction, query: string): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  return (
    fn.name.toLowerCase().includes(needle) ||
    functionSignature(fn).toLowerCase().includes(needle)
  );
}

function FunctionTrigger({ fn }: { fn: AbiFunction }) {
  return (
    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 pr-2">
      <span className="font-mono font-medium">{fn.name}</span>
      <span className="font-mono text-xs text-muted-foreground">
        ({fn.inputs.map((input) => input.type).join(", ")})
      </span>
    </span>
  );
}

export function FunctionList({ address, abi }: FunctionListProps) {
  const readFns = useMemo(() => getReadFunctions(abi), [abi]);
  const writeFns = useMemo(() => getWriteFunctions(abi), [abi]);

  const [tab, setTab] = useState<string>(readFns.length > 0 ? "read" : "write");
  const [query, setQuery] = useState("");

  const { isConnected, chainId } = useAccount();
  const wrongNetwork = isConnected && chainId !== robinhoodChain.id;
  const canWrite = isConnected && !wrongNetwork;

  const filteredRead = readFns.filter((fn) => matches(fn, query));
  const filteredWrite = writeFns.filter((fn) => matches(fn, query));

  return (
    <Tabs value={tab} onValueChange={setTab} className="gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TabsList>
          <TabsTrigger value="read">
            Read
            <Badge variant="secondary" className="ml-1.5">
              {readFns.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="write">
            Write
            <Badge variant="secondary" className="ml-1.5">
              {writeFns.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search functions"
            spellCheck={false}
            className="pl-8"
          />
        </div>
      </div>

      <TabsContent value="read">
        {readFns.length === 0 ? (
          <EmptyState>This contract has no read functions.</EmptyState>
        ) : filteredRead.length === 0 ? (
          <EmptyState>No read functions match your search.</EmptyState>
        ) : (
          <Accordion
            type="multiple"
            className="rounded-lg ring-1 ring-foreground/10"
          >
            {filteredRead.map((fn, index) => {
              const key = `read-${fn.name}-${index}`;
              return (
                <AccordionItem key={key} value={key} className="px-3">
                  <AccordionTrigger>
                    <FunctionTrigger fn={fn} />
                  </AccordionTrigger>
                  <AccordionContent>
                    <ReadFunction
                      address={address}
                      abi={abi}
                      fn={fn}
                      idPrefix={key}
                    />
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </TabsContent>

      <TabsContent value="write" className="space-y-4">
        <WriteConnection
          isConnected={isConnected}
          wrongNetwork={wrongNetwork}
        />

        {writeFns.length === 0 ? (
          <EmptyState>This contract has no write functions.</EmptyState>
        ) : filteredWrite.length === 0 ? (
          <EmptyState>No write functions match your search.</EmptyState>
        ) : (
          <Accordion
            type="multiple"
            className="rounded-lg ring-1 ring-foreground/10"
          >
            {filteredWrite.map((fn, index) => {
              const key = `write-${fn.name}-${index}`;
              return (
                <AccordionItem key={key} value={key} className="px-3">
                  <AccordionTrigger>
                    <FunctionTrigger fn={fn} />
                  </AccordionTrigger>
                  <AccordionContent>
                    <WriteFunction
                      address={address}
                      abi={abi}
                      fn={fn}
                      idPrefix={key}
                      canWrite={canWrite}
                    />
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </TabsContent>
    </Tabs>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function WriteConnection({
  isConnected,
  wrongNetwork,
}: {
  isConnected: boolean;
  wrongNetwork: boolean;
}) {
  const { address } = useAccount();

  if (!isConnected) {
    return (
      <Alert className="flex flex-wrap items-center justify-between gap-3">
        <AlertDescription>
          Connect a wallet to simulate and send write transactions.
        </AlertDescription>
        <ConnectButton />
      </Alert>
    );
  }

  if (wrongNetwork) {
    return (
      <Alert
        variant="destructive"
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <AlertDescription>
          Wrong network. Switch to {robinhoodChain.name} to send writes.
        </AlertDescription>
        <ConnectButton />
      </Alert>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="size-2 rounded-full bg-accent-text" aria-hidden="true" />
      Connected{address ? ` as ${truncateAddress(address)}` : ""} · reads are
      free, writes prompt your wallet.
    </div>
  );
}
