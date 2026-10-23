import { createHash } from "node:crypto";
import { keccak256 } from "viem";
import { canonicalizeBytes } from "./canonical.js";

/** SHA-256 (hex, no 0x prefix) of the canonical UTF-8 bytes. */
export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** keccak256 (0x-prefixed) of the canonical UTF-8 bytes. */
export function keccak256Hex(bytes: Uint8Array): `0x${string}` {
  return keccak256(bytes);
}

export interface TextDigest {
  /** SHA-256 of the canonical UTF-8 bytes, hex without a 0x prefix. */
  sha256: string;
  /** keccak256 of the same bytes, 0x-prefixed. */
  keccak256: `0x${string}`;
  /** Length in bytes of the canonical UTF-8 encoding. */
  bytes: number;
  /** Canonicalisation ruleset identifier. */
  canonicalisation: string;
}

/** Digest one document's canonical bytes with both hash functions. */
export function digestText(text: string, canonicalisation: string): TextDigest {
  const bytes = canonicalizeBytes(text);
  return {
    sha256: sha256Hex(bytes),
    keccak256: keccak256Hex(bytes),
    bytes: bytes.byteLength,
    canonicalisation,
  };
}
