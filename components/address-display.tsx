import { ExternalLink } from "lucide-react";

import { CopyButton } from "@/components/copy-button";
import { addressUrl } from "@/lib/explorer";
import { truncateAddress } from "@/lib/format";
import { cn } from "@/lib/utils";

interface AddressDisplayProps {
  address: string;
  /** Hex characters kept on each side of the ellipsis (default 4). */
  chars?: number;
  /** Show the copy button (default true). */
  copyable?: boolean;
  /** Link out to the block explorer (default true). */
  explorer?: boolean;
  className?: string;
}

export function AddressDisplay({
  address,
  chars = 4,
  copyable = true,
  explorer = true,
  className,
}: AddressDisplayProps) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className="font-mono text-sm">
        {truncateAddress(address, chars)}
      </span>
      {copyable ? <CopyButton value={address} label="Copy address" /> : null}
      {explorer ? (
        <a
          href={addressUrl(address)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground transition-colors hover:text-foreground"
          aria-label="View on explorer"
        >
          <ExternalLink className="size-3.5" />
        </a>
      ) : null}
    </span>
  );
}
