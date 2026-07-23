/**
 * Client-only canvas renderer for the shareable result cards. Produces a
 * branded 1200x630 PNG (drawn at 2x for crisp text) with zero network access
 * beyond the same-origin `/logo.png`. Fonts are resolved from the live document
 * and awaited before any text is drawn, so a card never ships with the wrong
 * typeface unless the real fonts genuinely failed to load.
 */

import type { ShareCardContent } from "./content";
import { fitHeadline, fitLine } from "./layout";

const WIDTH = 1200;
const HEIGHT = 630;
const SCALE = 2;
const MARGIN = 72;

// Fixed brand palette, independent of the app's light/dark theme.
const INK = "#0E0B09";
const LIME = "#CFFF00";
const WHITE = "#FFFFFF";
const GRAY = "#A8A199";
const DIM = "#736C63";
const HAIRLINE = "rgba(255, 255, 255, 0.08)";

interface Families {
  sans: string;
  mono: string;
}

/** A width measurement bound to a family + weight; size varies per call. */
type Measure = (text: string, size: number) => number;

function resolveFamilies(): Families {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { sans: "sans-serif", mono: "monospace" };
  }
  const root = getComputedStyle(document.documentElement);
  const bodyFamily = getComputedStyle(document.body).fontFamily.trim();
  const sansVar = root.getPropertyValue("--font-geist-sans").trim();
  const monoVar = root.getPropertyValue("--font-geist-mono").trim();
  const sans = bodyFamily || sansVar || "sans-serif";
  const mono = monoVar || "monospace";
  return { sans, mono };
}

// Memoize font loading per resolved family pair so repeated renders are cheap.
const fontReadyCache = new Map<string, Promise<void>>();

async function ensureFonts(families: Families): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  const key = `${families.sans}||${families.mono}`;
  const cached = fontReadyCache.get(key);
  if (cached) return cached;

  const specs = [
    `700 64px ${families.sans}`,
    `600 30px ${families.sans}`,
    `500 24px ${families.sans}`,
    `400 24px ${families.sans}`,
    `500 24px ${families.mono}`,
    `400 22px ${families.mono}`,
  ];

  const promise = (async () => {
    await Promise.all(
      specs.map((spec) =>
        document.fonts.load(spec).catch(() => undefined),
      ),
    );
    try {
      await document.fonts.ready;
    } catch {
      // FontFaceSet.ready can reject on some engines; the loads above are enough.
    }
  })();

  fontReadyCache.set(key, promise);
  return promise;
}

// Memoize the logo image; it never changes within a session.
let logoPromise: Promise<HTMLImageElement | null> | null = null;

function loadLogo(): Promise<HTMLImageElement | null> {
  if (logoPromise) return logoPromise;
  logoPromise = new Promise((resolve) => {
    if (typeof Image === "undefined") {
      resolve(null);
      return;
    }
    const img = new Image();
    // Same-origin asset: no crossOrigin needed, and the canvas stays untainted.
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = "/logo.png";
  });
  return logoPromise;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const radius = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function makeMeasure(
  ctx: CanvasRenderingContext2D,
  family: string,
  weight: number,
): Measure {
  return (text, size) => {
    ctx.font = `${weight} ${size}px ${family}`;
    return ctx.measureText(text).width;
  };
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Canvas produced no image.")),
      "image/png",
    );
  });
}

/**
 * Render `content` to a PNG Blob. Rejects if a 2D context or the PNG export is
 * unavailable; the caller surfaces that as a toast rather than crashing the
 * success screen.
 */
