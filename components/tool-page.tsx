import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { HowItWorks, type HowItWorksStep } from "@/components/how-it-works";
import { Badge } from "@/components/ui/badge";
import { type ToolCategory, getTool } from "@/lib/tools";

const categoryLabels: Record<ToolCategory, string> = {
  transact: "On-chain",
  read: "Read-only",
  offline: "Offline",
};

interface ToolPageProps {
  slug: string;
  steps: HowItWorksStep[];
  children: ReactNode;
}

/**
 * Shared shell for every tool page: title, tagline, category/wallet badges, the
 * tool UI, and a "How it works" panel (sticky beside the tool on desktop,
 * collapsible above it on mobile). Server-compatible.
 */
export function ToolPage({ slug, steps, children }: ToolPageProps) {
  const tool = getTool(slug);

  if (!tool) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        {children}
      </div>
    );
  }

  const badges = (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="secondary">{categoryLabels[tool.category]}</Badge>
      {tool.requiresWallet ? (
        <Badge variant="outline">Wallet required</Badge>
      ) : null}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="max-w-2xl space-y-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-foreground">
            <tool.icon className="size-5" />
          </span>
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            {tool.name}
          </h1>
        </div>
        <p className="text-muted-foreground">{tool.tagline}</p>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="order-2 min-w-0 lg:order-1">{children}</div>

        <aside className="order-1 lg:order-2">
          {/* Desktop: sticky, always-visible panel. */}
          <div className="hidden rounded-xl bg-card p-5 ring-1 ring-foreground/10 lg:sticky lg:top-20 lg:block">
            <p className="mb-4 font-heading text-sm font-medium">
              How it works
            </p>
            <div className="mb-4">{badges}</div>
            <HowItWorks steps={steps} docsSlug={tool.docsSlug} />
          </div>

          {/* Mobile: native collapsible, no JS required. */}
          <details className="group rounded-xl bg-card ring-1 ring-foreground/10 lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between p-5 font-heading text-sm font-medium">
              How it works
              <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-4 px-5 pb-5">
              {badges}
              <HowItWorks steps={steps} docsSlug={tool.docsSlug} />
            </div>
          </details>
        </aside>
      </div>
    </div>
  );
}
