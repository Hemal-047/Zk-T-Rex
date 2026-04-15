# zkT-REX: Complete Build Instructions for Claude Code

## WHAT YOU ARE BUILDING

zkT-REX is a **zero-knowledge privacy layer for ERC-3643 compliant tokenized securities** on HashKey Chain. It is a hackathon submission for the **ZKID track** of the HashKey Chain On-Chain Horizon Hackathon (deadline: April 15, 2026).

### The One-Line Pitch

> "ERC-3643 makes tokenized securities compliant. We make them private. Without breaking compliance."

### The Problem

ERC-3643 (T-REX) is the dominant token standard for regulated real-world asset (RWA) tokenization — over $32B in assets use it. It enforces compliance by checking investor identity (ONCHAINID) before every transfer. The problem: **every compliance check leaks the investor's identity data on-chain**. Jurisdiction, accreditation status, KYC tier — all publicly visible. For institutional investors (hedge funds, family offices), this is a dealbreaker. Their portfolio composition is proprietary alpha.

### The Solution

zkT-REX replaces ERC-3643's transparent compliance checks with **zero-knowledge proofs**. Investors prove they meet all compliance requirements (valid KYC, correct jurisdiction, not revoked, claim not expired) **without revealing any of those attributes on-chain**. The chain sees: "transfer approved, both parties compliant." It learns nothing about *why* they're compliant or *who* they are.

### Why This Wins

- **No other hackathon submission touches ERC-3643** — all 9 competitors build standalone identity systems
- **Genuine ZK need** — the private data (investor compliance attributes) is truly sensitive for institutions
- **Aligns with HashKey's commercial strategy** — they just launched an RWA tokenization platform using ERC-3643
- **The revocation system (Sparse Merkle Tree)** puts this ahead of every competitor on technical depth
- **HSP integration** earns bonus points (hackathon brief explicitly rewards use of HashKey recommended products)

---

## ARCHITECTURE OVERVIEW

The system has four layers:

```
┌─────────────────────────────────────────────────────┐
│  BROWSER (Client-Side)                               │
│  - ONCHAINID claim storage (local)                   │
│  - Merkle path construction                          │
│  - Groth16 proof generation via snarkjs              │
│  - Frontend UI (Next.js + RainbowKit)                │
└──────────────────┬──────────────────────────────────┘
                   │ proof + public inputs
                   ▼
┌─────────────────────────────────────────────────────┐
│  GROTH16 CIRCUIT (Circom)                            │
│  Three checks in one proof:                          │
│  1. Identity Tree inclusion (Poseidon Merkle)        │
│  2. Revocation SMT non-inclusion (Poseidon SMT)      │
│  3. Claim signature verification (EdDSA/BabyJubJub)  │
│  4. Expiration timestamp check                       │
│  Target: ~25,000 constraints                         │
└──────────────────┬──────────────────────────────────┘
                   │ verified proof
                   ▼
┌─────────────────────────────────────────────────────┐
│  SMART CONTRACTS (HashKey Chain Testnet, ID: 133)     │
│  - Groth16Verifier.sol (auto-generated)              │
│  - ZKComplianceModule.sol (ERC-3643 ICompliance)     │
│  - RevocationRegistry.sol (SMT root management)     │
│  - IdentityTreeManager.sol (Identity root mgmt)     │
│  - RWAToken.sol (ERC-3643 token)                     │
└──────────────────┬──────────────────────────────────┘
                   │ canTransfer() hook
                   ▼
┌─────────────────────────────────────────────────────┐
│  ERC-3643 TOKEN TRANSFER                             │
│  transfer() → canTransfer() → ZK verify → approve   │
└─────────────────────────────────────────────────────┘
```

---

## PROJECT STRUCTURE

```
zktrex/
├── circuits/
│   ├── zktrex.circom              # Main circuit
│   ├── lib/
│   │   ├── merkle.circom          # Merkle inclusion proof
│   │   ├── smt.circom             # SMT non-inclusion proof
│   │   ├── eddsa.circom           # EdDSA signature check
│   │   └── poseidon.circom        # Poseidon hash (import from circomlib)
│   ├── input.json                 # Sample input for testing
│   ├── build/                     # Compiled outputs (generated)
│   └── test/
│       └── circuit.test.js        # Circuit tests
├── contracts/
│   ├── src/
│   │   ├── Groth16Verifier.sol    # Auto-generated from circuit
│   │   ├── ZKComplianceModule.sol # ERC-3643 compliance hook
│   │   ├── RevocationRegistry.sol # SMT root + revoke()
│   │   ├── IdentityTreeManager.sol
│   │   ├── RWAToken.sol           # ERC-3643 token (simplified)
│   │   └── interfaces/
│   │       └── ICompliance.sol    # ERC-3643 compliance interface
│   ├── test/
│   │   └── ZKCompliance.t.sol     # Foundry tests
│   ├── script/
│   │   └── Deploy.s.sol           # Deployment script
│   └── foundry.toml
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx           # Main dashboard
│   │   │   ├── layout.tsx
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── TransferPanel.tsx   # Transfer with ZK proof
│   │   │   ├── ComplianceStatus.tsx
│   │   │   ├── RevocationAdmin.tsx # Issuer revocation panel
│   │   │   ├── ProofGenerator.tsx  # In-browser proving
│   │   │   └── ComparisonDemo.tsx  # Side-by-side standard vs ZK
│   │   ├── lib/
│   │   │   ├── prover.ts          # snarkjs proof generation
│   │   │   ├── merkle.ts          # Merkle tree construction
│   │   │   ├── smt.ts             # Sparse Merkle Tree
│   │   │   ├── contracts.ts       # Contract ABIs + addresses
│   │   │   └── wagmi.ts           # Wallet config
│   │   └── hooks/
│   │       ├── useProof.ts
│   │       └── useCompliance.ts
│   ├── public/
│   │   ├── zktrex.wasm            # Compiled circuit (copy from circuits/build)
│   │   └── zktrex_final.zkey      # Proving key (copy from circuits/build)
│   ├── next.config.js
│   ├── tailwind.config.ts
│   └── package.json
├── scripts/
│   ├── setup-circuit.sh           # Compile circuit + trusted setup
│   ├── generate-verifier.sh       # Generate Solidity verifier
│   ├── deploy.sh                  # Deploy all contracts
│   └── demo-flow.sh               # Run full demo scenario
├── package.json
└── README.md
```

