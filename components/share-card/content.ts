/**
 * The tool-agnostic description of one shareable result card. Tool components
 * build this object from their success state; the renderer turns it into a PNG.
 * Nothing sensitive belongs here: never place a private key, seed phrase or any
 * secret in any field.
 */

/** Tone for the subline text: neutral gray, or the lime accent (e.g. a found address). */
export type SublineTone = "muted" | "accent";

export interface ShareSubline {
  text: string;
  /** Defaults to "muted". Use "accent" only for information, never decoration. */
  tone?: SublineTone;
  /** Render in the monospace family (addresses, roots, hashes). */
  mono?: boolean;
}

export interface ShareHeadline {
  /**
   * The accent-coloured leading part (amount, symbol, token name). Omit for a
   * headline that is entirely white, e.g. "Vanity address found".
   */
  value?: string;
  /** The white trailing part (the verb / remainder), always present. */
  text: string;
}

export interface ShareCardContent {
  /** Small gray label under the wordmark, e.g. "Token burner". */
  tool: string;
  headline: ShareHeadline;
  subline?: ShareSubline;
  /** Optional mono detail bottom-left, typically a truncated tx hash. */
  detail?: string;
}
