import Image from "next/image";
import Link from "next/link";

import { ConnectButton } from "@/components/connect-button";
import { GitHubStars } from "@/components/github-stars";
import { MobileMenu } from "@/components/mobile-menu";
import { TelegramIcon, XIcon } from "@/components/social-icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { TELEGRAM_URL, X_URL } from "@/lib/site";

const githubUrl = process.env.NEXT_PUBLIC_GITHUB_URL;

const navLinks = [
  { href: "/tools", label: "Toolkit" },
  { href: "/docs", label: "Docs" },
  { href: "/token", label: "$TOOLS Token" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2"
          aria-label="robins.tools home"
        >
          <Image
            src="/logo.png"
            alt=""
            width={26}
            height={26}
            className="rounded-md"
            priority
          />
          <span className="text-base tracking-tight">
            <span className="font-semibold">robins</span>
            <span className="text-muted-foreground">.tools</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Button key={link.href} asChild variant="ghost" size="sm">
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <a
            href={X_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="robins.tools on X"
            className="hidden size-9 items-center justify-center rounded-lg text-foreground/80 transition-colors hover:bg-muted hover:text-foreground md:inline-flex"
          >
            <XIcon className="size-4" />
          </a>
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="robins.tools on Telegram"
            className="hidden size-9 items-center justify-center rounded-lg text-foreground/80 transition-colors hover:bg-muted hover:text-foreground md:inline-flex"
          >
            <TelegramIcon className="size-4" />
          </a>
          {githubUrl ? (
            <GitHubStars
              url={githubUrl}
              className="hidden h-9 rounded-lg px-2.5 text-foreground/80 transition-colors hover:bg-muted hover:text-foreground md:inline-flex"
            />
          ) : null}
          <div className="hidden md:block">
            <ThemeToggle />
          </div>
          <ConnectButton />
          <MobileMenu githubUrl={githubUrl} />
        </div>
      </div>
    </header>
  );
}
