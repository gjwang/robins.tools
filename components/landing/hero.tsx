import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { robinhoodChain } from "@/lib/chain";

const specs = [`Chain ID ${robinhoodChain.id}`, "ETH gas", "Arbitrum Orbit L2"];

export function Hero() {
  return (
    <section className="relative">
      <div className="mx-auto w-full max-w-6xl px-4 pt-20 pb-16 sm:px-6 sm:pt-28 sm:pb-20 lg:pt-32">
        <div className="flex max-w-3xl flex-col items-start gap-6 sm:gap-7">
          <div className="flex flex-col gap-3">
            <p className="font-mono text-sm font-medium text-accent-text">
              The first open-source toolkit for Robinhood Chain
            </p>

            <h1 className="font-heading text-[2.75rem] leading-[1.04] font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl">
              Open-source tools for Robinhood Chain.
            </h1>
          </div>

          <p className="max-w-xl text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
            Every tool runs in your browser. Transactions are signed by your
            wallet and reads go straight to the public RPC, with no server in
            between.
          </p>

          <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="h-11 px-5 text-[0.95rem]">
              <Link href="/tools">
                Launch app
                <ArrowRight className="size-4 transition-transform group-hover/button:translate-x-0.5" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-11 px-5 text-[0.95rem]"
            >
              <Link href="/docs">Read the docs</Link>
            </Button>
          </div>

          <div className="mt-3 inline-flex items-stretch divide-x divide-border overflow-hidden rounded-lg border border-border bg-card">
            {specs.map((spec) => (
              <span
                key={spec}
                className="px-3 py-1.5 font-mono text-xs text-foreground/80"
              >
                {spec}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
