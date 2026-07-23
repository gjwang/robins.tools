import {
  BookOpenText,
  Focus,
  KeyRound,
  type LucideIcon,
  WifiOff,
} from "lucide-react";

const principles: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: KeyRound,
    title: "You hold the keys",
    body: "You review, approve, and fund every transaction from your own wallet. Nothing is ever custodied or proxied.",
  },
  {
    icon: Focus,
    title: "Focused on one chain",
    body: "Every tool targets Robinhood Chain, so there are no network switchers or unrelated options to configure.",
  },
  {
    icon: WifiOff,
    title: "Offline where it counts",
    body: "Key generation, hashing, and merkle proofs run entirely in your browser and never reach the network.",
  },
  {
    icon: BookOpenText,
    title: "Open source under MIT",
    body: "Read the code, fork it, or run your own copy. The full source is public on GitHub.",
  },
];

export function Principles() {
  return (
    <section className="border-t border-border/60">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="max-w-2xl">
          <h2 className="font-heading text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            Built to stay out of your way
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty sm:text-base">
            A few decisions keep the tools fast, private, and easy to trust.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {principles.map((principle) => {
            const Icon = principle.icon;
            return (
              <div
                key={principle.title}
                className="flex gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-accent-text">
                  <Icon className="size-5" />
                </span>
                <div className="space-y-1.5">
                  <h3 className="font-heading text-base font-semibold">
                    {principle.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
                    {principle.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
