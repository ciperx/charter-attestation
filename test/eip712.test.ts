import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { recoverTypedDataAddress, verifyTypedData } from "viem";
import { buildAttestation } from "../src/attestation.js";
import { buildTypedData, ATTESTATION_EIP712_TYPES } from "../src/eip712.js";
import { CIDS, CHARTER, CONSTITUTION, DATE, OTHER_TEST_PRIVATE_KEY, SOUL, TEST_PRIVATE_KEY, VERSION } from "./fixtures.js";

const payload = buildAttestation({
  texts: { charter: CHARTER, constitution: CONSTITUTION, soul: SOUL },
  cids: { ...CIDS },
  version: VERSION,
  date: DATE,
});

const typed = buildTypedData({
  payload,
  version: VERSION,
  date: DATE,
  domain: { chainId: 8453, verifyingContract: "0x00000000000000000000000000000000000000ee" },
});

const account = privateKeyToAccount(TEST_PRIVATE_KEY);

describe("EIP-712 attestation", () => {
  it("defines the Attestation struct and a Base domain", () => {
    expect(typed.primaryType).toBe("Attestation");
    expect(typed.types.Attestation.map((field) => field.name)).toEqual([
      "charterDigest",
      "constitutionDigest",
      "soulDigest",
      "payloadDigest",
      "version",
      "date",
    ]);
    expect(ATTESTATION_EIP712_TYPES.Attestation).toHaveLength(6);
    expect(typed.domain).toEqual({
      name: "CharterAttestation",
      version: "1",
      chainId: 8453,
      verifyingContract: "0x00000000000000000000000000000000000000ee",
    });
  });

  it("binds the message to the payload digests", () => {
    expect(typed.message.charterDigest).toBe(payload.digests.charter.keccak256);
    expect(typed.message.constitutionDigest).toBe(payload.digests.constitution.keccak256);
    expect(typed.message.soulDigest).toBe(payload.digests.soul.keccak256);
    expect(typed.message.payloadDigest).toBe(payload.digests.payload.keccak256);
    expect(typed.message.date).toBe(BigInt(DATE));
  });

  it("round-trips a signature from a fixed throwaway key", async () => {
    const signature = await account.signTypedData(typed);
    expect(signature).toMatch(/^0x[0-9a-f]{130}$/);
    await expect(verifyTypedData({ ...typed, address: account.address, signature })).resolves.toBe(
      true,
    );
    await expect(recoverTypedDataAddress({ ...typed, signature })).resolves.toBe(account.address);
  });

  it("rejects a signature from a different key", async () => {
    const other = privateKeyToAccount(OTHER_TEST_PRIVATE_KEY);
    const signature = await other.signTypedData(typed);
    await expect(verifyTypedData({ ...typed, address: account.address, signature })).resolves.toBe(
      false,
    );
  });

  it("detects tampering with any signed field", async () => {
    const signature = await account.signTypedData(typed);
    const h = (byte: string): `0x${string}` => `0x${byte.repeat(32)}`;
    const tampered = [
      { ...typed.message, charterDigest: h("11") },
      { ...typed.message, constitutionDigest: h("22") },
      { ...typed.message, soulDigest: h("33") },
      { ...typed.message, payloadDigest: h("44") },
      { ...typed.message, version: "9.9.9" },
      { ...typed.message, date: BigInt(DATE + 1) },
    ];
    for (const message of tampered) {
      await expect(
        verifyTypedData({ ...typed, message, address: account.address, signature }),
      ).resolves.toBe(false);
    }
  });

  it("rejects a replay on a different chain or verifying contract", async () => {
    const signature = await account.signTypedData(typed);
    const otherChain = buildTypedData({ payload, version: VERSION, date: DATE, domain: { chainId: 1 } });
    const otherContract = buildTypedData({
      payload,
      version: VERSION,
      date: DATE,
      domain: { chainId: 8453, verifyingContract: "0x00000000000000000000000000000000000000ff" },
    });
    await expect(
      verifyTypedData({ ...otherChain, address: account.address, signature }),
    ).resolves.toBe(false);
    await expect(
      verifyTypedData({ ...otherContract, address: account.address, signature }),
    ).resolves.toBe(false);
  });
});
