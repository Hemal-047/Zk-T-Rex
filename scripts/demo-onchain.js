/**
 * zkT-REX On-Chain Demo
 *
 * Full end-to-end demonstration on HashKey Chain Testnet:
 *  1. Add the demo identity to the IdentityTreeManager on-chain
 *  2. Generate a Groth16 proof via snarkjs (browser-compatible pipeline)
 *  3. Submit the proof to ZKComplianceModule.submitProof()
 *  4. Verify canTransfer() returns true for the deployer (self-transfer)
 *  5. Execute an actual hkBOND transfer that passes the compliance hook
 *  6. Revoke the claim via RevocationRegistry.revoke()
 *  7. Generate a new proof with the updated revocation root and show it fails
 *
 * Prints every transaction hash with an explorer link for easy verification.
 */

const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const snarkjs = require("snarkjs");
const circomlibjs = require("circomlibjs");
// Minimal .env loader (avoid dotenv dependency)
(function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let v = m[2];
    // Strip inline comments unless value is quoted
    if (!v.startsWith('"') && !v.startsWith("'")) {
      const hashIdx = v.indexOf("#");
      if (hashIdx >= 0) v = v.slice(0, hashIdx);
    }
    v = v.trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
})();

// === Deployed contract addresses (HashKey Testnet, chain ID 133) ===
const CONTRACTS = {
  groth16Verifier: "0xC65EeAbCD9B10dD3c11a5f5bb5DBd7C83D716386",
  revocationRegistry: "0x0261458Af146a1Fbd718722Af139974aDF2Afe8b",
  identityTreeManager: "0xA763ed1D503c7C36b123A3B8268461A9CA311b16",
  zkComplianceModule: "0x5Fe9E99EA98cEF1f66647E5d038bBE539dD3f744",
  rwaToken: "0x2F4647adf1824e87FaAc34531CB320206cd72151",
};

const RPC_URL = "https://testnet.hsk.xyz";
const EXPLORER = "https://testnet-explorer.hsk.xyz";

// === Minimal ABIs ===
const IDENTITY_TREE_ABI = [
  "function addIdentity(bytes32 newRoot, bytes32 commitment) external",
  "function getIdentityRoot() external view returns (bytes32)",
];

const REVOCATION_ABI = [
  "function revoke(bytes32 claimNullifier, bytes32 newRoot) external",
  "function getRevocationRoot() external view returns (bytes32)",
  "function addIssuer(address issuer) external",
  "function trustedIssuers(address) external view returns (bool)",
];

const ZK_COMPLIANCE_ABI = [
  "function submitProof(uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[] publicSignals) external",
  "function canTransfer(address from, address to, uint256 amount) external view returns (bool)",
  "function lastProofTimestamp(address) external view returns (uint256)",
];

const RWA_TOKEN_ABI = [
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function balanceOf(address) external view returns (uint256)",
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
];

// ===== Helpers =====
function link(kind, value) {
  return `${EXPLORER}/${kind}/${value}`;
}

function toBytes32Hex(bigintStr) {
  return "0x" + BigInt(bigintStr).toString(16).padStart(64, "0");
}

async function waitTx(tx, label) {
  console.log(`  -> ${label} submitted: ${tx.hash}`);
  console.log(`     ${link("tx", tx.hash)}`);
  const receipt = await tx.wait();
  console.log(`     mined in block ${receipt.blockNumber}, gas used ${receipt.gasUsed.toString()}\n`);
  return receipt;
}