---

## STEP 1: CIRCUIT (Circom)

### Prerequisites

```bash
npm install -g circom snarkjs
# OR install circom from source: https://docs.circom.io/getting-started/installation/
```

### 1.1 Main Circuit: `circuits/zktrex.circom`

```circom
pragma circom 2.1.0;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/eddsaposeidon.circom";
include "node_modules/circomlib/circuits/comparators.circom";
include "node_modules/circomlib/circuits/mux1.circom";

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
    component n2b = Num2Bits(levels);
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
```

### 1.2 Circuit Compilation & Trusted Setup

Create `scripts/setup-circuit.sh`:

```bash
#!/bin/bash
set -e

CIRCUIT_DIR="circuits"
BUILD_DIR="$CIRCUIT_DIR/build"
PTAU_FILE="$BUILD_DIR/pot20_final.ptau"

mkdir -p $BUILD_DIR

echo "=== Step 1: Install circomlib ==="
cd $CIRCUIT_DIR
npm init -y 2>/dev/null || true
npm install circomlib
cd ..

echo "=== Step 2: Compile circuit ==="
circom $CIRCUIT_DIR/zktrex.circom \
  --r1cs --wasm --sym \
  -o $BUILD_DIR \
  -l $CIRCUIT_DIR/node_modules

echo "=== Step 3: Get Powers of Tau ==="
if [ ! -f "$PTAU_FILE" ]; then
  echo "Downloading powers of tau (this takes a minute)..."
  wget -q -O $PTAU_FILE \
    https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_20.ptau
fi

echo "=== Step 4: Generate proving key ==="
snarkjs groth16 setup \
  $BUILD_DIR/zktrex.r1cs \
  $PTAU_FILE \
  $BUILD_DIR/zktrex_0000.zkey

# Contribute to ceremony (use random entropy for hackathon)
snarkjs zkey contribute \
  $BUILD_DIR/zktrex_0000.zkey \
  $BUILD_DIR/zktrex_final.zkey \
  --name="zktrex hackathon" -v -e="$(head -c 64 /dev/urandom | xxd -p)"

echo "=== Step 5: Export verification key ==="
snarkjs zkey export verificationkey \
  $BUILD_DIR/zktrex_final.zkey \
  $BUILD_DIR/verification_key.json

echo "=== Step 6: Generate Solidity verifier ==="
snarkjs zkey export solidityverifier \
  $BUILD_DIR/zktrex_final.zkey \
  contracts/src/Groth16Verifier.sol

echo "=== Step 7: Print circuit info ==="
snarkjs r1cs info $BUILD_DIR/zktrex.r1cs

echo ""
echo "✅ Circuit compiled. Constraint count printed above."
echo "   Copy build/zktrex_js/zktrex.wasm and build/zktrex_final.zkey to frontend/public/"
```

### 1.3 Circuit Test

Create `circuits/test/circuit.test.js`:

```javascript
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
```

---

## STEP 2: SMART CONTRACTS (Foundry)

### 2.1 Setup

```bash
cd contracts
forge init --no-commit
forge install OpenZeppelin/openzeppelin-contracts --no-commit
```

`foundry.toml`:

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.24"
optimizer = true
optimizer_runs = 200

[rpc_endpoints]
hashkey_testnet = "https://testnet.hsk.xyz"
```

### 2.2 ICompliance Interface

`contracts/src/interfaces/ICompliance.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ICompliance - ERC-3643 Compliance Module Interface
/// @notice Simplified interface matching the T-REX compliance hook
interface ICompliance {
    function canTransfer(
        address from,
        address to,
        uint256 amount
    ) external view returns (bool);

    function transferred(
        address from,
        address to,
        uint256 amount
    ) external;

