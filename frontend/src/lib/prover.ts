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
