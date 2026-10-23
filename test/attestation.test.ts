import { describe, expect, it } from "vitest";
import { decodeAbiParameters, keccak256 } from "viem";
import { buildAttestation, toUnixSeconds } from "../src/attestation.js";
import { SCHEMA, SCHEMA_FIELDS, schemaUid, ZERO_ADDRESS } from "../src/schema.js";
import { CANONICALISATION_VERSION, canonicalize } from "../src/canonical.js";
import { CIDS, CHARTER, CONSTITUTION, DATE, PINNED_SHA256, SOUL, VERSION } from "./fixtures.js";

const build = (overrides: Partial<Parameters<typeof buildAttestation>[0]> = {}) =>
  buildAttestation({
    texts: { charter: CHARTER, constitution: CONSTITUTION, soul: SOUL },
    cids: { ...CIDS },
    version: VERSION,
    date: DATE,
    ...overrides,
  });

describe("buildAttestation", () => {
  it("returns exactly schema, data, digests plus the derived schemaUid", () => {
    expect(Object.keys(build()).sort()).toEqual(["data", "digests", "schema", "schemaUid"]);
  });

  it("reports SHA-256 digests that match the canonical texts", () => {
    const { digests } = build();
    expect(digests.charter.sha256).toBe(PINNED_SHA256.charter);
    expect(digests.constitution.sha256).toBe(PINNED_SHA256.constitution);
    expect(digests.soul.sha256).toBe(PINNED_SHA256.soul);
    expect(digests.charter.canonicalisation).toBe(CANONICALISATION_VERSION);
  });

  it("keeps the schema string byte-for-byte stable", () => {
    expect(build().schema).toBe(SCHEMA);
    expect(SCHEMA).toBe(
      "bytes32 charterDigest,bytes32 constitutionDigest,bytes32 soulDigest,string charterCid,string constitutionCid,string soulCid,string version,uint64 date",
    );
  });

  it("computes the EAS schema UID over the packed schema string", () => {
    const packed = `0x${Buffer.from(`${SCHEMA}${ZERO_ADDRESS.slice(2)}01`, "utf8").toString("hex")}`;
    expect(schemaUid()).toBe(keccak256(packed as `0x${string}`));
    expect(schemaUid()).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("ABI-encodes data that decodes back to the attested values", () => {
    const payload = build();
    const [charter, constitution, soul, charterCid, constitutionCid, soulCid, version, date] =
      decodeAbiParameters(SCHEMA_FIELDS, payload.data);
    expect(charter).toBe(payload.digests.charter.keccak256);
    expect(constitution).toBe(payload.digests.constitution.keccak256);
    expect(soul).toBe(payload.digests.soul.keccak256);
    expect(charterCid).toBe(CIDS.charter);
    expect(constitutionCid).toBe(CIDS.constitution);
    expect(soulCid).toBe(CIDS.soul);
    expect(version).toBe(VERSION);
    expect(date).toBe(BigInt(DATE));
  });

  it("changes the digest and the payload when any text changes", () => {
    const base = build();
    const variants = [
      { charter: `${CHARTER}Article 3. A new clause.\n` },
      { constitution: `${CONSTITUTION}Section 2. A new clause.\n` },
      { soul: `${SOUL}A new line.\n` },
    ];
    for (const variant of variants) {
      const changed = build({
        texts: { charter: CHARTER, constitution: CONSTITUTION, soul: SOUL, ...variant },
      });
      const key = Object.keys(variant)[0] as "charter" | "constitution" | "soul";
      expect(changed.digests[key].sha256).not.toBe(base.digests[key].sha256);
      expect(changed.digests[key].keccak256).not.toBe(base.digests[key].keccak256);
      expect(changed.data).not.toBe(base.data);
      expect(changed.digests.payload.keccak256).not.toBe(base.digests.payload.keccak256);
    }
  });

  it("changes the payload when a CID, the version or the date changes", () => {
    const base = build();
    expect(build({ cids: { ...CIDS, soul: `${CIDS.soul}x` } }).data).not.toBe(base.data);
    expect(build({ version: "1.0.1" }).data).not.toBe(base.data);
    expect(build({ date: DATE + 1 }).data).not.toBe(base.data);
  });

  it("is deterministic for identical input", () => {
    expect(build()).toEqual(build());
  });

  it("treats equivalent whitespace and line endings as the same text", () => {
    const base = build();
    const crlf = build({
      texts: {
        charter: CHARTER.replace(/\n/g, "\r\n").replace(/\r\n$/, "\r\n\r\n"),
        constitution: CONSTITUTION,
        soul: SOUL,
      },
    });
    expect(crlf.digests.charter.sha256).toBe(base.digests.charter.sha256);
    expect(crlf.data).toBe(base.data);
    expect(canonicalize(CHARTER)).toBe(CHARTER);
  });

  it("accepts Date, ISO-8601 and Unix seconds for the date", () => {
    const iso = new Date(DATE * 1000).toISOString();
    expect(toUnixSeconds(DATE)).toBe(BigInt(DATE));
    expect(toUnixSeconds(iso)).toBe(BigInt(DATE));
    expect(toUnixSeconds(new Date(DATE * 1000))).toBe(BigInt(DATE));
    expect(build({ date: iso }).data).toBe(build().data);
  });

  it("rejects invalid input", () => {
    expect(() => build({ version: "  " })).toThrow(TypeError);
    expect(() => build({ cids: { ...CIDS, charter: "" } })).toThrow(TypeError);
    expect(() => build({ texts: { charter: "", constitution: CONSTITUTION, soul: SOUL } })).toThrow(
      TypeError,
    );
    expect(() => build({ date: -1 })).toThrow(TypeError);
    expect(() => build({ date: "not a date" })).toThrow(TypeError);
  });
});
