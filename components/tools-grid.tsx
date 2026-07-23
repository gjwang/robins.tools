"use client";

import { useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type ToolCategory, tools } from "@/lib/tools";

type Filter = ToolCategory | "all";

const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "transact", label: "Transact" },
  { value: "read", label: "Read-only" },
  { value: "offline", label: "Offline" },
];

export function ToolsGrid() {
  const [filter, setFilter] = useState<Filter>("all");
  const visible =
    filter === "all" ? tools : tools.filter((tool) => tool.category === filter);

  return (
    <div className="space-y-6">
      <Tabs
        value={filter}
        onValueChange={(value) => setFilter(value as Filter)}
      >
        <TabsList>
          {filters.map((entry) => (
            <TabsTrigger key={entry.value} value={entry.value}>
              {entry.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.slug}
              href={`/tools/${tool.slug}`}
              className="group flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10 transition-all hover:-translate-y-0.5 hover:ring-foreground/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-foreground">
                  <Icon className="size-5" />
                </span>
                {tool.requiresWallet ? (
                  <Badge variant="secondary">Wallet</Badge>
                ) : null}
              </div>
              <div className="space-y-1">
                <h3 className="font-heading text-base font-medium">
                  {tool.name}
                </h3>
                <p className="text-sm text-muted-foreground">{tool.tagline}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
