import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { type ToolCategory, type ToolMeta, tools } from "@/lib/tools";

const categories: { id: ToolCategory; label: string; blurb: string }[] = [
  {
    id: "transact",
    label: "Transact",
    blurb: "Sign and pay. These write to the chain.",
  },
  {
    id: "read",
    label: "Read-only",
    blurb: "Query the chain. No wallet or gas needed.",
  },
  {
    id: "offline",
    label: "Offline",
    blurb: "Local compute only. Never touches the network.",
  },
];

function ToolCard({ tool }: { tool: ToolMeta }) {
  const Icon = tool.icon;
  return (
    <Link
      href={`/tools/${tool.slug}`}
      className="group flex flex-col gap-3.5 rounded-xl bg-card p-5 ring-1 ring-foreground/10 transition-all hover:-translate-y-0.5 hover:ring-foreground/25 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="flex items-center justify-between">
        <span className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-accent-text transition-colors group-hover:bg-primary/25">
          <Icon className="size-5" />
        </span>
        {tool.requiresWallet ? <Badge variant="secondary">Wallet</Badge> : null}
      </div>
      <div className="space-y-1">
        <h3 className="font-heading text-base font-medium">{tool.name}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {tool.tagline}
        </p>
      </div>
    </Link>
  );
}

export function ToolShowcase() {
  return (
    <section className="border-t border-border/60">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="max-w-2xl">
          <h2 className="font-heading text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            Every tool, grouped by what it touches
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty sm:text-base">
            From batch transfers to fully offline utilities. Each tool opens in
            your browser and is ready to use.
          </p>
        </div>

        <div className="mt-12 space-y-12">
          {categories.map((category) => {
            const group = tools.filter((tool) => tool.category === category.id);
            return (
              <div key={category.id}>
                <div className="flex flex-col gap-1 border-b border-border/60 pb-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <h3 className="font-heading text-lg font-semibold tracking-tight">
                    {category.label}
                  </h3>
                  <p className="font-mono text-xs text-muted-foreground">
                    {category.blurb}
                  </p>
                </div>
                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.map((tool) => (
                    <ToolCard key={tool.slug} tool={tool} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
