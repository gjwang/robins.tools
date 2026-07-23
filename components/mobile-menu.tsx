"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";

import { GitHubStars } from "@/components/github-stars";
import { TelegramIcon, XIcon } from "@/components/social-icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { TELEGRAM_URL, X_URL } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const navLinks = [
  { href: "/tools", label: "Toolkit" },
  { href: "/docs", label: "Docs" },
  { href: "/token", label: "$TOOLS Token" },
];

/**
 * Hamburger menu for viewports below `md`. Opens a right-side sheet with the
 * nav links, the GitHub link (with star count), and a theme toggle. The desktop
 * header keeps these inline, so this is hidden from `md` up.
 */
export function MobileMenu({ githubUrl }: { githubUrl?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72 gap-0 bg-background p-0">
        <SheetHeader className="border-b border-border/60 p-4">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>

        <nav className="flex flex-col gap-1 p-3">
          {navLinks.map((link) => (
            <Button
              key={link.href}
              asChild
              variant="ghost"
              className="h-11 justify-start px-3 text-base font-normal"
              onClick={() => setOpen(false)}
            >
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
        </nav>

        <Separator />

        <div className="flex flex-col gap-1 p-3">
          <a
            href={X_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 items-center gap-3 rounded-lg px-3 text-base text-foreground transition-colors hover:bg-muted"
          >
            <XIcon className="size-5" />
            X (Twitter)
          </a>
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 items-center gap-3 rounded-lg px-3 text-base text-foreground transition-colors hover:bg-muted"
          >
            <TelegramIcon className="size-5" />
            Telegram
          </a>
          {githubUrl ? (
            <GitHubStars
              url={githubUrl}
              label="GitHub"
              className="h-11 justify-start gap-3 rounded-lg px-3 text-base text-foreground transition-colors hover:bg-muted"
            />
          ) : null}
          <div className="flex h-11 items-center justify-between rounded-lg px-3">
            <span className="text-base">Theme</span>
            <ThemeToggle />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
