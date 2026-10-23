#!/usr/bin/env node
/**
 * charter-attest: print the One Charter attestation payload as JSON, or verify a
 * signature against it.
 *
 *   charter-attest build --charter charter.md --constitution constitution.md \
 *     --soul soul.md --charter-cid bafy... --constitution-cid bafy... \
 *     --soul-cid bafy... --version 1.0.0 --date 2026-10-23T00:00:00Z \
 *     [--chain-id 8453] [--verifying-contract 0x...]
 *
 *   charter-attest verify --input payload.json --signature 0x... --address 0x...
 *
 * No private key is ever read or stored by this CLI.
 */
import { readFileSync } from "node:fs";
import { recoverTypedDataAddress, verifyTypedData } from "viem";
import { CANONICALISATION_RULES, CANONICALISATION_VERSION } from "./canonical.js";
import { buildAttestation } from "./attestation.js";
import { buildTypedData, type BuildTypedDataInput } from "./eip712.js";
import type { Hex } from "viem";

const USAGE = `charter-attest build --charter <file> --constitution <file> --soul <file> \\
  --charter-cid <cid> --constitution-cid <cid> --soul-cid <cid> \\
  --version <string> --date <iso8601|unix-seconds> [--chain-id <id>] [--verifying-contract <0x>]
charter-attest verify --input <payload.json> --signature <0x...> --address <expected signer>`;

function fail(message: string): never {
  process.stderr.write(`charter-attest: ${message}\n\n${USAGE}\n`);
  process.exit(2);
}

function parseFlags(argv: string[]): { command: string; flags: Record<string, string> } {
  const command = argv[0] ?? "";
  const flags: Record<string, string> = {};
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === undefined) break;
    if (!arg.startsWith("--")) fail(`unexpected argument: ${arg}`);
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) fail(`missing value for --${key}`);
    flags[key] = value;
    i += 1;
  }
  return { command, flags };
}

function required(flags: Record<string, string>, name: string): string {
  const value = flags[name];
  if (value === undefined || value.length === 0) fail(`--${name} is required`);
  return value;
}

function readText(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    fail(`cannot read ${path}: ${(error as Error).message}`);
  }
}

function jsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

function runBuild(flags: Record<string, string>): void {
  const payload = buildAttestation({
    texts: {
      charter: readText(required(flags, "charter")),
      constitution: readText(required(flags, "constitution")),
      soul: readText(required(flags, "soul")),
    },
    cids: {
      charter: required(flags, "charter-cid"),
      constitution: required(flags, "constitution-cid"),
      soul: required(flags, "soul-cid"),
    },
    version: required(flags, "version"),
    date: required(flags, "date"),
  });

  const date = flags.date!.trim();
  const typedInput: BuildTypedDataInput = {
    payload,
    version: required(flags, "version"),
    date: /^\d+$/.test(date) ? date : Math.floor(Date.parse(date) / 1000),
    domain: {
      ...(flags["chain-id"] === undefined ? {} : { chainId: Number(required(flags, "chain-id")) }),
      ...(flags["verifying-contract"] === undefined
        ? {}
        : { verifyingContract: required(flags, "verifying-contract") as Hex }),
    },
  };

  const output = {
    schema: payload.schema,
    schemaUid: payload.schemaUid,
    data: payload.data,
    digests: payload.digests,
    typedData: buildTypedData(typedInput),
    canonicalisation: {
      version: CANONICALISATION_VERSION,
      rules: CANONICALISATION_RULES,
    },
  };
  process.stdout.write(`${JSON.stringify(output, jsonReplacer, 2)}\n`);
}

interface VerifyInput {
  typedData: {
    domain: Record<string, unknown>;
    types: Record<string, { name: string; type: string }[]>;
    primaryType: string;
    message: Record<string, unknown>;
  };
}

async function runVerify(flags: Record<string, string>): Promise<void> {
  const inputPath = required(flags, "input");
  const signature = required(flags, "signature") as Hex;
  const address = required(flags, "address") as Hex;
  let parsed: VerifyInput;
  try {
    parsed = JSON.parse(readFileSync(inputPath, "utf8")) as VerifyInput;
  } catch (error) {
    fail(`cannot read ${inputPath}: ${(error as Error).message}`);
  }
  const { domain, types, primaryType, message } = parsed.typedData ?? {};
  if (!domain || !types || !primaryType || !message) fail("input has no typedData block");

  const typed = {
    domain,
    types,
    primaryType,
    message: { ...message, date: BigInt(String(message.date)) },
  } as unknown as Parameters<typeof verifyTypedData>[0];

  const valid = await verifyTypedData({ ...typed, address, signature });
  let signer: string | null = null;
  try {
    signer = await recoverTypedDataAddress({ ...typed, signature });
  } catch {
    signer = null;
  }
  process.stdout.write(`${JSON.stringify({ valid, signer }, null, 2)}\n`);
  if (!valid) process.exitCode = 1;
}

async function main(): Promise<void> {
  const { command, flags } = parseFlags(process.argv.slice(2));
  if (command === "build") {
    runBuild(flags);
    return;
  }
  if (command === "verify") {
    await runVerify(flags);
    return;
  }
  fail(command.length === 0 ? "missing command" : `unknown command: ${command}`);
}

void main();
