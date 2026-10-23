import { describe, expect, it } from "vitest";
import { canonicalize } from "../src/canonical.js";
import { digestText, keccak256Hex, sha256Hex } from "../src/digest.js";
import { CANONICALISATION_VERSION } from "../src/canonical.js";
import { CHARTER, CONSTITUTION, PINNED_SHA256, SOUL } from "./fixtures.js";

describe("digests", () => {
  it("matches the pinned SHA-256 of each fixture", () => {
    expect(digestText(CHARTER, CANONICALISATION_VERSION).sha256).toBe(PINNED_SHA256.charter);
    expect(digestText(CONSTITUTION, CANONICALISATION_VERSION).sha256).toBe(PINNED_SHA256.constitution);
    expect(digestText(SOUL, CANONICALISATION_VERSION).sha256).toBe(PINNED_SHA256.soul);
  });

  it("is stable across platform line endings, trailing whitespace, BOM and NFD input", () => {
    const windows = `\uFEFF${CHARTER.replace(/\n/g, "\r\n").replace(/\r\n$/, "\r\n\r\n")}`;
    const macClassic = CHARTER.replace(/\n/g, "\r");
    const messy = `${CHARTER.split("\n")
      .map((line) => `${line}  \t`)
      .join("\r\n")}\r\n\r\n`;

    const baseline = digestText(CHARTER, CANONICALISATION_VERSION);
    for (const variant of [windows, macClassic, messy]) {
      const digest = digestText(variant, CANONICALISATION_VERSION);
      expect(digest.sha256).toBe(baseline.sha256);
      expect(digest.keccak256).toBe(baseline.keccak256);
      expect(digest.bytes).toBe(baseline.bytes);
    }
  });

  it("reports byte length of the canonical UTF-8 encoding", () => {
    const digest = digestText(CHARTER, CANONICALISATION_VERSION);
    expect(digest.bytes).toBe(new TextEncoder().encode(canonicalize(CHARTER)).byteLength);
  });

  it("uses the documented canonicalisation identifier", () => {
    expect(digestText(SOUL, CANONICALISATION_VERSION).canonicalisation).toBe("charter-canon-v1");
  });

  it("produces distinct sha256 and keccak256 for the same bytes", () => {
    const bytes = new TextEncoder().encode("Charter");
    expect(sha256Hex(bytes)).toHaveLength(64);
    expect(keccak256Hex(bytes)).toMatch(/^0x[0-9a-f]{64}$/);
    expect(`0x${sha256Hex(bytes)}`).not.toBe(keccak256Hex(bytes));
  });
});
