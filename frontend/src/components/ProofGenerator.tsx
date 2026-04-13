"use client";

import { useState } from "react";
import { generateProof, type ProofInputs, type GeneratedProof } from "../lib/prover";

interface ProofGeneratorProps {
  onProofGenerated: (proof: GeneratedProof) => void;
  inputs?: ProofInputs;
}

export default function ProofGenerator({ onProofGenerated, inputs }: ProofGeneratorProps) {
  const [status, setStatus] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [proofTime, setProofTime] = useState(0);

  const handleGenerate = async () => {
    if (!inputs) {
      setError("No proof inputs provided");
      setStatus("error");
      return;
    }

    try {
      setStatus("generating");
      setError("");
      const start = performance.now();

      const proof = await generateProof(inputs);

      const elapsed = performance.now() - start;
      setProofTime(elapsed);
      setStatus("done");
      onProofGenerated(proof);
    } catch (err: any) {
      setError(err.message || "Proof generation failed");
      setStatus("error");
    }
  };

  return (
    <div className="rounded-lg border border-[#1e2028] bg-zinc-800/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          ZK Proof Generator
        </h3>
        {status === "done" && (
          <span className="text-xs text-green-400">
            Generated in {(proofTime / 1000).toFixed(1)}s
          </span>
        )}
      </div>

      {status === "generating" && (
        <div className="mb-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          <div>
            <p className="text-sm text-white">Generating Groth16 proof...</p>
            <p className="text-xs text-zinc-500">
              Running snarkjs in browser (~3-5 seconds)
            </p>
          </div>
        </div>
      )}

      {status === "done" && (
        <div className="mb-3 rounded-lg bg-green-500/10 p-2">
          <p className="text-xs text-green-400">Proof generated successfully</p>
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-lg bg-red-500/10 p-2">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      <button
        className="btn-primary w-full text-sm"
        onClick={handleGenerate}
        disabled={status === "generating" || !inputs}
      >
        {status === "generating"
          ? "Generating..."
          : status === "done"
          ? "Regenerate Proof"
          : "Generate ZK Proof"}
      </button>
    </div>
  );
}
