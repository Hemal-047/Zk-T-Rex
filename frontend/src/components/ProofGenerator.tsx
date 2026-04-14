"use client";

import { useState } from "react";
import { generateProof, type GeneratedProof } from "../lib/prover";
import { getDemoProofInputs, CIRCUIT_STATS, DEMO_IDENTITY } from "../lib/demo-data";
import { DEMO_MODE } from "../lib/contracts";

interface ProofGeneratorProps {
  onProofGenerated?: (proof: GeneratedProof) => void;
}

export default function ProofGenerator({ onProofGenerated }: ProofGeneratorProps) {
  const [status, setStatus] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [proofTime, setProofTime] = useState(0);
  const [proof, setProof] = useState<GeneratedProof | null>(null);

  const handleGenerate = async () => {
    try {
      setStatus("generating");
      setError("");
      const start = performance.now();

      const inputs = getDemoProofInputs();
      const result = await generateProof(inputs);

      const elapsed = performance.now() - start;
      setProofTime(elapsed);
      setProof(result);
      setStatus("done");
      onProofGenerated?.(result);
    } catch (err: any) {
      setError(err.message || "Proof generation failed");
      setStatus("error");
    }
  };

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          ZK Proof Generator
        </h2>
        {DEMO_MODE && (
          <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400">
            Demo Mode
          </span>
        )}
      </div>

      {/* Circuit stats */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-zinc-800/50 p-2">
          <div className="text-xs text-zinc-500">Constraints</div>
          <div className="text-sm font-medium text-white">{CIRCUIT_STATS.constraints.toLocaleString()}</div>
        </div>
        <div className="rounded-lg bg-zinc-800/50 p-2">
          <div className="text-xs text-zinc-500">Proof System</div>
          <div className="text-sm font-medium text-white">{CIRCUIT_STATS.proofSystem}</div>
        </div>
        <div className="rounded-lg bg-zinc-800/50 p-2">
          <div className="text-xs text-zinc-500">Tree Height</div>
          <div className="text-sm font-medium text-white">{CIRCUIT_STATS.treeHeight} levels</div>
        </div>
        <div className="rounded-lg bg-zinc-800/50 p-2">
          <div className="text-xs text-zinc-500">Curve</div>
          <div className="text-sm font-medium text-white">{CIRCUIT_STATS.curveType}</div>
        </div>
      </div>

      {/* Demo identity info */}
      {DEMO_MODE && status === "idle" && (
        <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-800/30 p-3">
          <div className="mb-1 text-xs font-medium text-zinc-500">Demo Identity</div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500">Claim</span>
              <span className="text-zinc-300">KYC_VERIFIED (Topic 1)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Jurisdiction</span>
              <span className="text-zinc-300">Hong Kong (852)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Expires</span>
              <span className="text-zinc-300">
                {new Date(Number(DEMO_IDENTITY.claimExpirationDate) * 1000).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Identity Root</span>
              <span className="font-mono text-zinc-400">
                {DEMO_IDENTITY.identityRootBytes32.slice(0, 10)}...
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Generating animation */}
      {status === "generating" && (
        <div className="mb-4 flex items-center gap-3 rounded-lg bg-blue-500/10 p-3 proving-animation">
          <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          <div>
            <p className="text-sm font-medium text-white">Generating Groth16 proof...</p>
            <p className="text-xs text-zinc-500">
              Running snarkjs in browser (~3-5 seconds)
            </p>
          </div>
        </div>
      )}

      {/* Proof result */}
      {status === "done" && proof && (
        <div className="mb-4 space-y-3">
          <div className="rounded-lg bg-green-500/10 p-3">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-medium text-green-400">Proof verified!</span>
              <span className="text-xs text-zinc-500">({(proofTime / 1000).toFixed(1)}s)</span>
            </div>
          </div>

          {/* Public signals */}
          <div className="rounded-lg border border-zinc-800 p-3">
            <div className="mb-2 text-xs font-medium text-zinc-500">Public Signals (on-chain visible)</div>
            <div className="space-y-1">
              {[
                { name: "valid", idx: 0 },
                { name: "identityRoot", idx: 1 },
                { name: "revocationRoot", idx: 2 },
                { name: "timestamp", idx: 3 },
                { name: "issuerPubKeyAx", idx: 4 },
                { name: "issuerPubKeyAy", idx: 5 },
                { name: "requiredTopic", idx: 6 },
              ].map(({ name, idx }) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">[{idx}] {name}</span>
                  <span className="font-mono text-xs text-zinc-400">
                    {proof.publicSignals[idx]?.length > 20
                      ? proof.publicSignals[idx].slice(0, 8) + "..." + proof.publicSignals[idx].slice(-6)
                      : proof.publicSignals[idx]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Proof data */}
          <div className="rounded-lg border border-zinc-800 p-3">
            <div className="mb-2 text-xs font-medium text-zinc-500">Groth16 Proof Points</div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-xs text-zinc-500">pi_a</span>
                <span className="font-mono text-xs text-zinc-400">
                  [{proof.a[0].slice(0, 8)}..., {proof.a[1].slice(0, 8)}...]
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-zinc-500">pi_b</span>
                <span className="font-mono text-xs text-zinc-400">
                  [[...], [...]]
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-zinc-500">pi_c</span>
                <span className="font-mono text-xs text-zinc-400">
                  [{proof.c[0].slice(0, 8)}..., {proof.c[1].slice(0, 8)}...]
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <button
        className="btn-primary w-full"
        onClick={handleGenerate}
        disabled={status === "generating"}
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
