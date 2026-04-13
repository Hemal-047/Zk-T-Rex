const { expect } = require("chai");
const circomlibjs = require("circomlibjs");
const snarkjs = require("snarkjs");
const path = require("path");

describe("ZKTRex Circuit", function () {
  this.timeout(120000); // ZK proofs take time

  let poseidon, eddsa, F;

  before(async () => {
    poseidon = await circomlibjs.buildPoseidon();
    eddsa = await circomlibjs.buildEddsa();
    F = poseidon.F;
  });

  it("should generate a valid proof for a compliant user", async () => {
    // Generate issuer keypair
    const issuerPrivKey = Buffer.from(
      "0001020304050607080900010203040506070809000102030405060708090001",
      "hex"
    );
    const issuerPubKey = eddsa.prv2pub(issuerPrivKey);

    // Claim data
    const claimTopic = BigInt(1); // e.g., 1 = KYC_VERIFIED
    const claimValue = BigInt(852); // e.g., Hong Kong jurisdiction code
    const claimExpirationDate = BigInt(Math.floor(Date.now() / 1000) + 365 * 86400); // 1 year from now
    const claimSecret = BigInt("12345678901234567890");

    // Hash the claim
    const claimHashValue = poseidon([claimTopic, claimValue, claimExpirationDate, claimSecret]);
    const claimHashBigInt = F.toObject(claimHashValue);

    // Sign the claim
    const sig = eddsa.signPoseidon(issuerPrivKey, claimHashBigInt);

    // Identity commitment
    const identityCommitment = poseidon([claimHashBigInt, claimSecret]);
    const identityCommitmentBigInt = F.toObject(identityCommitment);

    // Build a simple identity tree (height 20) with this one leaf
    // For testing: create a tree with only this leaf at index 0
    const TREE_HEIGHT = 20;
    const zeroValue = F.toObject(poseidon([BigInt(0)]));

    // Build zero hashes for empty tree
    let zeroHashes = [zeroValue];
    for (let i = 1; i <= TREE_HEIGHT; i++) {
      zeroHashes.push(F.toObject(poseidon([zeroHashes[i-1], zeroHashes[i-1]])));
    }

    // Identity tree: leaf at index 0
    let identityPathElements = [];
    let identityPathIndices = [];
    let currentHash = identityCommitmentBigInt;
    for (let i = 0; i < TREE_HEIGHT; i++) {
      identityPathElements.push(zeroHashes[i].toString());
      identityPathIndices.push(0);
      currentHash = F.toObject(poseidon([currentHash, zeroHashes[i]]));
    }
    const identityRoot = currentHash;

    // Revocation tree: all zeros (no one revoked)
    let revocationSiblings = [];
    const claimNullifier = F.toObject(poseidon([claimSecret, claimTopic]));
    // For SMT with empty tree, all siblings are zero hashes
    for (let i = 0; i < TREE_HEIGHT; i++) {
      revocationSiblings.push(zeroHashes[i].toString());
    }
    // Compute revocation root for empty tree
    let revocCurrentHash = F.toObject(poseidon([BigInt(0)]));
    // Walk up using the nullifier bits to determine left/right
    let nullifierBits = BigInt(claimNullifier).toString(2).padStart(TREE_HEIGHT, "0").split("").reverse();
    for (let i = 0; i < TREE_HEIGHT; i++) {
      if (nullifierBits[i] === "0") {
        revocCurrentHash = F.toObject(poseidon([revocCurrentHash, zeroHashes[i]]));
      } else {
        revocCurrentHash = F.toObject(poseidon([zeroHashes[i], revocCurrentHash]));
      }
    }
    const revocationRoot = revocCurrentHash;

    const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));

    const input = {
      // Private
      claimTopic: claimTopic.toString(),
      claimValue: claimValue.toString(),
      claimExpirationDate: claimExpirationDate.toString(),
      claimSecret: claimSecret.toString(),
      sigR8x: F.toObject(sig.R8[0]).toString(),
      sigR8y: F.toObject(sig.R8[1]).toString(),
      sigS: sig.S.toString(),
      identityPathElements: identityPathElements,
      identityPathIndices: identityPathIndices,
      revocationSiblings: revocationSiblings,
      // Public
      identityRoot: identityRoot.toString(),
      revocationRoot: revocationRoot.toString(),
      currentTimestamp: currentTimestamp.toString(),
      issuerPubKeyAx: F.toObject(issuerPubKey[0]).toString(),
      issuerPubKeyAy: F.toObject(issuerPubKey[1]).toString(),
      requiredClaimTopic: claimTopic.toString(),
    };

    // Generate proof
    const wasmPath = path.join(__dirname, "../build/zktrex_js/zktrex.wasm");
    const zkeyPath = path.join(__dirname, "../build/zktrex_final.zkey");

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      wasmPath,
      zkeyPath
    );

    // Verify proof
    const vkeyPath = path.join(__dirname, "../build/verification_key.json");
    const vkey = JSON.parse(require("fs").readFileSync(vkeyPath, "utf8"));
    const verified = await snarkjs.groth16.verify(vkey, publicSignals, proof);

    expect(verified).to.be.true;
    console.log("Proof verified successfully!");
    console.log("Public signals:", publicSignals);
  });
});