    function created(address to, uint256 amount) external;
    function destroyed(address from, uint256 amount) external;
    function bindToken(address token) external;
    function unbindToken(address token) external;
}
```

### 2.3 Revocation Registry

`contracts/src/RevocationRegistry.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title RevocationRegistry - Sparse Merkle Tree root management for claim revocation
/// @notice Stores the current SMT root. Trusted issuers can revoke claims by updating the root.
/// @dev The actual SMT computation happens off-chain. This contract stores the root commitment.
contract RevocationRegistry {
    bytes32 public revocationRoot;
    address public owner;
    mapping(address => bool) public trustedIssuers;

    event Revoked(bytes32 indexed claimNullifier, bytes32 newRoot);
    event IssuerAdded(address indexed issuer);
    event IssuerRemoved(address indexed issuer);
    event RootUpdated(bytes32 oldRoot, bytes32 newRoot);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyTrustedIssuer() {
        require(trustedIssuers[msg.sender], "Not trusted issuer");
        _;
    }

    constructor(bytes32 _initialRoot) {
        owner = msg.sender;
        revocationRoot = _initialRoot;
    }

    /// @notice Add a trusted KYC issuer who can revoke claims
    function addIssuer(address issuer) external onlyOwner {
        trustedIssuers[issuer] = true;
        emit IssuerAdded(issuer);
    }

    /// @notice Remove a trusted issuer
    function removeIssuer(address issuer) external onlyOwner {
        trustedIssuers[issuer] = false;
        emit IssuerRemoved(issuer);
    }

    /// @notice Revoke a claim by updating the SMT root
    /// @param claimNullifier The nullifier of the claim being revoked (Poseidon hash)
    /// @param newRoot The new SMT root after inserting the revocation
    /// @dev The issuer computes the new root off-chain and submits it.
    ///      In production, you'd verify the SMT update proof on-chain.
    ///      For the hackathon, we trust the issuer's computation.
    function revoke(bytes32 claimNullifier, bytes32 newRoot) external onlyTrustedIssuer {
        bytes32 oldRoot = revocationRoot;
        revocationRoot = newRoot;
        emit Revoked(claimNullifier, newRoot);
        emit RootUpdated(oldRoot, newRoot);
    }

    /// @notice Get the current revocation root
    function getRevocationRoot() external view returns (bytes32) {
        return revocationRoot;
    }
}
```

### 2.4 Identity Tree Manager

`contracts/src/IdentityTreeManager.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IdentityTreeManager - Manages the Merkle root for the identity registry
/// @notice Shadows the ERC-3643 IdentityRegistry with a Poseidon Merkle commitment
contract IdentityTreeManager {
    bytes32 public identityRoot;
    address public owner;
    uint256 public identityCount;

    event IdentityAdded(bytes32 indexed commitment, uint256 index);
    event RootUpdated(bytes32 oldRoot, bytes32 newRoot);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(bytes32 _initialRoot) {
        owner = msg.sender;
        identityRoot = _initialRoot;
    }

    /// @notice Update the identity tree root after adding/removing identities
    /// @param newRoot New Merkle root after tree modification
    /// @param commitment The identity commitment that was added (for event logging)
    function addIdentity(bytes32 newRoot, bytes32 commitment) external onlyOwner {
        bytes32 oldRoot = identityRoot;
        identityRoot = newRoot;
        identityCount++;
        emit IdentityAdded(commitment, identityCount - 1);
        emit RootUpdated(oldRoot, newRoot);
    }

    /// @notice Update root (for removals or batch updates)
    function updateRoot(bytes32 newRoot) external onlyOwner {
        bytes32 oldRoot = identityRoot;
        identityRoot = newRoot;
        emit RootUpdated(oldRoot, newRoot);
    }

    function getIdentityRoot() external view returns (bytes32) {
        return identityRoot;
    }
}
```

### 2.5 ZK Compliance Module

`contracts/src/ZKComplianceModule.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/ICompliance.sol";
import "./RevocationRegistry.sol";
import "./IdentityTreeManager.sol";

