"use client";

import { useQuery } from "@tanstack/react-query";

import { GithubIcon } from "@/components/github-icon";
import { cn } from "@/lib/utils";

const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

interface Repo {
  owner: string;
  repo: string;
}

/**
 * Pull the owner/repo out of a GitHub URL. Tolerant of a trailing slash, a
 * `.git` suffix, and extra path segments (tree/blob/…). Returns null for
 * anything that is not a github.com repo URL so the caller can fall back to a
 * plain icon link.
 */
function parseRepo(url: string): Repo | null {
  try {
    const { hostname, pathname } = new URL(url);
    if (hostname !== "github.com" && hostname !== "www.github.com") return null;
    const [owner, repoRaw] = pathname.split("/").filter(Boolean);
    if (!owner || !repoRaw) return null;
    const repo = repoRaw.replace(/\.git$/, "");
    if (!repo) return null;
    return { owner, repo };
  } catch {
    return null;
  }
}

/**
 * GitHub link that also shows the repository's star count when it can be
 * fetched. The count is progressive enhancement only: while it loads, on a
 * fetch error, or on API rate-limit, the link renders as a plain icon with no
 * error state. Works with any repo URL, or none.
 */
export function GitHubStars({
  url,
  className,
  label,
}: {
  url: string;
  className?: string;
  /** Optional visible text (e.g. "GitHub") shown between the icon and count. */
  label?: string;
}) {
  const repo = parseRepo(url);

  const { data: stars } = useQuery({
    queryKey: ["github-stars", repo?.owner, repo?.repo],
    enabled: repo !== null,
    staleTime: 60 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const res = await fetch(
        `https://api.github.com/repos/${repo!.owner}/${repo!.repo}`,
      );
      if (!res.ok) throw new Error(`GitHub API responded ${res.status}`);
      const json: { stargazers_count?: number } = await res.json();
      return typeof json.stargazers_count === "number"
        ? json.stargazers_count
        : null;
    },
  });

  const hasStars = typeof stars === "number";

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={
        hasStars
          ? `GitHub repository, ${stars.toLocaleString("en")} stars`
          : "GitHub repository"
      }
      className={cn("inline-flex items-center gap-1.5", className)}
    >
      <GithubIcon className="size-4" />
      {label ? <span>{label}</span> : null}
      {hasStars ? (
        <span className="text-xs font-normal text-muted-foreground tabular-nums">
          {compact.format(stars)}
        </span>
      ) : null}
    </a>
  );
}
