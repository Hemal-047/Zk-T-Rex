/**
 * Server-side issuer logic: sign a unique KYC claim per user with EdDSA,
 * compute identity commitments, and expose helpers for the API routes.
 *
 * This module runs ONLY inside Next.js API routes (Node runtime). Do not
 * import from client components — circomlibjs pulls in WASM that can't
 * be bundled for the browser.
 */

import { randomBytes } from "node:crypto";
import { buildEddsa } from "circomlibjs";
import { getPoseidon } from "./merkleTrees";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Fixed demo claim values. Every user is a "KYC_VERIFIED Hong Kong retail
// investor" — but each wallet gets a UNIQUE claimSecret, so their
// commitment and nullifier are unique. Revoking one wallet only affects
// that wallet, and the stored Merkle leaves are distinct even though the
// human-readable claim is the same.
const CLAIM_TOPIC = BigInt(1);    // KYC_VERIFIED
const CLAIM_VALUE = BigInt(852);  // Hong Kong jurisdiction code
const CLAIM_EXPIRATION_SECONDS = 365 * 24 * 60 * 60; // 1 year

// BN128 scalar field prime. Randomly-generated secrets must be < r.
const BN128_FR =
  BigInt(
    "21888242871839275222246405745257275088548364400416034343698204186575808495617"
  );

const DEFAULT_ISSUER_PRIVATE_KEY_HEX =
  "0001020304050607080900010203040506070809000102030405060708090001";

export function getIssuerPrivateKey(): Buffer {
  const hex = process.env.ISSUER_PRIVATE_KEY || DEFAULT_ISSUER_PRIVATE_KEY_HEX;
  return Buffer.from(hex.replace(/^0x/, ""), "hex");
}

// ---------------------------------------------------------------------------
// Cached circomlibjs EdDSA
// ---------------------------------------------------------------------------

let _eddsa: any | null = null;
let _eddsaPromise: Promise<any> | null = null;

async function getEddsa() {
  if (_eddsa) return _eddsa;
  if (!_eddsaPromise) {
    _eddsaPromise = buildEddsa().then((e) => {
      _eddsa = e;
      return e;
    });
  }
  return _eddsaPromise;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function toBytes32Hex(value: bigint | string): `0x${string}` {
  const big = typeof value === "bigint" ? value : BigInt(value);
  return ("0x" + big.toString(16).padStart(64, "0")) as `0x${string}`;
}

// ---------------------------------------------------------------------------
// Issuer public key (cached)
// ---------------------------------------------------------------------------

let _issuerPubKey: { ax: bigint; ay: bigint } | null = null;

export async function getIssuerPublicKey(): Promise<{
  ax: bigint;
  ay: bigint;
}> {
  if (_issuerPubKey) return _issuerPubKey;
  const eddsa = await getEddsa();
  const poseidon = await getPoseidon();
  const F = poseidon.F;
  const issuerPrivKey = getIssuerPrivateKey();
  const issuerPubKey = eddsa.prv2pub(issuerPrivKey);
  _issuerPubKey = {
    ax: F.toObject(issuerPubKey[0]) as bigint,
    ay: F.toObject(issuerPubKey[1]) as bigint,
  };
  return _issuerPubKey;
}

// ---------------------------------------------------------------------------
// Per-user claim generation
// ---------------------------------------------------------------------------

export interface UserClaim {
  claimTopic: bigint;
  claimValue: bigint;
  claimExpirationDate: bigint;
  claimSecret: bigint;
  claimHash: bigint;
  sigR8x: bigint;
  sigR8y: bigint;
  sigS: bigint;
  commitment: bigint;
  claimNullifier: bigint;
}

/**
 * Generate a random scalar in [1, BN128_FR). Rejection-sampled from 31
 * bytes (248 bits) so we can never overflow the field.
 */
export function randomFieldElement(): bigint {
  // 31 bytes → 248 bits, guaranteed < 2^248 < BN128_FR.
  // We still coerce into [1, r) for safety.
  for (let attempt = 0; attempt < 8; attempt++) {
    const buf = randomBytes(31);
    let n = BigInt(0);
    for (let i = 0; i < buf.length; i++) {
      n = (n << BigInt(8)) | BigInt(buf[i]);
    }
    if (n > BigInt(0) && n < BN128_FR) return n;
  }
  throw new Error("Failed to sample a field element");
}

/**
 * Produce a brand-new signed claim for a user. The claim secret is fresh
 * randomness, so commitment and nullifier are unique per call.
 */
export async function generateUserClaim(): Promise<UserClaim> {
  const poseidon = await getPoseidon();
  const eddsa = await getEddsa();
  const F = poseidon.F;

  const claimSecret = randomFieldElement();
  const claimExpirationDate = BigInt(
    Math.floor(Date.now() / 1000) + CLAIM_EXPIRATION_SECONDS
  );

  const claimHash = F.toObject(
    poseidon([CLAIM_TOPIC, CLAIM_VALUE, claimExpirationDate, claimSecret])
  ) as bigint;

  const sig = eddsa.signPoseidon(getIssuerPrivateKey(), F.e(claimHash));

  const commitment = F.toObject(
    poseidon([claimHash, claimSecret])
  ) as bigint;

  const claimNullifier = F.toObject(
    poseidon([claimSecret, CLAIM_TOPIC])
  ) as bigint;

  return {
    claimTopic: CLAIM_TOPIC,
    claimValue: CLAIM_VALUE,
    claimExpirationDate,
    claimSecret,
    claimHash,
    sigR8x: F.toObject(sig.R8[0]) as bigint,
    sigR8y: F.toObject(sig.R8[1]) as bigint,
    sigS: BigInt(sig.S),
    commitment,
    claimNullifier,
  };
}

/**
 * Recompute the nullifier for a stored user (given their claimSecret).
 * Used by /api/revoke so we can take just a wallet address and derive
 * the nullifier without trusting client input.
 */
export async function computeNullifier(
  claimSecret: bigint,
  claimTopic: bigint
): Promise<bigint> {
  const poseidon = await getPoseidon();
  return poseidon.F.toObject(
    poseidon([claimSecret, claimTopic])
  ) as bigint;
}
