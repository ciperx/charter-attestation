/**
 * Shared fixtures. These are short stand-ins for the real texts; the digests below
 * are pinned so any change to canonicalisation shows up as a failing test.
 */
export const CHARTER =
  "The Founding Charter\n\nArticle 1. Every citizen speaks with one voice.\nArticle 2. No secret shall bind the whole.\n";

export const CONSTITUTION = "The Constitution\n\nSection 1. Power is lent, never owned.\n";

export const SOUL = "SOUL\n\nWe build in the open, and we remember why.\n";

export const CIDS = {
  charter: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
  constitution: "bafybeibwzifw52ttrkqlikfzext5akbuaimzrvcferdns4urpnmk2ablx4",
  soul: "bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy",
} as const;

export const VERSION = "1.0.0";
export const DATE = 1792713600; // 2026-10-23T00:00:00Z

/**
 * Pinned SHA-256 digests of the canonical bytes of the fixtures above.
 * If one of these changes, the canonicalisation changed and every issued
 * attestation is invalidated: treat a diff here as a breaking change.
 */
export const PINNED_SHA256 = {
  charter: "0632b193502730af1f2e370009af13af25c75a131e05312f466170982d52ed93",
  constitution: "0653c6a0c292be60703943569ecff252eb943dbfb48de488234900b3add7002a",
  soul: "2ed5791ea631bbdb54a7a5e0e30f585bdb72ac97f6481e9367ad8f2a1f894a12",
} as const;
