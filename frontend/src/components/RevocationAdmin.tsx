"use client";

import { useState } from "react";
import { useWriteContract, useReadContract } from "wagmi";
import { CONTRACTS, REVOCATION_ABI } from "../lib/contracts";

export default function RevocationAdmin() {
  const [nullifier, setNullifier] = useState("");
  const [newRoot, setNewRoot] = useState("");
  const [status, setStatus] = useState<"idle" | "revoking" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState("");

  const { data: revocationRoot } = useReadContract({
    address: CONTRACTS.revocationRegistry as `0x${string}`,
    abi: REVOCATION_ABI,
    functionName: "revocationRoot",
  });

  const { writeContractAsync: revoke } = useWriteContract();

  const handleRevoke = async () => {
    if (!nullifier || !newRoot) return;

    try {
      setError("");
      setStatus("revoking");

      const tx = await revoke({
        address: CONTRACTS.revocationRegistry as `0x${string}`,
        abi: REVOCATION_ABI,
        functionName: "revoke",
        args: [nullifier as `0x${string}`, newRoot as `0x${string}`],
      });

      setTxHash(tx);
      setStatus("success");
    } catch (err: any) {
      setError(err.message || "Revocation failed");
      setStatus("error");
    }
  };

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Revocation Admin
        </h2>
        <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-xs text-red-400">
          Issuer Only
        </span>
      </div>

      <div className="mb-4 rounded-lg bg-zinc-800/50 p-3">
        <div className="label">Current Revocation Root</div>
        <div className="font-mono text-xs text-zinc-400 break-all">
          {revocationRoot ? String(revocationRoot) : "Loading..."}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="label">Claim Nullifier (bytes32)</label>
          <input
            type="text"
            className="input w-full"
            placeholder="0x..."
            value={nullifier}
            onChange={(e) => setNullifier(e.target.value)}
          />
          <p className="mt-1 text-xs text-zinc-600">
            Poseidon(claimSecret, claimTopic) of the claim to revoke
          </p>
        </div>

        <div>
          <label className="label">New SMT Root (bytes32)</label>
          <input
            type="text"
            className="input w-full"
            placeholder="0x..."
            value={newRoot}
            onChange={(e) => setNewRoot(e.target.value)}
          />
          <p className="mt-1 text-xs text-zinc-600">
            Computed off-chain after inserting the revocation
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {status === "success" && txHash && (
          <div className="rounded-lg bg-green-500/10 p-3">
            <div className="text-sm text-green-400">Claim revoked!</div>
            <a
              href={`https://testnet-explorer.hsk.xyz/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:underline"
            >
              View on HashKey Explorer
            </a>
          </div>
        )}

        <button
          className="btn-danger w-full"
          onClick={handleRevoke}
          disabled={!nullifier || !newRoot || status === "revoking"}
        >
          {status === "revoking" ? "Revoking..." : "Revoke Claim"}
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-zinc-800 p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          How Revocation Works
        </h3>
        <ol className="space-y-1 text-xs text-zinc-600">
          <li>1. Issuer computes the claim nullifier off-chain</li>
          <li>2. Inserts it into the Sparse Merkle Tree</li>
          <li>3. Submits the new SMT root on-chain</li>
          <li>4. User can no longer prove non-inclusion (revoked)</li>
        </ol>
      </div>
    </div>
  );
}
