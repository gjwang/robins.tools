"use client";

import { ChecksumConverter } from "@/components/tools/converter/checksum-converter";
import { HexDecimalConverter } from "@/components/tools/converter/hex-decimal-converter";
import { KeccakConverter } from "@/components/tools/converter/keccak-converter";
import { UnitsConverter } from "@/components/tools/converter/units-converter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Tabbed shell for the four offline conversions. Zero network requests. */
export function ConverterTool() {
  return (
    <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <Tabs defaultValue="units">
        <TabsList>
          <TabsTrigger value="units">Units</TabsTrigger>
          <TabsTrigger value="hex">Hex ↔ Decimal</TabsTrigger>
          <TabsTrigger value="keccak">Keccak-256</TabsTrigger>
          <TabsTrigger value="checksum">Checksum</TabsTrigger>
        </TabsList>
        <TabsContent value="units" className="mt-6">
          <UnitsConverter />
        </TabsContent>
        <TabsContent value="hex" className="mt-6">
          <HexDecimalConverter />
        </TabsContent>
        <TabsContent value="keccak" className="mt-6">
          <KeccakConverter />
        </TabsContent>
        <TabsContent value="checksum" className="mt-6">
          <ChecksumConverter />
        </TabsContent>
      </Tabs>
    </div>
  );
}