/// @title ZKComplianceModule - ZK-powered ERC-3643 compliance module
/// @notice Replaces transparent identity checks with ZK proof verification
/// @dev Implements the ICompliance interface so it drops in to any ERC-3643 token
contract ZKComplianceModule is ICompliance {
    // The auto-generated Groth16 verifier
    address public immutable verifier;
    RevocationRegistry public immutable revocationRegistry;
    IdentityTreeManager public immutable identityTreeManager;

    // Freshness window: proofs must be submitted within this window
    uint256 public freshnessWindow = 1 hours;

    // Track when each address last submitted a valid proof
    mapping(address => uint256) public lastProofTimestamp;

    // The bound token
    address public boundToken;
    address public owner;

    event ProofVerified(address indexed user, uint256 timestamp);
    event TransferChecked(address indexed from, address indexed to, bool result);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(
        address _verifier,
        address _revocationRegistry,
        address _identityTreeManager
    ) {
        verifier = _verifier;
        revocationRegistry = RevocationRegistry(_revocationRegistry);
        identityTreeManager = IdentityTreeManager(_identityTreeManager);
        owner = msg.sender;
    }

    /// @notice Submit a ZK proof of compliance
    /// @dev Called by the user before initiating a transfer
    /// @param proof The Groth16 proof (a, b, c points)
    /// @param publicSignals The public inputs to the circuit
    function submitProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[] calldata publicSignals
    ) external {
        // Public signals order (must match circuit):
        // [0] = valid (output, must be 1)
        // [1] = identityRoot
        // [2] = revocationRoot
        // [3] = currentTimestamp
        // [4] = issuerPubKeyAx
        // [5] = issuerPubKeyAy
        // [6] = requiredClaimTopic

        // Check output is valid
        require(publicSignals[0] == 1, "Proof output: not valid");

        // Check roots match current on-chain state
        require(
            bytes32(publicSignals[1]) == identityTreeManager.getIdentityRoot(),
            "Identity root mismatch"
        );
        require(
            bytes32(publicSignals[2]) == revocationRegistry.getRevocationRoot(),
            "Revocation root mismatch"
        );

        // Check timestamp is recent (within 5 minutes)
        require(
            block.timestamp - publicSignals[3] < 5 minutes,
            "Proof timestamp too old"
        );

        // Verify the Groth16 proof
        // The verifier contract has a verifyProof function auto-generated by snarkjs
        (bool success, bytes memory data) = verifier.staticcall(
            abi.encodeWithSignature(
                "verifyProof(uint256[2],uint256[2][2],uint256[2],uint256[7])",
                a, b, c,
                [publicSignals[0], publicSignals[1], publicSignals[2],
                 publicSignals[3], publicSignals[4], publicSignals[5],
                 publicSignals[6]]
            )
        );
        require(success && abi.decode(data, (bool)), "Invalid ZK proof");

        // Record proof timestamp
        lastProofTimestamp[msg.sender] = block.timestamp;
        emit ProofVerified(msg.sender, block.timestamp);
    }

    /// @notice ERC-3643 compliance hook - called before every transfer
    function canTransfer(
        address from,
        address to,
        uint256 /* amount */
    ) external view override returns (bool) {
        // Both sender and receiver must have recent valid proofs
        bool fromCompliant = (block.timestamp - lastProofTimestamp[from]) < freshnessWindow;
        bool toCompliant = (block.timestamp - lastProofTimestamp[to]) < freshnessWindow;

        bool result = fromCompliant && toCompliant;
        return result;
    }

    // === ERC-3643 interface stubs ===
    function transferred(address, address, uint256) external override {}
    function created(address, uint256) external override {}
    function destroyed(address, uint256) external override {}

    function bindToken(address token) external override onlyOwner {
        boundToken = token;
    }

    function unbindToken(address) external override onlyOwner {
        boundToken = address(0);
    }

    // === Admin ===
    function setFreshnessWindow(uint256 _window) external onlyOwner {
        freshnessWindow = _window;
    }
}
```

### 2.6 Simplified ERC-3643 Token

`contracts/src/RWAToken.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import "./interfaces/ICompliance.sol";

/// @title RWAToken - Simplified ERC-3643 compliant RWA token
/// @notice Implements transfer restrictions via a pluggable compliance module
/// @dev Simplified from full T-REX for hackathon scope. Demonstrates the compliance hook pattern.
contract RWAToken is ERC20 {
    ICompliance public compliance;
    address public owner;
    address public agent; // Authorized minter/burner

    mapping(address => bool) public frozen;

    event ComplianceUpdated(address indexed oldCompliance, address indexed newCompliance);
    event AddressFrozen(address indexed user, bool isFrozen);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyAgent() {
        require(msg.sender == agent || msg.sender == owner, "Not agent");
        _;
    }

    constructor(
        string memory name,
        string memory symbol,
        address _compliance
    ) ERC20(name, symbol) {
        owner = msg.sender;
        agent = msg.sender;
        compliance = ICompliance(_compliance);
    }

    /// @notice Override transfer to enforce compliance
    function transfer(address to, uint256 amount) public override returns (bool) {
        require(!frozen[msg.sender], "Sender frozen");
        require(!frozen[to], "Receiver frozen");
        require(
            compliance.canTransfer(msg.sender, to, amount),
            "Transfer not compliant"
        );
        bool success = super.transfer(to, amount);
        if (success) {
            compliance.transferred(msg.sender, to, amount);
        }
        return success;
    }

    /// @notice Override transferFrom to enforce compliance
    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        require(!frozen[from], "Sender frozen");
        require(!frozen[to], "Receiver frozen");
        require(
            compliance.canTransfer(from, to, amount),
            "Transfer not compliant"
        );
        bool success = super.transferFrom(from, to, amount);
        if (success) {
            compliance.transferred(from, to, amount);
        }
        return success;
    }

    // === Admin functions ===

    function mint(address to, uint256 amount) external onlyAgent {
        _mint(to, amount);
        compliance.created(to, amount);
    }

    function burn(address from, uint256 amount) external onlyAgent {
        _burn(from, amount);
        compliance.destroyed(from, amount);
    }

    function setCompliance(address _compliance) external onlyOwner {
        address old = address(compliance);
        compliance = ICompliance(_compliance);
        emit ComplianceUpdated(old, _compliance);
    }

    function setAgent(address _agent) external onlyOwner {
        agent = _agent;
    }

    function freezeAddress(address user, bool freeze) external onlyAgent {
        frozen[user] = freeze;
        emit AddressFrozen(user, freeze);
    }
}
```

### 2.7 Deploy Script

`contracts/script/Deploy.s.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/Groth16Verifier.sol";
import "../src/RevocationRegistry.sol";
import "../src/IdentityTreeManager.sol";
import "../src/ZKComplianceModule.sol";
import "../src/RWAToken.sol";

