/**
 * Canonicalisation of the three founding texts.
 *
 * The digest is only meaningful if every party hashes byte-identical input, so the
 * normalisation below is deliberately small, explicit, and lossless for prose:
 *
 *   1. The input must be a string; a leading UTF-8 BOM (U+FEFF) is removed.
 *   2. Unicode normal form NFC is applied to the whole document.
 *   3. CRLF (U+000D U+000A) and lone CR (U+000D) become LF (U+000A).
 *   4. Trailing horizontal whitespace (spaces and tabs) is removed from every line.
 *   5. Trailing blank lines are removed, and a non-empty document ends with exactly
 *      one LF. An empty document canonicalises to the empty string.
 *
 * Nothing else is touched: case, internal indentation, internal blank lines and
 * punctuation are preserved. In particular this is NOT a Markdown canonicaliser;
 * the same bytes are hashed by every platform, editor and CI runner.
 */
export const CANONICALISATION_VERSION = "charter-canon-v1";

/** Human readable description of the normalisation, embedded in output metadata. */
export const CANONICALISATION_RULES: readonly string[] = [
  "strip a leading UTF-8 BOM",
  "Unicode NFC",
  "CRLF and lone CR to LF",
  "strip trailing spaces and tabs on every line",
  "strip trailing blank lines, end a non-empty document with exactly one LF",
];

const BOM = "\uFEFF";

/** Canonicalise one document according to {@link CANONICALISATION_VERSION}. */
export function canonicalize(text: string): string {
  if (typeof text !== "string") {
    throw new TypeError("canonicalize expects a string");
  }

  let out = text.startsWith(BOM) ? text.slice(BOM.length) : text;
  out = out.normalize("NFC");
  out = out.replace(/\r\n?/g, "\n");
  out = out
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n");
  out = out.replace(/\n+$/, "");
  return out.length === 0 ? "" : `${out}\n`;
}

/** Canonical UTF-8 bytes of one document. This is what gets hashed and attested. */
export function canonicalizeBytes(text: string): Uint8Array {
  return new TextEncoder().encode(canonicalize(text));
}
