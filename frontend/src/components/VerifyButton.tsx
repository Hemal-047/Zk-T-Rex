"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import {
  saveCredential,
  loadCredential,
  type CredentialHandle,
} from "../lib/credential";

interface Props {
  onVerified?: (cred: CredentialHandle) => void;
}

interface MintInfo {
  txHash: string | null;
  error: string | null;
}

interface TreeInfo {
  identityRoot: string;
  identityRootBytes32: string;
  leafCount: number;
  updateRootTxHash: string | null;
}

export default function VerifyButton({ onVerified }: Props) {
  const { address } = useAccount();
  const [status, setStatus] = useState<"idle" | "issuing" | "done" | "error">(
    "idle"
  );
  const [error, setError] = useState("");
  const [mintInfo, setMintInfo] = useState<MintInfo | null>(null);
  const [treeInfo, setTreeInfo] = useState<TreeInfo | null>(null);
  const [existing, setExisting] = useState<CredentialHandle | null>(null);

  useEffect(() => {
    setExisting(address ? loadCredential(address) : null);
  }, [address, status]);

  const handleVerify = async () => {
    if (!address) return;
    try {
      setStatus("issuing");
      setError("");
      setMintInfo(null);

      const res = await fetch("/api/issue-credential", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet: address }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Credential issuance failed");
      }

      const handle: CredentialHandle = {
        wallet: address,
        leafIndex: data.credential.leafIndex,
        claimTopic: data.credential.claimTopic,
        claimValue: data.credential.claimValue,
        claimExpirationDate: data.credential.claimExpirationDate,
        commitmentBytes32: data.credential.commitmentBytes32,
        nullifierBytes32: data.credential.nullifierBytes32,
        issuedAt: data.credential.issuedAt,
      };
      saveCredential(handle);

      setMintInfo(data.mint);
      setTreeInfo(data.tree);
      setStatus("done");
      onVerified?.(handle);
    } catch (err: any) {
      setError(err?.message || "Unknown error");
      setStatus("error");
    }
  };

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Step 1 · Get Verified
        </h2>
        {existing && status === "idle" && (
          <span className="rounded-full border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-xs text-green-400">
            Already Verified
          </span>
        )}
      </div>

      <p className="mb-4 text-sm text-zinc-500">
        Request a signed KYC claim from the trusted issuer. Your unique
        identity commitment is inserted into the on-chain Merkle tree. You
        also receive 1,000 hkBOND so you can test a compliant transfer.
      </p>

      {existing && (
        <div className="mb-4 rounded-lg border border-green-500/20 bg-green-500/5 p-3">
          <div className="text-xs text-zinc-500">Credential issued</div>
          <div className="mt-1 text-sm text-green-400">
            {new Date(existing.issuedAt).toLocaleString()}
          </div>
          <div className="mt-2 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500">Leaf index</span>
              <span className="font-mono text-zinc-300">{existing.leafIndex}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Commitment</span>
              <span className="font-mono text-zinc-400">
                {existing.commitmentBytes32.slice(0, 10)}...
                {existing.commitmentBytes32.slice(-6)}
              </span>
            </div>
          </div>
        </div>
      )}

      {status === "issuing" && (
        <div className="mb-4 flex items-center gap-3 rounded-lg bg-blue-500/10 p-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <div>
            <p className="text-sm font-medium text-white">
              Issuing credential...
            </p>
            <p className="text-xs text-zinc-500">
              Signing claim, updating identity tree on-chain, minting hkBOND
            </p>
          </div>
        </div>
      )}

      {status === "done" && (
        <div className="mb-4 space-y-2">
          <div className="rounded-lg bg-green-500/10 p-3 text-sm text-green-400">
            Credential issued successfully.
          </div>
          {treeInfo?.updateRootTxHash && (
            <div className="rounded-lg bg-zinc-800/50 p-3 text-xs">
              <div className="text-zinc-500">Root updated on-chain</div>
              <a
                href={`https://testnet-explorer.hsk.xyz/tx/${treeInfo.updateRootTxHash}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-blue-400 hover:text-blue-300"
              >
                {treeInfo.updateRootTxHash.slice(0, 18)}... ↗
              </a>
              <div className="mt-1 text-zinc-500">
                Leaf count: {treeInfo.leafCount}
              </div>
            </div>
          )}
          {mintInfo?.txHash && (
            <div className="rounded-lg bg-zinc-800/50 p-3 text-xs">
              <div className="text-zinc-500">Airdrop TX</div>
              <a
                href={`https://testnet-explorer.hsk.xyz/tx/${mintInfo.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-blue-400 hover:text-blue-300"
              >
                {mintInfo.txHash.slice(0, 18)}... ↗
              </a>
            </div>
          )}
          {mintInfo?.error && (
            <div className="rounded-lg bg-yellow-500/10 p-3 text-xs text-yellow-400">
              Token airdrop failed: {mintInfo.error}. You can still generate a
              proof.
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <button
        className="btn-primary w-full"
        onClick={handleVerify}
        disabled={!address || status === "issuing"}
      >
        {status === "issuing"
          ? "Issuing..."
          : existing
          ? "Re-issue Credential"
          : "Get Verified"}
      </button>
    </div>
  );
}
