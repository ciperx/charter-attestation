import { encodeAttestationData, SCHEMA, SCHEMA_FIELDS, schemaUid } from "./schema.js";
import type { Hex } from "viem";
import { CANONICALISATION_VERSION } from "./canonical.js";
import { digestText, keccak256Hex, type TextDigest } from "./digest.js";

export interface CharterTexts {
  /** The Founding Charter, as UTF-8 text. */
  charter: string;
  /** The Constitution, as UTF-8 text. */
  constitution: string;
  /** The SOUL text, as UTF-8 text. */
  soul: string;
}

export interface CharterCids {
  /** IPFS CID of the published Charter. */
  charter: string;
  /** IPFS CID of the published Constitution. */
  constitution: string;
  /** IPFS CID of the published SOUL text. */
  soul: string;
}

export interface BuildAttestationInput {
  texts: CharterTexts;
  cids: CharterCids;
  /** Human readable charter version, e.g. "1.0.0". Part of the attested payload. */
  version: string;
  /** Unix seconds (number), ISO-8601 string, or Date. Floored to whole seconds. */
  date: number | string | Date;
}

export interface AttestationPayload {
  /** The EAS schema string. Stable across releases. */
  schema: typeof SCHEMA;
  /** ABI-encoded EAS `data` field. */
  data: Hex;
  digests: {
    charter: TextDigest;
    constitution: TextDigest;
    soul: TextDigest;
    /** keccak256 over the ABI-encoded payload, for quick equality checks. */
    payload: { keccak256: Hex };
  };
  /** EAS schema UID for the default (zero resolver, revocable) registration. */
  schemaUid: Hex;
}

function requireNonEmpty(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value;
}

/** Normalise the date input to whole Unix seconds. */
export function toUnixSeconds(date: number | string | Date): bigint {
  if (date instanceof Date) {
    if (Number.isNaN(date.getTime())) throw new TypeError("date is an invalid Date");
    return BigInt(Math.floor(date.getTime() / 1000));
  }
  if (typeof date === "number") {
    if (!Number.isFinite(date) || !Number.isInteger(date) || date < 0) {
      throw new TypeError("date must be a non-negative integer of Unix seconds");
    }
    return BigInt(date);
  }
  if (typeof date === "string") {
    if (/^\d+$/.test(date.trim())) return BigInt(date.trim());
    const parsed = Date.parse(date);
    if (Number.isNaN(parsed)) throw new TypeError(`date is not ISO-8601 or Unix seconds: ${date}`);
    return BigInt(Math.floor(parsed / 1000));
  }
  throw new TypeError("date must be a number, ISO-8601 string, or Date");
}

/**
 * Build the one EAS attestation payload for a One Charter release.
 *
 * `schema` and `data` are ready to hand to `EAS.attest({ schema, data })`; `digests`
 * exposes the canonical SHA-256 (acceptance hash) and keccak256 of every text.
 */
export function buildAttestation(input: BuildAttestationInput): AttestationPayload {
  const { texts, cids, version, date } = input;
  if (!texts || typeof texts !== "object") throw new TypeError("texts is required");
  if (!cids || typeof cids !== "object") throw new TypeError("cids is required");
  requireNonEmpty(version, "version");
  requireNonEmpty(cids.charter, "cids.charter");
  requireNonEmpty(cids.constitution, "cids.constitution");
  requireNonEmpty(cids.soul, "cids.soul");

  const charter = digestText(requireNonEmpty(texts.charter, "texts.charter"), CANONICALISATION_VERSION);
  const constitution = digestText(
    requireNonEmpty(texts.constitution, "texts.constitution"),
    CANONICALISATION_VERSION,
  );
  const soul = digestText(requireNonEmpty(texts.soul, "texts.soul"), CANONICALISATION_VERSION);

  const data = encodeAttestationData({
    charterDigest: charter.keccak256,
    constitutionDigest: constitution.keccak256,
    soulDigest: soul.keccak256,
    charterCid: cids.charter,
    constitutionCid: cids.constitution,
    soulCid: cids.soul,
    version: version.trim(),
    date: toUnixSeconds(date),
  });

  return {
    schema: SCHEMA,
    data,
    digests: {
      charter,
      constitution,
      soul,
      payload: { keccak256: keccak256Hex(Buffer.from(data.slice(2), "hex")) },
    },
    schemaUid: schemaUid(),
  };
}

export { SCHEMA_FIELDS };
