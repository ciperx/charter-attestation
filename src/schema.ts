import { encodeAbiParameters, keccak256, type AbiParameter } from "viem";
import type { Hex } from "viem";

/**
 * The single EAS schema used for a One Charter attestation.
 *
 * Schema string is a protocol-level constant: it must never change between releases,
 * otherwise every previously issued attestation becomes unreadable under the new
 * schema. New information belongs in a new schema (and a new version), not here.
 */
export const SCHEMA =
  "bytes32 charterDigest,bytes32 constitutionDigest,bytes32 soulDigest,string charterCid,string constitutionCid,string soulCid,string version,uint64 date";

/** ABI field list, derived from {@link SCHEMA}. */
export const SCHEMA_FIELDS: readonly AbiParameter[] = [
  { name: "charterDigest", type: "bytes32" },
  { name: "constitutionDigest", type: "bytes32" },
  { name: "soulDigest", type: "bytes32" },
  { name: "charterCid", type: "string" },
  { name: "constitutionCid", type: "string" },
  { name: "soulCid", type: "string" },
  { name: "version", type: "string" },
  { name: "date", type: "uint64" },
];

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

/**
 * EAS schema UID as computed by the SchemaRegistry:
 * keccak256(abi.encodePacked(schema, resolver, revocable)).
 *
 * The default resolver is the zero address and revocable is true, which is what a
 * plain `SchemaRegistry.register(schema, address(0), true)` produces.
 */
export function schemaUid(resolver: Hex = ZERO_ADDRESS, revocable = true): Hex {
  const packed = `${SCHEMA}${resolver.slice(2).toLowerCase()}${revocable ? "01" : "00"}`;
  return keccak256(`0x${Buffer.from(packed, "utf8").toString("hex")}`);
}

export interface AttestationValues {
  charterDigest: Hex;
  constitutionDigest: Hex;
  soulDigest: Hex;
  charterCid: string;
  constitutionCid: string;
  soulCid: string;
  version: string;
  date: bigint;
}

/** ABI-encode the schema values exactly as EAS stores them in `Attestation.data`. */
export function encodeAttestationData(values: AttestationValues): Hex {
  return encodeAbiParameters(SCHEMA_FIELDS, [
    values.charterDigest,
    values.constitutionDigest,
    values.soulDigest,
    values.charterCid,
    values.constitutionCid,
    values.soulCid,
    values.version,
    values.date,
  ]);
}
