"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Copy,
  Download,
  ImageDown,
  Loader2,
  Share2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

import type { ShareCardContent } from "./content";
import { renderShareCard } from "./render";

interface ShareResultProps {
  /** What the card should say. Must never contain secrets (e.g. private keys). */
  content: ShareCardContent;
  /** Download / share filename, e.g. "robins-burn.png". */
  filename: string;
  /** Native-share sheet title. */
  title?: string;
  /** Native-share sheet body text. */
  shareText?: string;
  className?: string;
}

type RenderStatus = "idle" | "ready" | "error";

/**
 * Collapsible "Share this result" section for tool success screens. On first
 * expand it renders the branded PNG once, shows a preview, and offers copy /
 * download / native-share, each feature-detected so unsupported actions are
 * simply hidden. Object URLs are revoked to avoid leaks, and any render failure
 * degrades to a toast instead of taking down the success screen.
 */
export function ShareResult({
  content,
  filename,
  title = "robins.tools",
  shareText,
  className,
}: ShareResultProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<RenderStatus>("idle");
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);

  // Serialize the content so the render effect re-runs only on real changes.
  const contentKey = useMemo(() => JSON.stringify(content), [content]);

  // The latest blob, kept in a ref so action handlers stay stable and Safari's
  // clipboard write happens synchronously within the click.
  const blobRef = useRef<Blob | null>(null);

  // Clipboard image support is browser-only. Computed once in a lazy initializer
  // (false during SSR); it is only ever read inside the ready state, which never
  // renders on the server, so there is no hydration mismatch.
  const [supportsCopy] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof ClipboardItem !== "undefined" &&
      !!navigator.clipboard?.write,
  );

  // Revoke the previous object URL whenever it changes or the section unmounts.
  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  // Render lazily on first expand, and re-render if the content changes while
  // open. Status is only ever updated from the async callbacks below (never
  // synchronously here), so the "idle" state drives the loading spinner until a
  // blob resolves; a stale preview stays visible during a re-render.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    renderShareCard(content)
      .then((blob) => {
        if (cancelled) return;
        blobRef.current = blob;
        setObjectUrl(URL.createObjectURL(blob));
        setStatus("ready");
        try {
          const file = new File([blob], filename, { type: "image/png" });
          setCanShare(
            typeof navigator !== "undefined" &&
              !!navigator.canShare &&
              !!navigator.share &&
              navigator.canShare({ files: [file] }),
          );
        } catch {
          setCanShare(false);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        blobRef.current = null;
        setStatus("error");
        toast.error("Couldn't create the share image", {
          description: err instanceof Error ? err.message : undefined,
        });
      });
    return () => {
      cancelled = true;
    };
    // contentKey stands in for `content`; filename change alone shouldn't re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contentKey]);

  async function handleCopy() {
    const blob = blobRef.current;
    if (!blob) return;
    try {
      // Pass a promise of the blob so Safari accepts the write inside the gesture.
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": Promise.resolve(blob) }),
      ]);
      toast.success("Image copied to clipboard");
    } catch {
      toast.error("Couldn't copy the image");
    }
  }

  function handleDownload() {
    if (!objectUrl) return;
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // objectUrl stays valid for the preview; it is revoked on change/unmount.
  }

  async function handleShare() {
    const blob = blobRef.current;
    if (!blob) return;
    const file = new File([blob], filename, { type: "image/png" });
    if (!navigator.canShare?.({ files: [file] })) {
      toast.error("Sharing isn't supported on this device");
      return;
    }
    try {
      await navigator.share({ files: [file], title, text: shareText });
    } catch (err) {
      // The user dismissing the sheet throws AbortError; that isn't a failure.
      if (err instanceof Error && err.name === "AbortError") return;
      toast.error("Couldn't open the share sheet");
    }
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn(
        "rounded-xl border border-border bg-muted/20",
        className,
      )}
    >
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-auto w-full justify-between px-4 py-3 text-sm font-medium"
        >
          <span className="flex items-center gap-2">
            <ImageDown className="size-4 text-accent-text" />
            Share this result
          </span>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="px-4 pb-4">
        <div className="space-y-3">
          <div className="flex min-h-[180px] items-center justify-center overflow-hidden rounded-lg border border-border bg-background/40">
            {status === "ready" && objectUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={objectUrl}
                alt="Shareable result card preview"
                className="h-auto w-full max-w-[480px]"
              />
            ) : status === "error" ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                The image couldn&apos;t be generated. Your result is still safe
                above.
              </p>
            ) : (
              <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Rendering card…
              </div>
            )}
          </div>

          {status === "ready" ? (
            <div className="flex flex-wrap gap-2">
              {supportsCopy ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                >
                  <Copy />
                  Copy image
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownload}
              >
                <Download />
                Download PNG
              </Button>
              {canShare ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleShare}
                >
                  <Share2 />
                  Share
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
