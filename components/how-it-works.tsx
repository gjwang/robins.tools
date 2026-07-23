import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export interface HowItWorksStep {
  title: string;
  body: string;
}

interface HowItWorksProps {
  steps: HowItWorksStep[];
  docsSlug: string;
}

/** Numbered "How it works" steps plus a link to the tool's documentation. */
export function HowItWorks({ steps, docsSlug }: HowItWorksProps) {
  return (
    <div className="space-y-4">
      <ol className="space-y-4">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/15 font-mono text-xs font-medium text-foreground tabular-nums">
              {index + 1}
            </span>
            <div className="space-y-0.5">
              <p className="text-sm leading-snug font-medium">{step.title}</p>
              <p className="text-sm text-muted-foreground">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <Link
        href={docsSlug}
        className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
      >
        Read the docs
        <ArrowUpRight className="size-3.5" />
      </Link>
    </div>
  );
}
