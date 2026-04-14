pragma circom 2.1.0;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/eddsaposeidon.circom";
include "node_modules/circomlib/circuits/comparators.circom";
include "node_modules/circomlib/circuits/mux1.circom";
include "node_modules/circomlib/circuits/bitify.circom";

// Merkle Inclusion Proof (Identity Tree)
template MerkleInclusion(levels) {
    signal input leaf;
    signal input pathElements[levels];
    signal input pathIndices[levels]; // 0 = left, 1 = right

    signal output root;

    component hashers[levels];
    component mux[levels];

    signal levelHashes[levels + 1];
    levelHashes[0] <== leaf;

    for (var i = 0; i < levels; i++) {
        hashers[i] = Poseidon(2);
        mux[i] = MultiMux1(2);

        mux[i].c[0][0] <== levelHashes[i];
        mux[i].c[0][1] <== pathElements[i];
        mux[i].c[1][0] <== pathElements[i];
        mux[i].c[1][1] <== levelHashes[i];
        mux[i].s <== pathIndices[i];

        hashers[i].inputs[0] <== mux[i].out[0];
        hashers[i].inputs[1] <== mux[i].out[1];

        levelHashes[i + 1] <== hashers[i].out;
    }

    root <== levelHashes[levels];
}

// SMT Non-Inclusion Proof (Revocation Tree)
// Proves that the leaf at the given index is ZERO (not revoked)
template SMTNonInclusion(levels) {
    signal input claimNullifier;   // The index to check
    signal input siblings[levels]; // Sibling hashes along the path

    signal output root;

    // The leaf value at claimNullifier's index must be 0
    // We hash a zero leaf and walk up the tree
    component hashers[levels];
    component mux[levels];

    signal bits[levels];
    signal levelHashes[levels + 1];

    // Decompose claimNullifier into bits for path direction
    // Nullifier is a Poseidon hash (~254 bits), so decompose fully
    // then use only the first `levels` bits for tree navigation
    component n2b = Num2Bits(254);
    n2b.in <== claimNullifier;
    for (var i = 0; i < levels; i++) {
        bits[i] <== n2b.out[i];
    }

    // Start with hash of zero (empty leaf)
    component zeroHash = Poseidon(1);
    zeroHash.inputs[0] <== 0;
    levelHashes[0] <== zeroHash.out;

    for (var i = 0; i < levels; i++) {
        hashers[i] = Poseidon(2);
        mux[i] = MultiMux1(2);

        mux[i].c[0][0] <== levelHashes[i];
        mux[i].c[0][1] <== siblings[i];
        mux[i].c[1][0] <== siblings[i];
        mux[i].c[1][1] <== levelHashes[i];
        mux[i].s <== bits[i];

        hashers[i].inputs[0] <== mux[i].out[0];
        hashers[i].inputs[1] <== mux[i].out[1];

        levelHashes[i + 1] <== hashers[i].out;
    }

    root <== levelHashes[levels];
}

// Main zkT-REX Circuit
template ZKTRex(identityLevels, revocationLevels) {
    // === PRIVATE INPUTS ===
    // Claim data
    signal input claimTopic;
    signal input claimValue;          // e.g., jurisdiction code, accreditation tier
    signal input claimExpirationDate; // Unix timestamp
    signal input claimSecret;         // User's secret for nullifier derivation

    // EdDSA signature of the claim (by trusted issuer)
    signal input sigR8x;
    signal input sigR8y;
    signal input sigS;

    // Identity tree proof
    signal input identityPathElements[identityLevels];
    signal input identityPathIndices[identityLevels];

    // Revocation SMT proof
    signal input revocationSiblings[revocationLevels];

    // === PUBLIC INPUTS ===
    signal input identityRoot;
    signal input revocationRoot;
    signal input currentTimestamp;
    signal input issuerPubKeyAx;  // Trusted issuer public key
    signal input issuerPubKeyAy;
    signal input requiredClaimTopic; // What the token requires

    // === PUBLIC OUTPUTS ===
    signal output valid;

    // --- CHECK 1: Claim topic matches requirement ---
    component topicCheck = IsEqual();
    topicCheck.in[0] <== claimTopic;
    topicCheck.in[1] <== requiredClaimTopic;

    // --- CHECK 2: Claim has not expired ---
    component expiryCheck = LessThan(64);
    expiryCheck.in[0] <== currentTimestamp;
    expiryCheck.in[1] <== claimExpirationDate;

    // --- CHECK 3: EdDSA signature verification ---
    // The issuer signed: Poseidon(claimTopic, claimValue, claimExpirationDate, claimSecret)
    component claimHash = Poseidon(4);
    claimHash.inputs[0] <== claimTopic;
    claimHash.inputs[1] <== claimValue;
    claimHash.inputs[2] <== claimExpirationDate;
    claimHash.inputs[3] <== claimSecret;

    component sigVerifier = EdDSAPoseidonVerifier();
    sigVerifier.enabled <== 1;
    sigVerifier.Ax <== issuerPubKeyAx;
    sigVerifier.Ay <== issuerPubKeyAy;
    sigVerifier.R8x <== sigR8x;
    sigVerifier.R8y <== sigR8y;
    sigVerifier.S <== sigS;
    sigVerifier.M <== claimHash.out;

    // --- CHECK 4: Identity tree inclusion ---
    // The leaf is Poseidon(claimHash, claimSecret) — the identity commitment
    component identityLeaf = Poseidon(2);
    identityLeaf.inputs[0] <== claimHash.out;
    identityLeaf.inputs[1] <== claimSecret;

    component identityProof = MerkleInclusion(identityLevels);
    identityProof.leaf <== identityLeaf.out;
    for (var i = 0; i < identityLevels; i++) {
        identityProof.pathElements[i] <== identityPathElements[i];
        identityProof.pathIndices[i] <== identityPathIndices[i];
    }

    component identityRootCheck = IsEqual();
    identityRootCheck.in[0] <== identityProof.root;
    identityRootCheck.in[1] <== identityRoot;

    // --- CHECK 5: Revocation SMT non-inclusion ---
    // claimNullifier = Poseidon(claimSecret, claimTopic) — deterministic, unique per user+claim
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== claimSecret;
    nullifierHash.inputs[1] <== claimTopic;

    component revocationProof = SMTNonInclusion(revocationLevels);
    revocationProof.claimNullifier <== nullifierHash.out;
    for (var i = 0; i < revocationLevels; i++) {
        revocationProof.siblings[i] <== revocationSiblings[i];
    }

    component revocationRootCheck = IsEqual();
    revocationRootCheck.in[0] <== revocationProof.root;
    revocationRootCheck.in[1] <== revocationRoot;

    // --- FINAL: All checks must pass ---
    signal allChecks;
    allChecks <== topicCheck.out * expiryCheck.out;
    signal allChecks2;
    allChecks2 <== allChecks * identityRootCheck.out;
    signal allChecks3;
    allChecks3 <== allChecks2 * revocationRootCheck.out;

    valid <== allChecks3;
}

// Instantiate with tree heights
// Identity tree: height 20 (supports ~1M identities)
// Revocation tree: height 20 (supports ~1M revocations, state in docs it scales to 256)
component main {public [identityRoot, revocationRoot, currentTimestamp, issuerPubKeyAx, issuerPubKeyAy, requiredClaimTopic]} = ZKTRex(20, 20);