// ===== Main =====
async function main() {
  console.log("==========================================");
  console.log("  zkT-REX On-Chain Demo — HashKey Testnet ");
  console.log("==========================================\n");

  // --- Setup ---
  if (!process.env.PRIVATE_KEY) {
    console.error("ERROR: PRIVATE_KEY not set in .env");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  console.log("Deployer/demo wallet:", wallet.address);
  console.log("  ", link("address", wallet.address));

  const balance = await provider.getBalance(wallet.address);
  console.log(`  balance: ${ethers.formatEther(balance)} HSK\n`);

  // --- Contract instances ---
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
  const zkCompliance = new ethers.Contract(
    CONTRACTS.zkComplianceModule,
    ZK_COMPLIANCE_ABI,
    wallet
  );
  const token = new ethers.Contract(CONTRACTS.rwaToken, RWA_TOKEN_ABI, wallet);

  // --- Load demo identity ---
  const demo = JSON.parse(
    fs.readFileSync(path.join(__dirname, "demo-identity.json"), "utf8")
  );
  console.log("Loaded demo identity:");
  console.log("  claimTopic :", demo.claimTopic);
  console.log("  claimValue :", demo.claimValue);
  console.log("  identityRoot  :", demo.identityRoot);
  console.log("  revocationRoot:", demo.revocationRoot);
  console.log("  commitment    :", demo.identityCommitment);
  console.log("  nullifier     :", demo.claimNullifier, "\n");

  // ===================================================================
  // Step 1: Add demo identity to IdentityTreeManager
  // ===================================================================
  console.log("Step 1: Publishing identity root to IdentityTreeManager");
  const identityRootOnchain = await identityTree.getIdentityRoot();
  const targetIdentityRoot = toBytes32Hex(demo.identityRoot);
  console.log("  current on-chain root:", identityRootOnchain);
  console.log("  target root (demo)   :", targetIdentityRoot);

  if (identityRootOnchain.toLowerCase() !== targetIdentityRoot.toLowerCase()) {
    const tx = await identityTree.addIdentity(
      targetIdentityRoot,
      toBytes32Hex(demo.identityCommitment)
    );
    await waitTx(tx, "addIdentity");
  } else {
    console.log("  roots already match — skipping tx.\n");
  }

  // ===================================================================
  // Step 2: Generate a fresh Groth16 proof
  // ===================================================================
  console.log("Step 2: Generating Groth16 proof (snarkjs)");
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const input = {
    claimTopic: demo.claimTopic,
    claimValue: demo.claimValue,
    claimExpirationDate: demo.claimExpirationDate,
    claimSecret: demo.claimSecret,
    sigR8x: demo.sigR8x,
    sigR8y: demo.sigR8y,
    sigS: demo.sigS,
    identityPathElements: demo.identityPathElements,
    identityPathIndices: demo.identityPathIndices,
    revocationSiblings: demo.revocationSiblings,
    identityRoot: demo.identityRoot,
    revocationRoot: demo.revocationRoot,
    currentTimestamp: currentTimestamp.toString(),
    issuerPubKeyAx: demo.issuerPubKeyAx,
    issuerPubKeyAy: demo.issuerPubKeyAy,
    requiredClaimTopic: demo.claimTopic,
  };

  const wasmPath = path.join(__dirname, "../circuits/build/zktrex_js/zktrex.wasm");
  const zkeyPath = path.join(__dirname, "../circuits/build/zktrex_final.zkey");

  const t0 = Date.now();
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    wasmPath,
    zkeyPath
  );
  console.log(`  proof generated in ${Date.now() - t0}ms`);
  console.log(`  valid signal: ${publicSignals[0]} (should be 1)`);
  if (publicSignals[0] !== "1") {
    throw new Error("Generated proof has valid=0");
  }

  // Format for Solidity
  const a = [proof.pi_a[0], proof.pi_a[1]];
  const b = [
    [proof.pi_b[0][1], proof.pi_b[0][0]],
    [proof.pi_b[1][1], proof.pi_b[1][0]],
  ];
  const c = [proof.pi_c[0], proof.pi_c[1]];
  console.log("  calldata ready\n");

  // ===================================================================
  // Step 3: Submit the proof on-chain
  // ===================================================================
  console.log("Step 3: Submitting proof to ZKComplianceModule.submitProof()");
  const submitTx = await zkCompliance.submitProof(a, b, c, publicSignals);
  const submitReceipt = await waitTx(submitTx, "submitProof");
  const submitTxHash = submitReceipt.hash;

  const lastTs = await zkCompliance.lastProofTimestamp(wallet.address);
  console.log(`  lastProofTimestamp[deployer] = ${lastTs}\n`);

  // ===================================================================
  // Step 4: Check canTransfer()
  // ===================================================================
  console.log("Step 4: Calling canTransfer(deployer, deployer, 100 hkBOND)");
  const amount = ethers.parseEther("100");
  const allowed = await zkCompliance.canTransfer(
    wallet.address,
    wallet.address,
    amount
  );
  console.log(`  canTransfer result: ${allowed}\n`);
  if (!allowed) {
    throw new Error("canTransfer returned false — proof did not register");
  }

  // ===================================================================
  // Step 5: Execute an actual RWA token transfer
  // ===================================================================
  console.log("Step 5: Executing RWAToken.transfer(deployer, 100 hkBOND)");
  const balanceBefore = await token.balanceOf(wallet.address);
  console.log(`  balance before: ${ethers.formatEther(balanceBefore)} hkBOND`);
  const transferTx = await token.transfer(wallet.address, amount);
  const transferReceipt = await waitTx(transferTx, "transfer");
  const transferTxHash = transferReceipt.hash;
  const balanceAfter = await token.balanceOf(wallet.address);
  console.log(`  balance after : ${ethers.formatEther(balanceAfter)} hkBOND`);
  console.log("  (self-transfer: balance unchanged, but compliance check ran end-to-end)\n");

  // ===================================================================
  // Step 6: Revoke the claim
  // ===================================================================
  console.log("Step 6: Revoking the claim via RevocationRegistry.revoke()");

  // Ensure deployer is a trusted issuer
  const isIssuer = await revocation.trustedIssuers(wallet.address);
  if (!isIssuer) {
    const tx = await revocation.addIssuer(wallet.address);
    await waitTx(tx, "addIssuer (self)");
  }

  // Compute new revocation root — insert the nullifier into the SMT
  const poseidon = await circomlibjs.buildPoseidon();
  const F = poseidon.F;
  const TREE_HEIGHT = 20;

  const zeroHashes = [F.toObject(poseidon([BigInt(0)]))];
  for (let i = 1; i <= TREE_HEIGHT; i++) {
    zeroHashes.push(
      F.toObject(poseidon([zeroHashes[i - 1], zeroHashes[i - 1]]))
    );
  }

  const nullifierBits = BigInt(demo.claimNullifier)
    .toString(2)
    .padStart(254, "0")
    .split("")
    .reverse();

  const revokedLeafHash = F.toObject(poseidon([BigInt(1)]));
  let newRevocHash = revokedLeafHash;
  for (let i = 0; i < TREE_HEIGHT; i++) {
    if (nullifierBits[i] === "0") {
      newRevocHash = F.toObject(poseidon([newRevocHash, zeroHashes[i]]));
    } else {
      newRevocHash = F.toObject(poseidon([zeroHashes[i], newRevocHash]));
    }
  }
  const newRevocationRootHex = toBytes32Hex(newRevocHash.toString());
  const nullifierHex = toBytes32Hex(demo.claimNullifier);

  console.log("  claimNullifier:", nullifierHex);
  console.log("  new revocation root:", newRevocationRootHex);

  const revokeTx = await revocation.revoke(nullifierHex, newRevocationRootHex);
  const revokeReceipt = await waitTx(revokeTx, "revoke");
  const revokeTxHash = revokeReceipt.hash;

  // ===================================================================
  // Step 7: Try a new proof against the revoked state
  // ===================================================================
  console.log("Step 7: Attempting a new proof against the revoked root");
  console.log("  (siblings are stale — circuit should output valid=0)\n");

  const revokedInput = {
    ...input,
    currentTimestamp: Math.floor(Date.now() / 1000).toString(),
    revocationRoot: newRevocHash.toString(),
    // siblings intentionally unchanged — they no longer prove non-inclusion
  };

  let revokedValid = "?";
  try {
    const { publicSignals: revokedSignals } = await snarkjs.groth16.fullProve(
      revokedInput,
      wasmPath,
      zkeyPath
    );
    revokedValid = revokedSignals[0];
    console.log(`  revoked-state valid signal: ${revokedValid}`);
    if (revokedValid === "1") {
      console.log("  UNEXPECTED: circuit accepted the stale siblings");
    } else {
      console.log("  EXPECTED: circuit rejected the proof (valid=0)");
      console.log("  Revocation is cryptographically enforced.");
    }
  } catch (err) {
    console.log(`  circuit rejected the input: ${err.message.split("\n")[0]}`);
    console.log("  EXPECTED: proof generation failed after revocation.");
    revokedValid = "failed";
  }

  // ===================================================================
  // Summary
  // ===================================================================
  console.log("\n==========================================");
  console.log("  Demo Narrative Complete");
  console.log("==========================================\n");
  console.log("On-chain transactions:");
  console.log(`  1. submitProof  ${submitTxHash}`);
  console.log(`     ${link("tx", submitTxHash)}`);
  console.log(`  2. transfer     ${transferTxHash}`);
  console.log(`     ${link("tx", transferTxHash)}`);
  console.log(`  3. revoke       ${revokeTxHash}`);
  console.log(`     ${link("tx", revokeTxHash)}`);

  console.log("\nContracts:");
  for (const [name, addr] of Object.entries(CONTRACTS)) {
    console.log(`  ${name.padEnd(22)} ${addr}`);
    console.log(`  ${" ".repeat(22)} ${link("address", addr)}`);
  }

  console.log(`\nPost-revocation proof valid signal: ${revokedValid}`);
  console.log("(valid=0 or generation failure both demonstrate revocation works)");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nFATAL:", err);
    process.exit(1);
  });
