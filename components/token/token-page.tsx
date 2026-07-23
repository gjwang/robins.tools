import { ExternalLink, ShieldAlert } from "lucide-react";

import { CopyButton } from "@/components/copy-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { tokenUrl } from "@/lib/explorer";

/**
 * The $TOOLS token page. Two states, driven entirely by whether a valid
 * contract address is configured:
 *  - `address === null` (default): a "launching soon" surface that explains the
 *    address will be published here, plus a scam warning.
 *  - a valid address: the contract address with a copy button, an explorer link,
 *    and a shorter safety line.
 * Nothing beyond "community token" and the published address is claimed.
 */
export function TokenPage({ address }: { address: string | null }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="flex flex-col items-start gap-4">
        <h1 className="font-heading text-6xl font-semibold tracking-tight sm:text-7xl">
          <span className="text-accent-text">$</span>TOOLS
        </h1>
        <p className="text-lg text-muted-foreground text-pretty">
          The community token of robins.tools.
        </p>
      </div>

      <div className="mt-12 rounded-2xl bg-card p-6 ring-1 ring-foreground/10 sm:mt-14 sm:p-8">
        {address ? (
          <>
            <h2 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
              Official contract address
            </h2>
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3">
              <code className="min-w-0 flex-1 font-mono text-sm break-all">
                {address}
              </code>
              <CopyButton
                value={address}
                label="Copy contract address"
                className="shrink-0"
              />
            </div>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <a
                href={tokenUrl(address)}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on Blockscout
                <ExternalLink />
              </a>
            </Button>
            <p className="mt-6 text-sm leading-relaxed text-muted-foreground text-pretty">
              Only this address, published here, is the official $TOOLS token.
              Any other token that uses the name is not official.
            </p>
          </>
        ) : (
          <>
            <Badge>Launching soon</Badge>
            <h2 className="mt-4 font-heading text-xl font-semibold tracking-tight sm:text-2xl">
              The contract address is not live yet
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
              When $TOOLS launches, its contract address will be published here
              on this page. That address is the only way to identify the
              official token.
            </p>

            <Alert variant="destructive" className="mt-6 border-destructive/30">
              <ShieldAlert />
              <AlertTitle>Watch for scam tokens</AlertTitle>
              <AlertDescription>
                Until the address appears on this page, any token claiming to be
                $TOOLS is not official. Treat it as a scam.
              </AlertDescription>
            </Alert>
          </>
        )}
      </div>
    </div>
  );
}
