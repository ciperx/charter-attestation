import { describe, expect, it } from "vitest";
import { canonicalize, canonicalizeBytes } from "../src/canonical.js";

const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

describe("canonicalize", () => {
  it("applies Unicode NFC so composed and decomposed text agree", () => {
    const composed = "Caf\u00e9 Charter";
    const decomposed = "Cafe\u0301 Charter";
    expect(composed).not.toBe(decomposed);
    expect(canonicalize(decomposed)).toBe(canonicalize(composed));
    expect(decode(canonicalizeBytes(decomposed))).toBe(decode(canonicalizeBytes(composed)));
  });

  it("turns CRLF and lone CR into LF", () => {
    const lf = "one\ntwo\nthree\n";
    expect(canonicalize("one\r\ntwo\r\nthree\r\n")).toBe(lf);
    expect(canonicalize("one\rtwo\rthree\r")).toBe(lf);
  });

  it("strips trailing spaces and tabs on every line", () => {
    expect(canonicalize("one   \ntwo\t\t\nthree \t \n")).toBe("one\ntwo\nthree\n");
  });

  it("strips a leading BOM", () => {
    expect(canonicalize("\uFEFFCharter\n")).toBe("Charter\n");
  });

  it("collapses trailing blank lines to exactly one LF", () => {
    expect(canonicalize("Charter\n\n\n\n")).toBe("Charter\n");
    expect(canonicalize("Charter")).toBe("Charter\n");
    expect(canonicalize("Charter\r\n\r\n")).toBe("Charter\n");
  });

  it("preserves internal blank lines and indentation", () => {
    expect(canonicalize("A\n\n  indented\nB\n")).toBe("A\n\n  indented\nB\n");
  });

  it("canonicalises an empty or whitespace-only document to the empty string", () => {
    expect(canonicalize("")).toBe("");
    expect(canonicalize("\n\n\n")).toBe("");
    expect(canonicalize("  \t\n \n")).toBe("");
  });

  it("is idempotent", () => {
    const once = canonicalize("Caf\u00e9 \r\n\r\nsecond line\t\r\n");
    expect(canonicalize(once)).toBe(once);
  });

  it("rejects non-string input", () => {
    // @ts-expect-error runtime guard for JavaScript callers
    expect(() => canonicalize(42)).toThrow(TypeError);
  });
});
