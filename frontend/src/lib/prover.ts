import * as snarkjs from "snarkjs";

export interface ProofInputs {
  // Private claim + signature
  claimTopic: string;
  claimValue: string;
  claimExpirationDate: string;
  claimSecret: string;
  sigR8x: string;
  sigR8y: string;
  sigS: string;
  // Private Merkle / SMT witnesses
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
  proofHash: string;
}

export type ProgressStage =
  | "fetching-inputs"
  | "loading-wasm"
  | "loading-zkey"
  | "witness"
  | "proving"
  | "formatting"
  | "done";

export interface ProgressEvent {
  stage: ProgressStage;
  message: string;
}

/**
 * Fetch the current fresh circuit inputs for a wallet. The server
 * rebuilds the Merkle path against the live tree and reads the current
 * on-chain roots, so the returned inputs are always up-to-date.
 */
export async function fetchProofInputs(wallet: string): Promise<{
  inputs: ProofInputs;
  display: {
    identityRootBytes32: string;
    revocationRootBytes32: string;
    commitmentBytes32: string;
    nullifierBytes32: string;
    onChainIdentityRoot: string | null;
    onChainRevocationRoot: string | null;
    rootsMatch: boolean;
  };
  leafIndex: number;
}> {
  const res = await fetch(
    `/api/get-proof-inputs?wallet=${encodeURIComponent(wallet)}`,
    { cache: "no-store" }
  );
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Failed to fetch proof inputs");
  }
  return {
    inputs: {
      claimTopic: data.proofInputs.claimTopic,
      claimValue: data.proofInputs.claimValue,
      claimExpirationDate: data.proofInputs.claimExpirationDate,
      claimSecret: data.proofInputs.claimSecret,
      sigR8x: data.proofInputs.sigR8x,
      sigR8y: data.proofInputs.sigR8y,
      sigS: data.proofInputs.sigS,
      identityPathElements: data.proofInputs.identityPathElements,
      identityPathIndices: data.proofInputs.identityPathIndices,
      revocationSiblings: data.proofInputs.revocationSiblings,
      identityRoot: data.proofInputs.identityRoot,
      revocationRoot: data.proofInputs.revocationRoot,
      currentTimestamp: data.proofInputs.currentTimestamp,
      issuerPubKeyAx: data.proofInputs.issuerPubKeyAx,
      issuerPubKeyAy: data.proofInputs.issuerPubKeyAy,
      requiredClaimTopic: data.proofInputs.requiredClaimTopic,
    },
    display: data.display,
    leafIndex: data.leafIndex,
  };
}

export async function generateProof(
  inputs: ProofInputs,
  onProgress?: (evt: ProgressEvent) => void
): Promise<GeneratedProof> {
  const report = (stage: ProgressStage, message: string) =>
    onProgress?.({ stage, message });

  report("loading-wasm", "Loading circuit WASM...");
  report("loading-zkey", "Loading proving key (~8.5 MB)...");
  report("witness", "Computing witness...");
  report("proving", "Generating Groth16 proof...");

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    inputs,
    "/zktrex.wasm",
    "/zktrex_final.zkey"
  );

  report("formatting", "Formatting calldata...");

  const calldata = await snarkjs.groth16.exportSolidityCallData(
    proof,
    publicSignals
  );
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

  const proofHash =
    "0x" +
    BigInt(a[0]).toString(16).padStart(16, "0").slice(0, 8) +
    BigInt(c[1]).toString(16).padStart(16, "0").slice(0, 8);

  report("done", "Proof ready");

  return { a, b, c, publicSignals, proofHash };
}
