# charter-attestation

Deterministic attestation payloads for the One Charter: canonicalise the three founding
texts, hash them, and emit one EAS payload plus one EIP-712 typed-data object that any
EVM wallet can sign.

Built for LAX job `f7ac7d66-1708-46dc-99ce-47d74b3ece7e` ("One Charter attestation builder").

## What it does

`buildAttestation({ texts, cids, version, date })` returns:

```ts
{
  schema: string,      // the EAS schema string, byte-stable
  data: `0x${string}`, // ABI-encoded EAS `data` field
  digests: {
    charter:      { sha256, keccak256, bytes, canonicalisation },
    constitution: { sha256, keccak256, bytes, canonicalisation },
    soul:         { sha256, keccak256, bytes, canonicalisation },
    payload:      { keccak256 }   // over the ABI-encoded data
  },
  schemaUid: `0x${string}` // EAS schema UID for the default registration
}
```

The SHA-256 values are the acceptance hashes required by the job spec: they are taken
over the canonical UTF-8 bytes of each text. keccak256 is provided over the same bytes
because that is what the EVM and EAS consume.

## Canonicalisation (`charter-canon-v1`)

A digest is only useful if everybody hashes identical bytes, so the input is normalised
before hashing. The rules are fixed and deliberately small:

1. The input must be a string; a leading UTF-8 BOM is removed.
2. Unicode NFC is applied to the whole document.
3. CRLF and lone CR become LF.
4. Trailing spaces and tabs are removed from every line.
5. Trailing blank lines are removed; a non-empty document ends with exactly one LF.
   An empty document canonicalises to the empty string.

Case, internal indentation, internal blank lines and punctuation are untouched. This is
not a Markdown canonicaliser: the same bytes are hashed on Linux, macOS, Windows and in CI.

`CANONICALISATION_VERSION` is `charter-canon-v1`. Any change to the rules requires a new
version string, because it changes every digest ever produced.

## EAS schema

```
bytes32 charterDigest,bytes32 constitutionDigest,bytes32 soulDigest,string charterCid,string constitutionCid,string soulCid,string version,uint64 date
```

The three `bytes32` fields hold keccak256 of the canonical texts. `data` is
`abi.encode` of those eight values in that order, which is exactly the blob EAS stores in
`Attestation.data`, so it can be passed straight to `EAS.attest({ schema, data })`.

`schemaUid` is `keccak256(abi.encodePacked(schema, resolver, revocable))` with the zero
resolver and `revocable = true`, matching `SchemaRegistry.register(schema, address(0), true)`.

## EIP-712 attestation

The off-chain signature commits to the same release, not only to opaque ABI bytes:

```
Attestation(bytes32 charterDigest,bytes32 constitutionDigest,bytes32 soulDigest,
            bytes32 payloadDigest,string version,uint64 date)
```

Domain: `name: "CharterAttestation"`, `version: "1"`, `chainId` (default 8453, Base),
`verifyingContract` (default the zero address, override with your deployed verifier).
`payloadDigest` is keccak256 of the EAS `data` blob, so the signature binds the CIDs too.

## CLI

```bash
npm install
npm run build

node dist/cli.js build \
  --charter charter.md --constitution constitution.md --soul soul.md \
  --charter-cid bafy... --constitution-cid bafy... --soul-cid bafy... \
  --version 1.0.0 --date 2026-10-23T00:00:00Z \
  --chain-id 8453 --verifying-contract 0x...
```

Prints one JSON object: `schema`, `schemaUid`, `data`, `digests`, `typedData`,
`canonicalisation`. The output is byte-identical across runs for the same inputs, so it
can be diffed and archived.

```bash
node dist/cli.js verify --input payload.json --signature 0x... --address 0x...
```

Prints `{ "valid": true, "signer": "0x..." }` and exits non-zero when the signature does
not match the payload or the expected signer. `--address` is required: without an expected
signer a tampered payload would "recover" to some other address and look valid.

## API

```ts
import { buildAttestation, buildTypedData, canonicalize } from "charter-attestation";

const payload = buildAttestation({
  texts: { charter, constitution, soul },
  cids: { charter: cid1, constitution: cid2, soul: cid3 },
  version: "1.0.0",
  date: "2026-10-23T00:00:00Z",
});

const typedData = buildTypedData({ payload, version: "1.0.0", date: 1792713600 });
```

Other exports: `canonicalize`, `canonicalizeBytes`, `digestText`, `sha256Hex`,
`keccak256Hex`, `SCHEMA`, `SCHEMA_FIELDS`, `schemaUid`, `encodeAttestationData`,
`toUnixSeconds`, `attestationDomain`, `attestationMessage`, `ATTESTATION_EIP712_TYPES`.

## Tests

```bash
npm ci
npm test          # builds, then runs vitest
npx tsc --noEmit  # type-checks src and test
```

Coverage includes:

- canonicalisation: NFC composed vs decomposed, CRLF and lone CR, trailing whitespace,
  BOM, trailing blank lines, internal blank lines preserved, idempotence;
- digest stability: pinned SHA-256 values plus Windows, classic Mac and messy input all
  producing the same digest and payload;
- changed text, CID, version or date changing the digest and the payload;
- schema string stability and schema UID derivation;
- EIP-712 round trip with a fixed throwaway key, wrong signer rejection, tamper detection
  for every signed field, replay rejection on another chain or verifying contract;
- CLI JSON shape, run-to-run determinism, verify success, verify failure on tampering,
  and usage errors.

## Security notes

- No private keys, mnemonics or API tokens are stored in this repository or read by the CLI.
- Tests generate a fresh throwaway key with viem's `generatePrivateKey()` at runtime; no
  private key literal is stored in the repository. Never fund a test key.
- `buildAttestation` validates its input and throws `TypeError` rather than emitting a
  payload with an empty CID, empty version or invalid date.

## License

MIT
