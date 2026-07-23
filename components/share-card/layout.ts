/**
 * Pure, canvas-free layout helpers for the shareable result cards. Every
 * function here takes measurement as an injected callback so the logic can be
 * unit-tested without a real `CanvasRenderingContext2D` (see the node smoke test
 * in the task report). Keep this module free of DOM and React imports.
 */

/** A width measurement for a piece of text at a given font size, in pixels. */
export type MeasureAtSize = (text: string, size: number) => number;

/** A width measurement for a piece of text at an already-fixed font size. */
export type MeasureFixed = (text: string) => number;

/**
 * Shorten `text` to at most `maxChars` visible characters by dropping the middle
 * and inserting a single ellipsis, keeping the head slightly longer than the
 * tail. Strings already within budget are returned unchanged. Used for long
 * hashes, addresses and symbols where both ends carry meaning.
 */
export function middleEllipsis(text: string, maxChars: number): string {
  if (maxChars <= 0) return "";
  if (text.length <= maxChars) return text;
  if (maxChars === 1) return "…";
  const keep = maxChars - 1; // one slot goes to the ellipsis
  const head = Math.ceil(keep / 2);
  const tail = keep - head;
  const start = text.slice(0, head);
  const end = tail > 0 ? text.slice(text.length - tail) : "";
  return `${start}…${end}`;
}

export interface FitFontSizeOptions {
  text: string;
  maxWidth: number;
  maxSize: number;
  minSize: number;
  /** Pixel decrement per step (default 2). */
  step?: number;
  measure: MeasureAtSize;
}

/**
 * Largest font size in `[minSize, maxSize]` (stepping down by `step`) at which
 * `text` measures within `maxWidth`. Returns `minSize` when even that is too
 * wide, letting the caller decide whether to ellipsize at the floor size.
 */
export function fitFontSize({
  text,
  maxWidth,
  maxSize,
  minSize,
  step = 2,
  measure,
}: FitFontSizeOptions): number {
  let size = maxSize;
  while (size > minSize && measure(text, size) > maxWidth) {
    size -= step;
  }
  return Math.max(minSize, Math.min(size, maxSize));
}

export interface EllipsizeToWidthOptions {
  text: string;
  maxWidth: number;
  /** Measures at the fixed size the caller has already chosen. */
  measure: MeasureFixed;
}

/**
 * Middle-ellipsize `text` down to the most characters that still fit `maxWidth`
 * at a fixed font size. Returns the full string when it already fits, or `"…"`
 * when nothing fits. Binary search keeps this O(log n) measurements.
 */
export function ellipsizeToWidth({
  text,
  maxWidth,
  measure,
}: EllipsizeToWidthOptions): string {
  if (maxWidth <= 0) return "";
  if (measure(text) <= maxWidth) return text;
  let lo = 1;
  let hi = text.length;
  let best = "…";
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const candidate = middleEllipsis(text, mid);
    if (measure(candidate) <= maxWidth) {
      best = candidate;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

export interface FitHeadlineOptions {
  /** Accent-coloured leading part (amount / symbol / name), optional. */
  value?: string;
  /** White trailing part (the verb / remainder), always present. */
  text: string;
  maxWidth: number;
  maxSize: number;
  minSize: number;
  step?: number;
  measure: MeasureAtSize;
}

export interface FittedHeadline {
  /** Chosen font size in px. */
  size: number;
  /** Possibly middle-ellipsized value part (empty string when no value). */
  value: string;
  /** The (unchanged) trailing text. */
  text: string;
}

/**
 * Resolve a two-tone headline to a single line: pick the largest font size at
 * which `value + " " + text` fits, and if it still overflows at the floor size,
 * middle-ellipsize only the `value` part so the verb stays fully readable. This
 * is what protects the card against absurd 60-character token symbols.
 */
export function fitHeadline({
  value,
  text,
  maxWidth,
  maxSize,
  minSize,
  step = 2,
  measure,
}: FitHeadlineOptions): FittedHeadline {
  const hasValue = value !== undefined && value.length > 0;
  const combined = hasValue ? `${value} ${text}` : text;
  const size = fitFontSize({
    text: combined,
    maxWidth,
    maxSize,
    minSize,
    step,
    measure,
  });

  if (measure(combined, size) <= maxWidth) {
    return { size, value: hasValue ? (value as string) : "", text };
  }

  // Still overflowing at the floor size. Keep the verb intact and shrink the
  // value to whatever room remains after the trailing " text".
  if (hasValue) {
    const trailing = ` ${text}`;
    const trailingWidth = measure(trailing, size);
    const room = maxWidth - trailingWidth;
    const fittedValue = ellipsizeToWidth({
      text: value as string,
      maxWidth: room,
      measure: (t) => measure(t, size),
    });
    return { size, value: fittedValue, text };
  }

  // No value: ellipsize the verb itself as a last resort.
  const fittedText = ellipsizeToWidth({
    text,
    maxWidth,
    measure: (t) => measure(t, size),
  });
  return { size, value: "", text: fittedText };
}

export interface FitLineOptions {
  text: string;
  maxWidth: number;
  maxSize: number;
  minSize: number;
  step?: number;
  measure: MeasureAtSize;
}

export interface FittedLine {
  size: number;
  text: string;
}

/**
 * Fit a single-tone line (subline / detail): shrink to fit, then middle-
 * ellipsize at the floor size if it is still too wide.
 */
export function fitLine({
  text,
  maxWidth,
  maxSize,
  minSize,
  step = 2,
  measure,
}: FitLineOptions): FittedLine {
  const size = fitFontSize({ text, maxWidth, maxSize, minSize, step, measure });
  if (measure(text, size) <= maxWidth) return { size, text };
  const fitted = ellipsizeToWidth({
    text,
    maxWidth,
    measure: (t) => measure(t, size),
  });
  return { size, text: fitted };
}
