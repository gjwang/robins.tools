import Link from "next/link";

import { GithubIcon } from "@/components/github-icon";
import { TelegramIcon, XIcon } from "@/components/social-icons";
import { TELEGRAM_URL, X_URL } from "@/lib/site";

const githubUrl = process.env.NEXT_PUBLIC_GITHUB_URL;

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="space-y-1">
          <p className="text-sm">
            <span className="font-semibold">robins.tools</span>
            <span className="text-muted-foreground">
              {" "}
              is a set of open-source, privacy-first tools for Robinhood Chain.
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            MIT licensed. Everything runs in your browser.
          </p>
        </div>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link
            href="/docs"
            className="transition-colors hover:text-foreground"
          >
            Docs
          </Link>
          <Link
            href="/tools/network"
            className="transition-colors hover:text-foreground"
          >
            Network status
          </Link>
          {githubUrl ? (
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              <GithubIcon className="size-4" />
              GitHub
            </a>
          ) : null}
          <a
            href={X_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <XIcon className="size-4" />
            X
          </a>
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <TelegramIcon className="size-4" />
            Telegram
          </a>
        </nav>
      </div>
    </footer>
  );
}