contract DeployZKTRex is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Groth16 Verifier (auto-generated)
        Groth16Verifier verifier = new Groth16Verifier();
        console.log("Groth16Verifier:", address(verifier));

        // 2. Deploy Revocation Registry with empty tree root
        // Compute empty SMT root off-chain and paste here
        bytes32 emptyRevocationRoot = bytes32(0); // REPLACE with actual empty root
        RevocationRegistry revocation = new RevocationRegistry(emptyRevocationRoot);
        console.log("RevocationRegistry:", address(revocation));

        // 3. Deploy Identity Tree Manager with empty tree root
        bytes32 emptyIdentityRoot = bytes32(0); // REPLACE with actual empty root
        IdentityTreeManager identity = new IdentityTreeManager(emptyIdentityRoot);
        console.log("IdentityTreeManager:", address(identity));

        // 4. Deploy ZK Compliance Module
        ZKComplianceModule compliance = new ZKComplianceModule(
            address(verifier),
            address(revocation),
            address(identity)
        );
        console.log("ZKComplianceModule:", address(compliance));

        // 5. Deploy RWA Token
        RWAToken token = new RWAToken(
            "HashKey Tokenized Bond",
            "hkBOND",
            address(compliance)
        );
        console.log("RWAToken:", address(token));

        // 6. Bind token to compliance module
        compliance.bindToken(address(token));

        // 7. Add deployer as trusted issuer on RevocationRegistry
        revocation.addIssuer(vm.addr(deployerPrivateKey));

        // 8. Mint initial supply to deployer for demo
        token.mint(vm.addr(deployerPrivateKey), 1_000_000 * 1e18);

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("Chain: HashKey Testnet (133)");
        console.log("Explorer: https://testnet-explorer.hsk.xyz");
    }
}
```

Deploy command:

```bash
source .env  # PRIVATE_KEY=0x...
forge script script/Deploy.s.sol:DeployZKTRex \
  --rpc-url https://testnet.hsk.xyz \
  --broadcast \
  --verify
```

### 2.8 Foundry Tests

`contracts/test/ZKCompliance.t.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/RevocationRegistry.sol";
import "../src/IdentityTreeManager.sol";
import "../src/ZKComplianceModule.sol";
import "../src/RWAToken.sol";

contract ZKComplianceTest is Test {
    RevocationRegistry revocation;
    IdentityTreeManager identity;
    ZKComplianceModule compliance;
    RWAToken token;
    address mockVerifier;

    address alice = address(0x1);
    address bob = address(0x2);
    address issuer = address(0x3);

    function setUp() public {
        // Deploy mock verifier that always returns true (for unit tests)
        mockVerifier = address(new MockVerifier());

        revocation = new RevocationRegistry(bytes32(uint256(1)));
        identity = new IdentityTreeManager(bytes32(uint256(2)));
        compliance = new ZKComplianceModule(
            mockVerifier,
            address(revocation),
            address(identity)
        );
        token = new RWAToken("Test Bond", "tBOND", address(compliance));
        compliance.bindToken(address(token));

        // Setup issuer
        revocation.addIssuer(issuer);

        // Mint tokens to alice
        token.mint(alice, 1000 * 1e18);
    }

    function testCannotTransferWithoutProof() public {
        vm.prank(alice);
        vm.expectRevert("Transfer not compliant");
        token.transfer(bob, 100 * 1e18);
    }

    function testCanTransferAfterBothPartiesProve() public {
        // Simulate proof submission (mock verifier accepts all)
        _submitMockProof(alice);
        _submitMockProof(bob);

        vm.prank(alice);
        token.transfer(bob, 100 * 1e18);

        assertEq(token.balanceOf(bob), 100 * 1e18);
    }

    function testProofExpiresAfterFreshnessWindow() public {
        _submitMockProof(alice);
        _submitMockProof(bob);

        // Warp past freshness window
        vm.warp(block.timestamp + 2 hours);

        vm.prank(alice);
        vm.expectRevert("Transfer not compliant");
        token.transfer(bob, 100 * 1e18);
    }

    function testFreezeAddress() public {
        _submitMockProof(alice);
        _submitMockProof(bob);

        token.freezeAddress(alice, true);

        vm.prank(alice);
        vm.expectRevert("Sender frozen");
        token.transfer(bob, 100 * 1e18);
    }

    function testRevocationUpdatesRoot() public {
        bytes32 newRoot = bytes32(uint256(99));
        vm.prank(issuer);
        revocation.revoke(bytes32(uint256(42)), newRoot);

        assertEq(revocation.revocationRoot(), newRoot);
    }

    function testOnlyIssuerCanRevoke() public {
        vm.prank(alice);
        vm.expectRevert("Not trusted issuer");
        revocation.revoke(bytes32(uint256(42)), bytes32(uint256(99)));
    }

    function testOnlyOwnerCanAddIssuer() public {
        vm.prank(alice);
        vm.expectRevert("Not owner");
        revocation.addIssuer(alice);
    }

    function _submitMockProof(address user) internal {
        uint256[2] memory a = [uint256(0), uint256(0)];
        uint256[2][2] memory b = [[uint256(0), uint256(0)], [uint256(0), uint256(0)]];
        uint256[2] memory c = [uint256(0), uint256(0)];
        uint256[] memory signals = new uint256[](7);
        signals[0] = 1; // valid
        signals[1] = uint256(identity.getIdentityRoot());
        signals[2] = uint256(revocation.getRevocationRoot());
        signals[3] = block.timestamp;

        vm.prank(user);
        compliance.submitProof(a, b, c, signals);
    }
}

