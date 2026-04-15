/**
 * scripts/check-roots.js
 *
 * Reads the current on-chain roots from HashKey Testnet and prints them
 * as hex. Cross-checks against what an empty tree would produce, and
 * tells you how many identities have been registered.
 *
 *   node scripts/check-roots.js
 *
 * No private key or env vars required — this is a read-only script.
 */

const path = require("path");
const fs = require("fs");
const { ethers } = require("ethers");
const circomlibjs = require("circomlibjs");

// Minimal .env loader (reuse the style from demo-onchain.js)
(function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let v = m[2];
    if (!v.startsWith('"') && !v.startsWith("'")) {
      const hashIdx = v.indexOf("#");
      if (hashIdx >= 0) v = v.slice(0, hashIdx);
    }
    v = v.trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
})();

const RPC_URL = "https://testnet.hsk.xyz";
const EXPLORER = "https://testnet-explorer.hsk.xyz";

const CONTRACTS = {
  identityTreeManager: "0xA763ed1D503c7C36b123A3B8268461A9CA311b16",
  revocationRegistry: "0x0261458Af146a1Fbd718722Af139974aDF2Afe8b",
  zkComplianceModule: "0x5Fe9E99EA98cEF1f66647E5d038bBE539dD3f744",
};

const IDENTITY_TREE_ABI = [
  "function identityRoot() view returns (bytes32)",
  "function identityCount() view returns (uint256)",
];
const REVOCATION_ABI = [
  "function revocationRoot() view returns (bytes32)",
];

const TREE_HEIGHT = 20;

function link(kind, value) {
  return `${EXPLORER}/${kind}/${value}`;
}

function bytes32ToBigInt(hex) {
  return BigInt(hex);
}

function toBytes32Hex(big) {
  return "0x" + big.toString(16).padStart(64, "0");
}

async function computeEmptyRoot() {
  const poseidon = await circomlibjs.buildPoseidon();
  const F = poseidon.F;
  const zeros = [F.toObject(poseidon([BigInt(0)]))];
  for (let i = 1; i <= TREE_HEIGHT; i++) {
    zeros.push(F.toObject(poseidon([zeros[i - 1], zeros[i - 1]])));
  }
  return zeros[TREE_HEIGHT];
}

async function main() {
  console.log("==========================================");
  console.log(" zkT-REX Root Check — HashKey Testnet     ");
  console.log("==========================================\n");

  const provider = new ethers.JsonRpcProvider(RPC_URL);

  const identityTree = new ethers.Contract(
    CONTRACTS.identityTreeManager,
    IDENTITY_TREE_ABI,
    provider
  );
  const revocation = new ethers.Contract(
    CONTRACTS.revocationRegistry,
    REVOCATION_ABI,
    provider
  );

  const [identityRootHex, identityCount, revocationRootHex] = await Promise.all(
    [
      identityTree.identityRoot(),
      identityTree.identityCount(),
      revocation.revocationRoot(),
    ]
  );

  const emptyRoot = await computeEmptyRoot();
  const emptyRootHex = toBytes32Hex(emptyRoot);

  console.log("IdentityTreeManager @", CONTRACTS.identityTreeManager);
  console.log("  ", link("address", CONTRACTS.identityTreeManager));
  console.log("  identityRoot (bytes32):", identityRootHex);
  console.log(
    "  identityRoot (BigInt) :",
    bytes32ToBigInt(identityRootHex).toString()
  );
  console.log("  identityCount         :", identityCount.toString());
  console.log(
    "  is empty-tree root?   :",
    identityRootHex.toLowerCase() === emptyRootHex.toLowerCase() ? "YES" : "no"
  );
  console.log();

  console.log("RevocationRegistry @", CONTRACTS.revocationRegistry);
  console.log("  ", link("address", CONTRACTS.revocationRegistry));
  console.log("  revocationRoot (bytes32):", revocationRootHex);
  console.log(
    "  revocationRoot (BigInt) :",
    bytes32ToBigInt(revocationRootHex).toString()
  );
  console.log(
    "  is empty-tree root?     :",
    revocationRootHex.toLowerCase() === emptyRootHex.toLowerCase() ? "YES" : "no"
  );
  console.log();

  console.log("Reference:");
  console.log("  empty-tree root (bytes32):", emptyRootHex);
  console.log("  empty-tree root (BigInt) :", emptyRoot.toString());
  console.log();

  console.log("ZKComplianceModule @", CONTRACTS.zkComplianceModule);
  console.log("  ", link("address", CONTRACTS.zkComplianceModule));
  console.log(
    "\nThe module's submitProof() will revert with 'Identity root mismatch' or"
  );
  console.log(
    "'Revocation root mismatch' if publicSignals[1] / [2] do not EXACTLY equal"
  );
  console.log("the above on-chain values when re-encoded as bytes32.\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FATAL:", err);
    process.exit(1);
  });
