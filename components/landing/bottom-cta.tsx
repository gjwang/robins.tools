import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function BottomCta() {
  return (
    <section className="border-t border-border/60">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="rounded-2xl bg-primary px-6 py-12 text-primary-foreground sm:px-12 sm:py-16">
          <div className="max-w-xl">
            <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Start building on Robinhood Chain.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-primary-foreground/80 text-pretty sm:text-base">
              Open any tool in your browser. Connect a wallet only when you are
              ready to sign.
            </p>
            <Link
              href="/tools"
              className="group mt-8 inline-flex h-11 items-center gap-2 rounded-lg bg-primary-foreground px-6 text-sm font-medium text-primary transition-opacity hover:opacity-90 focus-visible:ring-3 focus-visible:ring-primary-foreground/40 focus-visible:outline-none"
            >
              Launch app
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