export async function renderShareCard(
  content: ShareCardContent,
): Promise<Blob> {
  if (typeof document === "undefined") {
    throw new Error("Share cards can only be rendered in the browser.");
  }

  const families = resolveFamilies();
  // Load fonts and the logo before drawing a single glyph.
  const [logo] = await Promise.all([loadLogo(), ensureFonts(families)]);

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * SCALE;
  canvas.height = HEIGHT * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get a 2D canvas context.");

  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = "alphabetic";

  // Background.
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // --- Header: logo tile + wordmark + tool label ------------------------
  const tileSize = 88;
  const tileX = MARGIN;
  const tileY = 60;
  const tileRadius = 20;

  ctx.save();
  roundRectPath(ctx, tileX, tileY, tileSize, tileSize, tileRadius);
  if (logo) {
    ctx.clip();
    ctx.drawImage(logo, tileX, tileY, tileSize, tileSize);
  } else {
    // Font/logo may fail independently; a lime tile keeps the brand intact.
    ctx.fillStyle = LIME;
    ctx.fill();
  }
  ctx.restore();

  const textX = tileX + tileSize + 22;

  // Wordmark "robins.tools" — "robins" white, ".tools" gray.
  ctx.textBaseline = "alphabetic";
  ctx.font = `600 30px ${families.sans}`;
  const brandPrefix = "robins";
  const brandSuffix = ".tools";
  const wordmarkY = tileY + 38;
  const prefixWidth = ctx.measureText(brandPrefix).width;
  ctx.fillStyle = WHITE;
  ctx.fillText(brandPrefix, textX, wordmarkY);
  ctx.fillStyle = GRAY;
  ctx.fillText(brandSuffix, textX + prefixWidth, wordmarkY);

  // Tool label.
  ctx.font = `500 21px ${families.sans}`;
  ctx.fillStyle = GRAY;
  ctx.fillText(content.tool, textX, tileY + 74);

  // Hairline under the header.
  ctx.strokeStyle = HAIRLINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(MARGIN, 178);
  ctx.lineTo(WIDTH - MARGIN, 178);
  ctx.stroke();

  const contentWidth = WIDTH - MARGIN * 2;

  // --- Headline (two-tone, shrink-to-fit) -------------------------------
  const measureHeadline = makeMeasure(ctx, families.sans, 700);
  const headline = fitHeadline({
    value: content.headline.value,
    text: content.headline.text,
    maxWidth: contentWidth,
    maxSize: 84,
    minSize: 40,
    measure: measureHeadline,
  });

  ctx.font = `700 ${headline.size}px ${families.sans}`;
  ctx.textBaseline = "middle";
  const hasValue = headline.value.length > 0;
  const spacer = hasValue ? " " : "";
  const valueWidth = hasValue ? ctx.measureText(headline.value).width : 0;
  const spacerWidth = hasValue ? ctx.measureText(spacer).width : 0;
  const verbWidth = ctx.measureText(headline.text).width;
  const totalWidth = valueWidth + spacerWidth + verbWidth;

  const hasSubline = !!content.subline && content.subline.text.length > 0;
  const headlineCenterY = hasSubline ? 318 : 340;

  let cursorX = (WIDTH - totalWidth) / 2;
  if (hasValue) {
    ctx.fillStyle = LIME;
    ctx.fillText(headline.value, cursorX, headlineCenterY);
    cursorX += valueWidth + spacerWidth;
  }
  ctx.fillStyle = WHITE;
  ctx.fillText(headline.text, cursorX, headlineCenterY);

  // --- Subline ----------------------------------------------------------
  if (hasSubline && content.subline) {
    const family = content.subline.mono ? families.mono : families.sans;
    const measureSub = makeMeasure(ctx, family, 500);
    const sub = fitLine({
      text: content.subline.text,
      maxWidth: contentWidth,
      maxSize: 32,
      minSize: 22,
      measure: measureSub,
    });
    ctx.font = `500 ${sub.size}px ${family}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillStyle = content.subline.tone === "accent" ? LIME : GRAY;
    const sublineCenterY =
      headlineCenterY + headline.size / 2 + sub.size / 2 + 24;
    ctx.fillText(sub.text, WIDTH / 2, sublineCenterY);
    ctx.textAlign = "left";
  }

  // --- Footer -----------------------------------------------------------
  ctx.textBaseline = "alphabetic";
  const footerBaseline = HEIGHT - MARGIN;

  // Bottom-left: optional mono detail, then the chain label beneath it.
  if (content.detail) {
    ctx.font = `500 22px ${families.mono}`;
    ctx.fillStyle = DIM;
    ctx.fillText(content.detail, MARGIN, footerBaseline - 30);
  }
  ctx.font = `500 21px ${families.sans}`;
  ctx.fillStyle = GRAY;
  ctx.fillText("Robinhood Chain", MARGIN, footerBaseline);

  // Bottom-right: muted wordmark echo, right-aligned.
  ctx.font = `500 22px ${families.sans}`;
  const fPrefixWidth = ctx.measureText(brandPrefix).width;
  const fSuffixWidth = ctx.measureText(brandSuffix).width;
  const footerStartX = WIDTH - MARGIN - fPrefixWidth - fSuffixWidth;
  ctx.fillStyle = GRAY;
  ctx.fillText(brandPrefix, footerStartX, footerBaseline);
  ctx.fillStyle = DIM;
  ctx.fillText(brandSuffix, footerStartX + fPrefixWidth, footerBaseline);

  return canvasToBlob(canvas);
}
