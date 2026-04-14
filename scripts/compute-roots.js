const circomlibjs = require("circomlibjs");

async function main() {
  const poseidon = await circomlibjs.buildPoseidon();
  const F = poseidon.F;

  const TREE_HEIGHT = 20;

  // Compute zero hashes — shared by both trees
  // Level 0: hash of zero (empty leaf)
  const zeroHashes = [F.toObject(poseidon([BigInt(0)]))];
  for (let i = 1; i <= TREE_HEIGHT; i++) {
    zeroHashes.push(F.toObject(poseidon([zeroHashes[i - 1], zeroHashes[i - 1]])));
  }

  // === Identity Merkle Tree (empty) ===
  // An empty tree of height 20 has all leaves = zeroHashes[0]
  // The root is zeroHashes[20]
  const emptyIdentityRoot = zeroHashes[TREE_HEIGHT];

  // === Sparse Merkle Tree (empty, for revocation) ===
  // Same structure: empty SMT with all leaves = 0, hashed identically
  // The root is also zeroHashes[20] since the tree structure is the same
  const emptyRevocationRoot = zeroHashes[TREE_HEIGHT];

  // Convert to bytes32 hex (left-padded to 32 bytes)
  function toBytes32Hex(bigIntVal) {
    return "0x" + bigIntVal.toString(16).padStart(64, "0");
  }

  console.log("=== Empty Tree Roots (height 20, Poseidon hash) ===\n");
  console.log("Identity Merkle Tree root:");
  console.log("  BigInt:", emptyIdentityRoot.toString());
  console.log("  bytes32:", toBytes32Hex(emptyIdentityRoot));
  console.log("");
  console.log("Revocation SMT root:");
  console.log("  BigInt:", emptyRevocationRoot.toString());
  console.log("  bytes32:", toBytes32Hex(emptyRevocationRoot));
  console.log("");
  console.log("Zero hashes per level (for reference):");
  for (let i = 0; i <= 3; i++) {
    console.log(`  Level ${i}: ${zeroHashes[i].toString()}`);
  }
  console.log("  ...");
  console.log(`  Level ${TREE_HEIGHT}: ${zeroHashes[TREE_HEIGHT].toString()}`);

  // Also export for programmatic use
  console.log("\n=== For Deploy.s.sol ===");
  console.log(`bytes32 emptyIdentityRoot = ${toBytes32Hex(emptyIdentityRoot)};`);
  console.log(`bytes32 emptyRevocationRoot = ${toBytes32Hex(emptyRevocationRoot)};`);
}

main().catch(console.error);
