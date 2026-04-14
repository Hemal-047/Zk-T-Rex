const circomlibjs = require("circomlibjs");
const fs = require("fs");
const path = require("path");

async function main() {
  const poseidon = await circomlibjs.buildPoseidon();
  const eddsa = await circomlibjs.buildEddsa();
  const F = poseidon.F;

  const TREE_HEIGHT = 20;

  console.log("=== zkT-REX User Onboarding ===\n");

  // === 1. Generate EdDSA issuer keypair ===
  const issuerPrivKey = Buffer.from(
    "0001020304050607080900010203040506070809000102030405060708090001",
    "hex"
  );
  const issuerPubKey = eddsa.prv2pub(issuerPrivKey);
  const issuerPubKeyAx = F.toObject(issuerPubKey[0]);
  const issuerPubKeyAy = F.toObject(issuerPubKey[1]);

  console.log("Issuer public key:");
  console.log("  Ax:", issuerPubKeyAx.toString());
  console.log("  Ay:", issuerPubKeyAy.toString());

  // Save issuer key separately
  const issuerKeyData = {
    privateKey: issuerPrivKey.toString("hex"),
    publicKeyAx: issuerPubKeyAx.toString(),
    publicKeyAy: issuerPubKeyAy.toString(),
  };
  fs.writeFileSync(
    path.join(__dirname, "issuer-key.json"),
    JSON.stringify(issuerKeyData, null, 2)
  );
  console.log("  Saved to scripts/issuer-key.json\n");

  // === 2. Create KYC claim ===
  const claimTopic = BigInt(1); // 1 = KYC_VERIFIED
  const claimValue = BigInt(852); // Hong Kong jurisdiction code
  const claimExpirationDate = BigInt(
    Math.floor(Date.now() / 1000) + 365 * 86400
  ); // 1 year from now
  const claimSecret = BigInt("12345678901234567890"); // User's secret

  console.log("Claim data:");
  console.log("  Topic:", claimTopic.toString(), "(KYC_VERIFIED)");
  console.log("  Value:", claimValue.toString(), "(Hong Kong)");
  console.log(
    "  Expiration:",
    new Date(Number(claimExpirationDate) * 1000).toISOString()
  );
  console.log("  Secret:", claimSecret.toString());

  // === 3. Hash and sign the claim ===
  const claimHashValue = poseidon([
    claimTopic,
    claimValue,
    claimExpirationDate,
    claimSecret,
  ]);
  const claimHashBigInt = F.toObject(claimHashValue);

  console.log("\nClaim hash:", claimHashBigInt.toString());

  // signPoseidon expects a field element, not a raw BigInt
  const claimHashF = F.e(claimHashBigInt);
  const sig = eddsa.signPoseidon(issuerPrivKey, claimHashF);
  const sigR8x = F.toObject(sig.R8[0]);
  const sigR8y = F.toObject(sig.R8[1]);
  const sigS = sig.S;

  console.log("EdDSA signature:");
  console.log("  R8x:", sigR8x.toString());
  console.log("  R8y:", sigR8y.toString());
  console.log("  S:", sigS.toString());

  // Verify signature locally
  const sigValid = eddsa.verifyPoseidon(claimHashF, sig, issuerPubKey);
  console.log("  Signature valid:", sigValid);
  if (!sigValid) {
    throw new Error("EdDSA signature verification failed!");
  }

  // === 4. Compute identity commitment ===
  const identityCommitment = poseidon([claimHashBigInt, claimSecret]);
  const identityCommitmentBigInt = F.toObject(identityCommitment);
  console.log(
    "\nIdentity commitment:",
    identityCommitmentBigInt.toString()
  );

  // === 5. Build identity Merkle tree ===
  // Precompute zero hashes
  const zeroHashes = [F.toObject(poseidon([BigInt(0)]))];
  for (let i = 1; i <= TREE_HEIGHT; i++) {
    zeroHashes.push(
      F.toObject(poseidon([zeroHashes[i - 1], zeroHashes[i - 1]]))
    );
  }

  // Insert commitment at index 0: walk up from leaf, sibling at each level is zero hash
  const identityPathElements = [];
  const identityPathIndices = [];
  let currentHash = identityCommitmentBigInt;
  for (let i = 0; i < TREE_HEIGHT; i++) {
    identityPathElements.push(zeroHashes[i].toString());
    identityPathIndices.push(0); // leaf at index 0, always left child
    currentHash = F.toObject(poseidon([currentHash, zeroHashes[i]]));
  }
  const identityRoot = currentHash;

  console.log("\nIdentity tree (1 leaf at index 0):");
  console.log("  Root:", identityRoot.toString());
  console.log(
    "  Root (bytes32):",
    "0x" + identityRoot.toString(16).padStart(64, "0")
  );

  // === 6. Empty revocation SMT ===
  // claimNullifier = Poseidon(claimSecret, claimTopic)
  const claimNullifier = F.toObject(poseidon([claimSecret, claimTopic]));
  console.log("\nClaim nullifier:", claimNullifier.toString());

  // For the empty SMT, compute the root by walking up from the nullifier's position
  // All siblings are zero hashes since the tree is empty
  const revocationSiblings = [];
  for (let i = 0; i < TREE_HEIGHT; i++) {
    revocationSiblings.push(zeroHashes[i].toString());
  }

  // Compute the empty SMT root as seen from the nullifier's path
  // The leaf is Poseidon(0) (empty leaf), then walk up using nullifier bits
  let revocCurrentHash = F.toObject(poseidon([BigInt(0)])); // hash of empty leaf
  const nullifierBits = BigInt(claimNullifier)
    .toString(2)
    .padStart(TREE_HEIGHT, "0")
    .split("")
    .reverse();
  for (let i = 0; i < TREE_HEIGHT; i++) {
    if (nullifierBits[i] === "0") {
      revocCurrentHash = F.toObject(
        poseidon([revocCurrentHash, zeroHashes[i]])
      );
    } else {
      revocCurrentHash = F.toObject(
        poseidon([zeroHashes[i], revocCurrentHash])
      );
    }
  }
  const revocationRoot = revocCurrentHash;

  console.log("Revocation SMT (empty, no revocations):");
  console.log("  Root:", revocationRoot.toString());
  console.log(
    "  Root (bytes32):",
    "0x" + revocationRoot.toString(16).padStart(64, "0")
  );

  // === 7. Save all data ===
  const demoIdentity = {
    // Claim data (private inputs)
    claimTopic: claimTopic.toString(),
    claimValue: claimValue.toString(),
    claimExpirationDate: claimExpirationDate.toString(),
    claimSecret: claimSecret.toString(),

    // EdDSA signature (private inputs)
    sigR8x: sigR8x.toString(),
    sigR8y: sigR8y.toString(),
    sigS: sigS.toString(),

    // Identity tree (private inputs)
    identityPathElements: identityPathElements,
    identityPathIndices: identityPathIndices,

    // Revocation SMT siblings (private inputs)
    revocationSiblings: revocationSiblings,

    // Public inputs
    identityRoot: identityRoot.toString(),
    revocationRoot: revocationRoot.toString(),
    issuerPubKeyAx: issuerPubKeyAx.toString(),
    issuerPubKeyAy: issuerPubKeyAy.toString(),

    // Derived values (for reference)
    claimHash: claimHashBigInt.toString(),
    identityCommitment: identityCommitmentBigInt.toString(),
    claimNullifier: claimNullifier.toString(),
    identityRootBytes32:
      "0x" + identityRoot.toString(16).padStart(64, "0"),
    revocationRootBytes32:
      "0x" + revocationRoot.toString(16).padStart(64, "0"),
  };

  fs.writeFileSync(
    path.join(__dirname, "demo-identity.json"),
    JSON.stringify(demoIdentity, null, 2)
  );

  console.log("\n=== Saved to scripts/demo-identity.json ===");
  console.log("Contains all data needed for proof generation and deployment.");
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
