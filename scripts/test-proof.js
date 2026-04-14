const snarkjs = require("snarkjs");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("=== zkT-REX End-to-End Proof Test ===\n");

  // Load demo identity data
  const demoPath = path.join(__dirname, "demo-identity.json");
  if (!fs.existsSync(demoPath)) {
    console.error("ERROR: demo-identity.json not found. Run onboard-user.js first.");
    process.exit(1);
  }
  const demo = JSON.parse(fs.readFileSync(demoPath, "utf8"));

  // Construct circuit input (must match signal names in zktrex.circom exactly)
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const input = {
    // Private inputs
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
    // Public inputs
    identityRoot: demo.identityRoot,
    revocationRoot: demo.revocationRoot,
    currentTimestamp: currentTimestamp.toString(),
    issuerPubKeyAx: demo.issuerPubKeyAx,
    issuerPubKeyAy: demo.issuerPubKeyAy,
    requiredClaimTopic: demo.claimTopic, // Required topic matches the claim's topic
  };

  console.log("Circuit inputs loaded from demo-identity.json");
  console.log("  claimTopic:", input.claimTopic);
  console.log("  currentTimestamp:", input.currentTimestamp);
  console.log("  identityRoot:", input.identityRoot);
  console.log("  revocationRoot:", input.revocationRoot);
  console.log("");

  // Paths to compiled circuit artifacts
  const wasmPath = path.join(__dirname, "../circuits/build/zktrex_js/zktrex.wasm");
  const zkeyPath = path.join(__dirname, "../circuits/build/zktrex_final.zkey");
  const vkeyPath = path.join(__dirname, "../circuits/build/verification_key.json");

  // Check artifacts exist
  for (const [name, p] of [["wasm", wasmPath], ["zkey", zkeyPath], ["vkey", vkeyPath]]) {
    if (!fs.existsSync(p)) {
      console.error(`ERROR: ${name} not found at ${p}`);
      console.error("Run scripts/setup-circuit.sh first.");
      process.exit(1);
    }
  }

  // Generate proof
  console.log("Generating Groth16 proof...");
  const startTime = Date.now();

  let proof, publicSignals;
  try {
    const result = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
    proof = result.proof;
    publicSignals = result.publicSignals;
  } catch (err) {
    console.error("\nPROOF GENERATION FAILED:");
    console.error(err.message);
    process.exit(1);
  }

  const proofTime = Date.now() - startTime;
  console.log(`Proof generated in ${proofTime}ms\n`);

  // Display public signals
  console.log("Public signals (circuit outputs + public inputs):");
  const signalNames = [
    "valid (output)",
    "identityRoot",
    "revocationRoot",
    "currentTimestamp",
    "issuerPubKeyAx",
    "issuerPubKeyAy",
    "requiredClaimTopic",
  ];
  for (let i = 0; i < publicSignals.length; i++) {
    const name = signalNames[i] || `signal[${i}]`;
    console.log(`  [${i}] ${name}: ${publicSignals[i]}`);
  }
  console.log("");

  // Check that output[0] (valid) is 1
  if (publicSignals[0] !== "1") {
    console.error("PROOF OUTPUT INVALID: valid signal is", publicSignals[0], "(expected 1)");
    process.exit(1);
  }
  console.log("Output 'valid' = 1 (all circuit checks passed)");

  // Verify proof
  console.log("\nVerifying proof against verification key...");
  const vkey = JSON.parse(fs.readFileSync(vkeyPath, "utf8"));

  const verified = await snarkjs.groth16.verify(vkey, publicSignals, proof);

  if (verified) {
    console.log("\n========================================");
    console.log("  PROOF VERIFIED SUCCESSFULLY");
    console.log("========================================");
    console.log(`\nStats:`);
    console.log(`  Proving time: ${proofTime}ms`);
    console.log(`  Public signals: ${publicSignals.length}`);
    console.log(`  Proof elements: pi_a(2), pi_b(4), pi_c(2)`);
  } else {
    console.error("\nPROOF VERIFICATION FAILED");
    process.exit(1);
  }

  // Export Solidity calldata for on-chain submission
  const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
  console.log("\nSolidity calldata (for submitProof):");
  console.log(calldata.substring(0, 120) + "...");
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
