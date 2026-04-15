"use client";

import { useState } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import {
  generateProof,
  fetchProofInputs,
  type GeneratedProof,
  type ProgressEvent,
} from "../lib/prover";
import { loadCredential } from "../lib/credential";
import { CIRCUIT_STATS } from "../lib/demo-data";
import { CONTRACTS, ZK_COMPLIANCE_ABI } from "../lib/contracts";

interface ProofGeneratorProps {
  onProofSubmitted?: (proof: GeneratedProof, txHash: `0x${string}`) => void;
}

type Phase =
  | "idle"
  | "fetching"
  | "proving"
  | "submitting"
  | "done"
  | "error";

export default function ProofGenerator({
  onProofSubmitted,
}: ProofGeneratorProps) {
  const { address } = useAccount();
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [proof, setProof] = useState<GeneratedProof | null>(null);
  const [proofTime, setProofTime] = useState(0);
  const [error, setError] = useState("");
  const [submitTxHash, setSubmitTxHash] = useState<`0x${string}` | null>(null);
  const [displayInfo, setDisplayInfo] = useState<{
    identityRootBytes32: string;
    revocationRootBytes32: string;
    rootsMatch: boolean;
  } | null>(null);

  const { writeContractAsync } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: submitTxHash ?? undefined });

  const credential = address ? loadCredential(address) : null;

  const handleGenerate = async () => {
    if (!address) {
      setError("Connect a wallet first.");
      setPhase("error");
      return;
    }
    if (!credential) {
      setError("No credential found. Click 'Get Verified' first.");
      setPhase("error");
      return;
    }

    try {
      setError("");
      setProof(null);
      setSubmitTxHash(null);
      setDisplayInfo(null);

      // Step 1 — fetch fresh Merkle inputs from the server
      setPhase("fetching");
      setProgress({
        stage: "fetching-inputs",
        message: "Fetching fresh Merkle path + current roots...",
      });
      const { inputs, display } = await fetchProofInputs(address);
      setDisplayInfo({
        identityRootBytes32: display.identityRootBytes32,
        revocationRootBytes32: display.revocationRootBytes32,
        rootsMatch: display.rootsMatch,
      });

      if (!display.rootsMatch) {
        console.warn("[ProofGenerator] root mismatch", display);
      }

      // Step 2 — run snarkjs in browser
      setPhase("proving");
      const start = performance.now();
      const result = await generateProof(inputs, (e) => setProgress(e));
      const elapsed = performance.now() - start;
      setProofTime(elapsed);
      setProof(result);

      // Step 3 — submit on-chain
      setPhase("submitting");
      const txHash = await writeContractAsync({
        address: CONTRACTS.zkComplianceModule as `0x${string}`,
        abi: ZK_COMPLIANCE_ABI,
        functionName: "submitProof",
        args: [
          result.a.map(BigInt) as unknown as readonly [bigint, bigint],
          result.b.map((r) => r.map(BigInt)) as unknown as readonly [
            readonly [bigint, bigint],
            readonly [bigint, bigint]
          ],
          result.c.map(BigInt) as unknown as readonly [bigint, bigint],
          result.publicSignals.map(BigInt),
        ],
      });

      setSubmitTxHash(txHash);
      setPhase("done");
      onProofSubmitted?.(result, txHash);
    } catch (err: any) {
      setError(err?.shortMessage || err?.message || "Proof generation failed");
      setPhase("error");
    }
  };

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Step 2 · Generate Compliance Proof
        </h2>
        <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400">
          Groth16
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <Stat
          label="Constraints"
          value={CIRCUIT_STATS.constraints.toLocaleString()}
        />
        <Stat label="Proof System" value={CIRCUIT_STATS.proofSystem} />
        <Stat
          label="Tree Height"
          value={`${CIRCUIT_STATS.treeHeight} levels`}
        />
        <Stat label="Curve" value={CIRCUIT_STATS.curveType} />
      </div>

      {!credential && (
        <div className="mb-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs text-yellow-400">
          You need a credential before you can prove compliance. Click
          &ldquo;Get Verified&rdquo; first.
        </div>
      )}

      {(phase === "fetching" ||
        phase === "proving" ||
        phase === "submitting") && (
        <div className="mb-4 rounded-lg bg-blue-500/10 p-3">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            <div className="flex-1">
              <p className="text-sm font-medium text-white">
                {phase === "fetching"
                  ? "Fetching fresh witness..."
                  : phase === "proving"
                  ? "Generating ZK proof..."
                  : "Submitting proof on-chain..."}
              </p>
              {progress && phase !== "submitting" && (
                <p className="text-xs text-zinc-400">{progress.message}</p>
              )}
              {phase === "submitting" && (
                <p className="text-xs text-zinc-400">
                  Waiting for wallet signature...
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {phase === "done" && proof && (
        <div className="mb-4 space-y-3">
          <div className="rounded-lg bg-green-500/10 p-3">
            <div className="flex items-center gap-2">
              <svg
                className="h-4 w-4 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-sm font-medium text-green-400">
                Proof generated in {(proofTime / 1000).toFixed(2)}s
              </span>
            </div>
            <div className="mt-1 text-xs text-green-400/70">
              Proof hash: <span className="font-mono">{proof.proofHash}</span>
            </div>
          </div>

          {submitTxHash && (
            <div className="rounded-lg border border-zinc-800 p-3">
              <div className="text-xs text-zinc-500">On-chain submission</div>
              <a
                href={`https://testnet-explorer.hsk.xyz/tx/${submitTxHash}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-blue-400 hover:text-blue-300"
              >
                {submitTxHash.slice(0, 18)}... ↗
              </a>
              <div className="mt-1 text-xs text-zinc-500">
                {isConfirming && "Waiting for confirmation..."}
                {isConfirmed && "Confirmed. Compliance window now open (1h)."}
              </div>
            </div>
          )}

          {displayInfo && (
            <details className="rounded-lg border border-zinc-800 p-3">
              <summary className="cursor-pointer text-xs text-zinc-400">
                Witness + on-chain roots
              </summary>
              <div className="mt-2 space-y-1 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-500">identityRoot</span>
                  <span className="font-mono text-zinc-400">
                    {displayInfo.identityRootBytes32.slice(0, 10)}...
                    {displayInfo.identityRootBytes32.slice(-6)}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-500">revocationRoot</span>
                  <span className="font-mono text-zinc-400">
                    {displayInfo.revocationRootBytes32.slice(0, 10)}...
                    {displayInfo.revocationRootBytes32.slice(-6)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">On-chain sync</span>
                  <span
                    className={
                      displayInfo.rootsMatch
                        ? "text-green-400"
                        : "text-yellow-400"
                    }
                  >
                    {displayInfo.rootsMatch ? "matched" : "stale"}
                  </span>
                </div>
              </div>
            </details>
          )}

          <details className="rounded-lg border border-zinc-800 p-3">
            <summary className="cursor-pointer text-xs text-zinc-400">
              Public signals ({proof.publicSignals.length})
            </summary>
            <div className="mt-2 space-y-1">
              {[
                "valid",
                "identityRoot",
                "revocationRoot",
                "timestamp",
                "issuerPubKeyAx",
                "issuerPubKeyAy",
                "requiredTopic",
              ].map((name, idx) => {
                const v = proof.publicSignals[idx] ?? "";
                return (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">
                      [{idx}] {name}
                    </span>
                    <span className="font-mono text-xs text-zinc-400">
                      {v.length > 20 ? `${v.slice(0, 8)}...${v.slice(-6)}` : v}
                    </span>
                  </div>
                );
              })}
            </div>
          </details>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <button
        className="btn-primary w-full"
        onClick={handleGenerate}
        disabled={
          phase === "fetching" ||
          phase === "proving" ||
          phase === "submitting" ||
          !credential
        }
      >
        {phase === "fetching"
          ? "Fetching witness..."
          : phase === "proving"
          ? "Proving..."
          : phase === "submitting"
          ? "Submitting..."
          : phase === "done"
          ? "Regenerate & Resubmit"
          : "Generate & Submit Proof"}
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-800/50 p-2">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-sm font-medium text-white">{value}</div>
    </div>
  );
}
