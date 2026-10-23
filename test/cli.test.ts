import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { CIDS, CHARTER, CONSTITUTION, DATE, SOUL, VERSION } from "./fixtures.js";

const cli = join(process.cwd(), "dist", "cli.js");
const dir = mkdtempSync(join(tmpdir(), "charter-attest-cli-"));
const payloadPath = join(dir, "payload.json");
// Throwaway key generated inside the test file; never stored in the repository.
const TEST_PRIVATE_KEY = generatePrivateKey();

writeFileSync(join(dir, "charter.md"), CHARTER);
writeFileSync(join(dir, "constitution.md"), CONSTITUTION);
writeFileSync(join(dir, "soul.md"), SOUL);

const run = (args: string[], expectFailure = false): string => {
  try {
    return execFileSync(process.execPath, [cli, ...args], { encoding: "utf8" });
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string; status?: number };
    if (!expectFailure) throw error;
    return failure.stdout || failure.stderr || "";
  }
};

const buildArgs = [
  "build",
  "--charter",
  join(dir, "charter.md"),
  "--constitution",
  join(dir, "constitution.md"),
  "--soul",
  join(dir, "soul.md"),
  "--charter-cid",
  CIDS.charter,
  "--constitution-cid",
  CIDS.constitution,
  "--soul-cid",
  CIDS.soul,
  "--version",
  VERSION,
  "--date",
  new Date(DATE * 1000).toISOString(),
  "--chain-id",
  "8453",
];

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("charter-attest CLI", () => {
  it("prints the full payload as JSON with the documented shape", () => {
    const stdout = run(buildArgs);
    const output = JSON.parse(stdout) as Record<string, any>;

    expect(Object.keys(output).sort()).toEqual([
      "canonicalisation",
      "data",
      "digests",
      "schema",
      "schemaUid",
      "typedData",
    ]);
    expect(typeof output.schema).toBe("string");
    expect(output.schema.startsWith("bytes32 charterDigest")).toBe(true);
    expect(output.schemaUid).toMatch(/^0x[0-9a-f]{64}$/);
    expect(output.data).toMatch(/^0x[0-9a-f]+$/);
    for (const key of ["charter", "constitution", "soul"]) {
      expect(output.digests[key].sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(output.digests[key].keccak256).toMatch(/^0x[0-9a-f]{64}$/);
    }
    expect(output.digests.payload.keccak256).toMatch(/^0x[0-9a-f]{64}$/);
    expect(output.typedData.primaryType).toBe("Attestation");
    expect(output.typedData.domain.chainId).toBe(8453);
    expect(output.typedData.message.date).toBe(String(DATE));
    expect(output.canonicalisation.version).toBe("charter-canon-v1");
    expect(output.canonicalisation.rules.length).toBeGreaterThan(0);

    writeFileSync(payloadPath, stdout);
  });

  it("is byte-identical across runs", () => {
    expect(run(buildArgs)).toBe(run(buildArgs));
  });

  it("verifies a signature over its own output", async () => {
    const output = JSON.parse(readFileSync(payloadPath, "utf8")) as {
      typedData: { domain: Record<string, unknown>; types: Record<string, unknown>; primaryType: string; message: Record<string, unknown> };
    };
    const account = privateKeyToAccount(TEST_PRIVATE_KEY);
    const signature = await account.signTypedData({
      ...output.typedData,
      message: { ...output.typedData.message, date: BigInt(String(output.typedData.message.date)) },
    } as Parameters<typeof account.signTypedData>[0]);

    const stdout = run(["verify", "--input", payloadPath, "--signature", signature, "--address", account.address]);
    expect(JSON.parse(stdout)).toEqual({ valid: true, signer: account.address });
  });

  it("reports invalid and exits non-zero when the payload is tampered with", async () => {
    const output = JSON.parse(readFileSync(payloadPath, "utf8")) as any;
    const account = privateKeyToAccount(TEST_PRIVATE_KEY);
    const signature = await account.signTypedData({
      ...output.typedData,
      message: { ...output.typedData.message, date: BigInt(String(output.typedData.message.date)) },
    } as Parameters<typeof account.signTypedData>[0]);

    const tamperedPath = join(dir, "tampered.json");
    const tampered = {
      ...output,
      typedData: {
        ...output.typedData,
        message: { ...output.typedData.message, soulDigest: `0x${"00".repeat(32)}` },
      },
    };
    writeFileSync(tamperedPath, JSON.stringify(tampered));
    const stdout = run(
      ["verify", "--input", tamperedPath, "--signature", signature, "--address", account.address],
      true,
    );
    expect(JSON.parse(stdout).valid).toBe(false);
  });

  it("fails with usage text when a required flag is missing", () => {
    const stderr = run(["build", "--charter", join(dir, "charter.md")], true);
    expect(stderr).toContain("--constitution is required");
  });
});
