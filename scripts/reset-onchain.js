/**
 * scripts/reset-onchain.js
 *
 * Resets the IdentityTreeManager and RevocationRegistry on HashKey
 * Testnet back to the empty-tree roots. Use this when the in-memory
 * server state has diverged from chain (cold start scenario) and you
 * want a clean slate so /api/get-proof-inputs stops returning 409s.
 *
 *   node scripts/reset-onchain.js
 *
 * Requires PRIVATE_KEY in .env. The signer must own IdentityTreeManager
 * (for updateRoot) and must be a trusted issuer on RevocationRegistry
 * (for revoke). The deployer satisfies both.
 */

const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const circomlibjs = require("circomlibjs");

// Minimal .env loader
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
};

const IDENTITY_TREE_ABI = [
  "function identityRoot() view returns (bytes32)",
  "function identityCount() view returns (uint256)",
  "function updateRoot(bytes32 newRoot) external",
  "function owner() view returns (address)",
];
const REVOCATION_ABI = [
  "function revocationRoot() view returns (bytes32)",
  "function revoke(bytes32 claimNullifier, bytes32 newRoot) external",
  "function trustedIssuers(address) view returns (bool)",
  "function addIssuer(address issuer) external",
  "function owner() view returns (address)",
];

const TREE_HEIGHT = 20;
const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

function link(kind, value) {
  return `${EXPLORER}/${kind}/${value}`;
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

async function waitTx(tx, label) {
  console.log(`  -> ${label} submitted: ${tx.hash}`);
  console.log(`     ${link("tx", tx.hash)}`);
  const receipt = await tx.wait();
  console.log(
    `     mined in block ${receipt.blockNumber}, gas used ${receipt.gasUsed.toString()}\n`
  );
  return receipt;
}

async function main() {
  console.log("==========================================");
  console.log(" zkT-REX On-Chain Reset — HashKey Testnet ");
  console.log("==========================================\n");

  if (!process.env.PRIVATE_KEY) {
    console.error("ERROR: PRIVATE_KEY not set in .env");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  console.log("Signer:", wallet.address);
  console.log("  ", link("address", wallet.address));
  const balance = await provider.getBalance(wallet.address);
  console.log(`  balance: ${ethers.formatEther(balance)} HSK\n`);

  const identityTree = new ethers.Contract(
    CONTRACTS.identityTreeManager,
    IDENTITY_TREE_ABI,
    wallet
  );
  const revocation = new ethers.Contract(
    CONTRACTS.revocationRegistry,
    REVOCATION_ABI,
    wallet
  );

  const emptyRoot = await computeEmptyRoot();
  const emptyRootHex = toBytes32Hex(emptyRoot);
  console.log("Target empty-tree root:", emptyRootHex);
  console.log("  (BigInt) ", emptyRoot.toString(), "\n");

  // ---- Pre-state ----
  const [beforeIdentityRoot, beforeIdentityCount, beforeRevocationRoot] =
    await Promise.all([
      identityTree.identityRoot(),
      identityTree.identityCount(),
      revocation.revocationRoot(),
    ]);
  console.log("Before:");
  console.log("  identityRoot  :", beforeIdentityRoot);
  console.log("  identityCount :", beforeIdentityCount.toString());
  console.log("  revocationRoot:", beforeRevocationRoot, "\n");

  // ---- Sanity: permissions ----
  const identityOwner = await identityTree.owner();
  if (identityOwner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.error(
      `ERROR: signer ${wallet.address} is not the owner of IdentityTreeManager (owner: ${identityOwner}). Cannot call updateRoot.`
    );
    process.exit(1);
  }
  const isIssuer = await revocation.trustedIssuers(wallet.address);
  if (!isIssuer) {
    console.log(
      "Signer is not a trusted issuer on RevocationRegistry. Adding..."
    );
    const revOwner = await revocation.owner();
    if (revOwner.toLowerCase() !== wallet.address.toLowerCase()) {
      console.error(
        `ERROR: signer is neither a trusted issuer nor the owner of RevocationRegistry (owner: ${revOwner}). Cannot revoke.`
      );
      process.exit(1);
    }
    const addTx = await revocation.addIssuer(wallet.address);
    await waitTx(addTx, "addIssuer (self)");
  }

  // ---- Step 1: reset identityRoot ----
  if (beforeIdentityRoot.toLowerCase() === emptyRootHex.toLowerCase()) {
    console.log("Identity root is already empty — skipping updateRoot.\n");
  } else {
    console.log("Step 1: IdentityTreeManager.updateRoot(emptyRoot)");
    const tx = await identityTree.updateRoot(emptyRootHex);
    await waitTx(tx, "updateRoot");
  }

  // ---- Step 2: reset revocationRoot ----
  // The revoke(bytes32,bytes32) method unconditionally sets the new
  // root — passing a zero nullifier is the same pattern the existing
  // /api/reset-revocation route uses for this purpose.
  if (beforeRevocationRoot.toLowerCase() === emptyRootHex.toLowerCase()) {
    console.log("Revocation root is already empty — skipping revoke.\n");
  } else {
    console.log(
      "Step 2: RevocationRegistry.revoke(bytes32(0), emptyRoot) [reset pattern]"
    );
    const tx = await revocation.revoke(ZERO_BYTES32, emptyRootHex);
    await waitTx(tx, "revoke (reset)");
  }

  // ---- Post-state ----
  const [afterIdentityRoot, afterIdentityCount, afterRevocationRoot] =
    await Promise.all([
      identityTree.identityRoot(),
      identityTree.identityCount(),
      revocation.revocationRoot(),
    ]);
  console.log("After:");
  console.log("  identityRoot  :", afterIdentityRoot);
  console.log("  identityCount :", afterIdentityCount.toString());
  console.log("  revocationRoot:", afterRevocationRoot, "\n");

  const identityOk =
    afterIdentityRoot.toLowerCase() === emptyRootHex.toLowerCase();
  const revocationOk =
    afterRevocationRoot.toLowerCase() === emptyRootHex.toLowerCase();

  console.log("Identity root matches empty tree:  ", identityOk ? "YES" : "NO");
  console.log("Revocation root matches empty tree:", revocationOk ? "YES" : "NO");

  if (!identityOk || !revocationOk) {
    console.error(
      "\nFAIL: at least one root did not reset. Investigate before retrying."
    );
    process.exit(1);
  }

  console.log(
    "\nSUCCESS — on-chain state is fresh. Note: identityCount does NOT reset (it's cumulative in the contract) but the root is what matters for proof verification."
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nFATAL:", err);
    process.exit(1);
  });