/// @notice Mock verifier that always returns true (for unit testing)
contract MockVerifier {
    fallback() external {
        assembly {
            mstore(0, 1)
            return(0, 32)
        }
    }
}
```

---

## STEP 3: FRONTEND (Next.js)

### 3.1 Setup

```bash
npx create-next-app@latest frontend --typescript --tailwind --app --src-dir
cd frontend
npm install @rainbow-me/rainbowkit wagmi viem @tanstack/react-query snarkjs
npm install circomlibjs  # For Merkle tree construction in browser
```

### 3.2 Wagmi Config

`frontend/src/lib/wagmi.ts`:

```typescript
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";

export const hashkeyTestnet = defineChain({
  id: 133,
  name: "HashKey Chain Testnet",
  nativeCurrency: { name: "HSK", symbol: "HSK", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet.hsk.xyz"] },
  },
  blockExplorers: {
    default: { name: "HashKey Explorer", url: "https://testnet-explorer.hsk.xyz" },
  },
  testnet: true,
});

export const config = getDefaultConfig({
  appName: "zkT-REX",
  projectId: "YOUR_WALLETCONNECT_PROJECT_ID", // Get from cloud.walletconnect.com
  chains: [hashkeyTestnet],
});
```

### 3.3 Proof Generation Library

`frontend/src/lib/prover.ts`:

```typescript
import * as snarkjs from "snarkjs";

export interface ProofInputs {
  // Private
  claimTopic: string;
  claimValue: string;
  claimExpirationDate: string;
  claimSecret: string;
  sigR8x: string;
  sigR8y: string;
  sigS: string;
  identityPathElements: string[];
  identityPathIndices: number[];
  revocationSiblings: string[];
  // Public
  identityRoot: string;
  revocationRoot: string;
  currentTimestamp: string;
  issuerPubKeyAx: string;
  issuerPubKeyAy: string;
  requiredClaimTopic: string;
}

export interface GeneratedProof {
  a: [string, string];
  b: [[string, string], [string, string]];
  c: [string, string];
  publicSignals: string[];
}

