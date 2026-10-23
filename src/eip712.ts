import type { Hex, TypedData, TypedDataDomain } from "viem";
import { ZERO_ADDRESS } from "./schema.js";
import type { AttestationPayload } from "./attestation.js";

/**
 * EIP-712 struct used to sign the attestation off chain before it is submitted.
 *
 * The three text digests and the version/date are duplicated from the EAS payload so
 * that a signature commits to the exact charter release, not only to opaque ABI bytes.
 * `payloadDigest` binds the signature to the EAS `data` blob, including the CIDs.
 */
export const ATTESTATION_EIP712_TYPES = {
  Attestation: [
    { name: "charterDigest", type: "bytes32" },
    { name: "constitutionDigest", type: "bytes32" },
    { name: "soulDigest", type: "bytes32" },
    { name: "payloadDigest", type: "bytes32" },
    { name: "version", type: "string" },
    { name: "date", type: "uint64" },
  ],
} as const satisfies TypedData;

export type AttestationMessage = {
  charterDigest: Hex;
  constitutionDigest: Hex;
  soulDigest: Hex;
  payloadDigest: Hex;
  version: string;
  date: bigint;
};

export const ATTESTATION_PRIMARY_TYPE = "Attestation" as const;

export interface Eip712DomainOptions {
  /** EVM chain id the attestation is meant for. Defaults to Base mainnet (8453). */
  chainId?: number;
  /** Verifying contract (EAS or a dedicated attestation verifier). */
  verifyingContract?: Hex;
}

/** Default EIP-712 domain. Override the verifying contract for a deployed verifier. */
export function attestationDomain(options: Eip712DomainOptions = {}): TypedDataDomain {
  return {
    name: "CharterAttestation",
    version: "1",
    chainId: options.chainId ?? 8453,
    verifyingContract: options.verifyingContract ?? ZERO_ADDRESS,
  };
}

/** The typed-data message that mirrors an attestation payload. */
export function attestationMessage(
  payload: AttestationPayload,
  version: string,
  date: bigint | number | string,
): AttestationMessage {
  return {
    charterDigest: payload.digests.charter.keccak256,
    constitutionDigest: payload.digests.constitution.keccak256,
    soulDigest: payload.digests.soul.keccak256,
    payloadDigest: payload.digests.payload.keccak256,
    version,
    date: BigInt(date),
  };
}

export interface BuildTypedDataInput {
  payload: AttestationPayload;
  version: string;
  date: bigint | number | string;
  domain?: Eip712DomainOptions;
}

/** Complete EIP-712 typed data (domain, types, primaryType, message) for signing. */
export function buildTypedData(input: BuildTypedDataInput) {
  return {
    domain: attestationDomain(input.domain),
    types: ATTESTATION_EIP712_TYPES,
    primaryType: ATTESTATION_PRIMARY_TYPE,
    message: {
      charterDigest: input.payload.digests.charter.keccak256,
      constitutionDigest: input.payload.digests.constitution.keccak256,
      soulDigest: input.payload.digests.soul.keccak256,
      payloadDigest: input.payload.digests.payload.keccak256,
      version: input.version,
      date: BigInt(input.date),
    },
  } as const;
}