export async function generateProof(inputs: ProofInputs): Promise<GeneratedProof> {
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    inputs,
    "/zktrex.wasm",        // Served from public/
    "/zktrex_final.zkey"   // Served from public/
  );

  // Format for Solidity
  const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
  const argv = calldata
    .replace(/["[\]\s]/g, "")
    .split(",")
    .map((x: string) => BigInt(x).toString());

  const a: [string, string] = [argv[0], argv[1]];
  const b: [[string, string], [string, string]] = [
    [argv[2], argv[3]],
    [argv[4], argv[5]],
  ];
  const c: [string, string] = [argv[6], argv[7]];

  return { a, b, c, publicSignals };
}
```

### 3.4 Sparse Merkle Tree Library

`frontend/src/lib/smt.ts`:

```typescript
// Sparse Merkle Tree implementation for revocation checks
// Uses Poseidon hash from circomlibjs

export class SparseMerkleTree {
  private tree: Map<string, bigint>;
  private height: number;
  private poseidon: any;
  private F: any;
  private zeroHashes: bigint[];

  constructor(height: number, poseidon: any) {
    this.height = height;
    this.poseidon = poseidon;
    this.F = poseidon.F;
    this.tree = new Map();

    // Precompute zero hashes
    this.zeroHashes = [this.F.toObject(poseidon([BigInt(0)]))];
    for (let i = 1; i <= height; i++) {
      this.zeroHashes.push(
        this.F.toObject(poseidon([this.zeroHashes[i - 1], this.zeroHashes[i - 1]]))
      );
    }
  }

  getRoot(): bigint {
    return this._getNode(this.height, BigInt(0));
  }

  insert(index: bigint, value: bigint): void {
    const key = `${this.height}:${index}`;
    // Store the leaf value
    this.tree.set(`0:${index}`, value);
    // Invalidate cached nodes up the tree
    this._invalidatePath(index);
  }

  getSiblings(index: bigint): bigint[] {
    const siblings: bigint[] = [];
    let currentIndex = index;

    for (let level = 0; level < this.height; level++) {
      const siblingIndex = currentIndex ^ BigInt(1);
      siblings.push(this._getNode(level, siblingIndex));
      currentIndex = currentIndex >> BigInt(1);
    }

    return siblings;
  }

  getNonInclusionProof(index: bigint): { siblings: string[]; root: string } {
    // For non-inclusion, the leaf at index must be 0 (empty)
    const leafKey = `0:${index}`;
    const leafValue = this.tree.get(leafKey) || BigInt(0);
    if (leafValue !== BigInt(0)) {
      throw new Error("Cannot prove non-inclusion: leaf is occupied (user is revoked)");
    }

    const siblings = this.getSiblings(index);
    return {
      siblings: siblings.map((s) => s.toString()),
      root: this.getRoot().toString(),
    };
  }

  private _getNode(level: number, index: bigint): bigint {
    const key = `${level}:${index}`;
    if (this.tree.has(key)) {
      return this.tree.get(key)!;
    }

    if (level === 0) {
      // Leaf level: hash of 0 for empty, hash of value for occupied
      const rawValue = this.tree.get(`0:${index}`) || BigInt(0);
      return this.F.toObject(this.poseidon([rawValue]));
    }

    // Internal node: hash of children
    const leftChild = this._getNode(level - 1, index * BigInt(2));
    const rightChild = this._getNode(level - 1, index * BigInt(2) + BigInt(1));

    if (leftChild === this.zeroHashes[level - 1] && rightChild === this.zeroHashes[level - 1]) {
      return this.zeroHashes[level];
    }

    const hash = this.F.toObject(this.poseidon([leftChild, rightChild]));
    this.tree.set(key, hash);
    return hash;
  }

  private _invalidatePath(leafIndex: bigint): void {
    let currentIndex = leafIndex;
    for (let level = 1; level <= this.height; level++) {
      currentIndex = currentIndex >> BigInt(1);
      this.tree.delete(`${level}:${currentIndex}`);
    }
  }
}
```

### 3.5 Contract Addresses & ABIs

`frontend/src/lib/contracts.ts`:

```typescript
// IMPORTANT: Replace these with actual deployed addresses after running Deploy.s.sol
export const CONTRACTS = {
  groth16Verifier: "0x...",
  revocationRegistry: "0x...",
  identityTreeManager: "0x...",
  zkComplianceModule: "0x...",
  rwaToken: "0x...",
} as const;

// ABIs - import from contract artifacts after compilation
// For hackathon speed: paste the relevant function ABIs inline
export const ZK_COMPLIANCE_ABI = [
  {
    inputs: [
      { name: "a", type: "uint256[2]" },
      { name: "b", type: "uint256[2][2]" },
      { name: "c", type: "uint256[2]" },
      { name: "publicSignals", type: "uint256[]" },
    ],
    name: "submitProof",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "canTransfer",
    outputs: [{ type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "", type: "address" }],
    name: "lastProofTimestamp",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const REVOCATION_ABI = [
  {
    inputs: [
      { name: "claimNullifier", type: "bytes32" },
      { name: "newRoot", type: "bytes32" },
    ],
    name: "revoke",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "revocationRoot",
    outputs: [{ type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const RWA_TOKEN_ABI = [
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
```

### 3.6 Main Page Layout

`frontend/src/app/page.tsx`:

Build a dashboard with THREE main panels:

1. **Compliance Status Panel** — Shows the connected wallet's current compliance status (last proof timestamp, whether it's within the freshness window, the current identity root and revocation root from the chain).

2. **Transfer Panel** — A form to transfer RWA tokens. Before transferring, the user clicks "Generate ZK Proof" which runs snarkjs in-browser, then submits the proof to the ZKComplianceModule, then executes the transfer. Show a step-by-step progress indicator: "Generating proof..." → "Submitting proof..." → "Executing transfer..." → "Complete!"

3. **Revocation Admin Panel** (for issuer demo) — A form where the issuer can enter a claimNullifier and revoke it. Shows the current revocation root and updates it. This demonstrates the "kill switch" in the pitch.

**Design notes:**
- Use a dark, institutional aesthetic — this is for financial institutions, not consumer crypto
- Show the HashKey Chain testnet explorer links for every transaction
- Include a "Standard ERC-3643 vs zkT-REX" comparison toggle that shows what data is visible on-chain in each mode
- The proof generation should show a real-time constraint satisfaction animation or at minimum a progress spinner with "Generating Groth16 proof (~3-5 seconds)..."

### 3.7 Key UI Component: Comparison Demo

`frontend/src/components/ComparisonDemo.tsx`:

This is the MOST IMPORTANT component for the pitch. It shows two columns side by side:

**Left column: "Standard ERC-3643 Transfer"**
- Shows: Sender ONCHAINID address, claim topics (KYC_VERIFIED, JURISDICTION), claim values (HK, ACCREDITED), trusted issuer address, identity registry lookup
- All in red/warning styling — "All identity data visible on-chain"

**Right column: "zkT-REX Transfer"**  
- Shows: ZK Proof hash, "Verified: true", identityRoot, revocationRoot
- All in green/success styling — "Zero identity data exposed"
- The actual claim topics, values, and issuer are replaced with "██████" or "[PRIVATE]"

This visual contrast is what wins the pitch in 5 minutes.

---

## STEP 4: DEPLOYMENT & TESTING FLOW

### 4.1 HashKey Testnet Setup

```bash
# Get testnet HSK tokens from faucet
# https://faucet.hsk.xyz/

# Network details:
# Chain ID: 133
# RPC: https://testnet.hsk.xyz
# Explorer: https://testnet-explorer.hsk.xyz
```

### 4.2 Full Demo Script

Create `scripts/demo-flow.sh` that does the following end-to-end:

```
1. Deploy all contracts
2. Register a trusted issuer
3. Create issuer EdDSA keypair (off-chain)
4. Issue a KYC claim to Alice (sign with EdDSA, add to identity tree)
5. Issue a KYC claim to Bob
6. Alice generates ZK proof in Node.js (simulating browser)
7. Alice submits proof to ZKComplianceModule
8. Bob generates and submits proof
9. Alice transfers 100 hkBOND tokens to Bob — SUCCESS
10. Issuer revokes Alice's claim (update revocation SMT)
11. Alice tries to generate a new proof — FAILS (revoked)
12. Alice tries to transfer — FAILS ("Transfer not compliant")
```

This script should output all transaction hashes and explorer links.

---

## STEP 5: DOCUMENTATION

### 5.1 README.md

The README must include:

1. **One-paragraph description** — what zkT-REX is and why it matters
2. **The problem** — ERC-3643 privacy leak explained in 3 sentences
3. **Architecture diagram** — ASCII art of the dual-tree system
4. **Deployed contract addresses** — with HashKey testnet explorer links
5. **Constraint count** — from `snarkjs r1cs info`
6. **How to run locally** — step-by-step
7. **Demo video link** — (record separately)
8. **Tech stack** — Circom, Groth16, snarkjs, Solidity 0.8.24, Foundry, Next.js 15, RainbowKit, Poseidon, EdDSA/BabyJubJub
9. **Hackathon track** — ZKID (primary), with DeFi as secondary (RWA compliance)
10. **Team info**

### 5.2 Key Stats to Include in README

After building, capture these numbers:
- Total constraint count (target: ~25,000)
- Number of smart contracts deployed
- Number of passing tests (circuit + contract + e2e)
- Proof generation time (in-browser)
- Verification gas cost (on-chain)
- Tree heights used (20 for demo, scales to 256 for production)

---

## STEP 6: SUBMISSION CHECKLIST

Per the hackathon requirements:

- [ ] Code viewable on GitHub
- [ ] README with deployed HashKey Chain contract addresses
- [ ] Links to HashKey Chain Testnet Explorer for each contract
- [ ] Short video describing scope and functionality
- [ ] Project registered on DoraHacks before April 15, 23:59 GMT+8
- [ ] Built on HashKey Chain (Chain ID 133)
- [ ] Aligned with ZKID track

---

## CRITICAL IMPLEMENTATION NOTES

### Circuit Simplification Fallback

If the full circuit (identity + revocation + EdDSA) doesn't compile or hits issues:

**Fallback 1:** Drop EdDSA signature verification. Use Poseidon hash of claim data as the commitment instead of a signed claim. This removes ~5,000 constraints and the EdDSA dependency. The identity and revocation proofs still work — you just lose the "issuer signed this claim" guarantee. Mention in docs that EdDSA is on the production roadmap.

**Fallback 2:** Drop the SMT revocation check. Use only the identity Merkle inclusion proof with an expiration timestamp. This is still more than most competitors have. Add revocation as a documented architecture feature with contract stubs deployed.

**Fallback 3:** If Circom compilation fails entirely, use a simplified circuit that just does Merkle membership (like Semaphore). This is the minimum viable ZK. Deploy all contracts with a mock verifier for the demo, and have the real circuit as "in progress" in the repo.

### Priority Order

1. Get ERC-3643 token deployed and transferable (even without ZK) — this is your safety net
2. Get the Circom circuit compiling and proving
3. Get the Solidity verifier deployed and accepting proofs
4. Build the frontend with proof generation
5. Add the revocation flow
6. Polish the comparison demo
7. Record the video

### Gas Considerations

- Groth16 verification costs ~200k-300k gas on EVM
- HashKey Chain testnet gas is free/cheap
- Store only roots on-chain, never full trees
- The ZKComplianceModule.submitProof() is the gas-heavy call; canTransfer() is a cheap view function

### snarkjs in Browser

- The .wasm and .zkey files need to be served as static assets
- .zkey files can be 50-100MB for complex circuits — use the `pot20` powers of tau (sufficient for ~1M constraints)
- First proof generation is slow (5-10s) due to WASM compilation; subsequent proofs are faster
- Use a Web Worker to avoid blocking the UI thread

### Poseidon vs Keccak

- Use Poseidon EVERYWHERE in the circuit (it's ~20x cheaper in constraints than Keccak)
- Use Keccak only in Solidity contracts where it's a native opcode
- The roots stored on-chain are Poseidon hashes — the contracts store them as bytes32

---

## THE PITCH SCRIPT (for demo video / live pitch)

**Opening (15 seconds):**
"ERC-3643 is the gold standard for tokenized securities — $32 billion in assets use it. But it has a fatal privacy flaw. Every compliance check exposes investor identity data on-chain. We fixed that."

**The Problem (30 seconds):**
Show a standard ERC-3643 transfer on the block explorer. Point at the identity registry lookup. "Here's Alice's KYC status, her jurisdiction, her accreditation tier. All public. For institutional investors, this is a dealbreaker."

**The Solution (30 seconds):**
"zkT-REX replaces transparent compliance checks with zero-knowledge proofs. Same compliance guarantees. Zero identity data on-chain." Show the zkT-REX transfer. Point at the transaction — proof verified, no identity data visible.

**The Revocation Kill-Switch (30 seconds):**
"But compliance isn't static. What happens when a user's KYC expires or they fail an AML check?" Click revoke. Show Alice's next proof generation failing. "One transaction. Instant cryptographic revocation. No identity revealed. No SBT burned. The user simply can't prove non-inclusion in the revocation tree anymore."

**Technical Depth (30 seconds):**
"Our circuit combines three proofs: identity Merkle inclusion, revocation SMT non-inclusion, and EdDSA claim signature verification — all in a single Groth16 proof at ~25,000 constraints. The dual-tree architecture separates identity from revocation, enabling real-time compliance without sacrificing privacy."

**Closing (15 seconds):**
"zkT-REX turns ERC-3643 from compliant-but-exposed to compliant-and-private. We're not building a new identity standard — we're upgrading the one that $32 billion already trusts."

---

## ENVIRONMENT VARIABLES

Create `.env` in the project root:

```
PRIVATE_KEY=0x...             # Deployer private key (HashKey testnet)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...  # From cloud.walletconnect.com
```

Get testnet HSK from: https://faucet.hsk.xyz/
