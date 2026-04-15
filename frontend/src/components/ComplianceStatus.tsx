"use client";

import { useEffect, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import {
  CONTRACTS,
  ZK_COMPLIANCE_ABI,
  IDENTITY_TREE_ABI,
  REVOCATION_ABI,
} from "../lib/contracts";
import { loadCredential } from "../lib/credential";

export default function ComplianceStatus() {
  const { address } = useAccount();
  const [hasCredential, setHasCredential] = useState(false);

  useEffect(() => {
    setHasCredential(!!(address && loadCredential(address)));
  }, [address]);

  const { data: lastProofTimestamp, refetch } = useReadContract({
    address: CONTRACTS.zkComplianceModule as `0x${string}`,
    abi: ZK_COMPLIANCE_ABI,
    functionName: "lastProofTimestamp",
    args: [address!],
    query: { enabled: !!address, refetchInterval: 5000 },
  });

  const { data: identityRoot } = useReadContract({
    address: CONTRACTS.identityTreeManager as `0x${string}`,
    abi: IDENTITY_TREE_ABI,
    functionName: "identityRoot",
  });

  const { data: revocationRoot } = useReadContract({
    address: CONTRACTS.revocationRegistry as `0x${string}`,
    abi: REVOCATION_ABI,
    functionName: "revocationRoot",
  });

  useEffect(() => {
    const t = setInterval(() => refetch(), 5000);
    return () => clearInterval(t);
  }, [refetch]);

  const timestamp = lastProofTimestamp ? Number(lastProofTimestamp) : 0;
  const now = Math.floor(Date.now() / 1000);
  const freshnessWindow = 3600;
  const isCompliant = timestamp > 0 && now - timestamp < freshnessWindow;
  const timeRemaining =
    timestamp > 0 ? Math.max(0, freshnessWindow - (now - timestamp)) : 0;

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Compliance Status
        </h2>
        {isCompliant ? (
          <span className="status-compliant">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
            Compliant
          </span>
        ) : (
          <span className="status-noncompliant">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
            Not Compliant
          </span>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <div className="label">Wallet</div>
          <div className="font-mono text-sm text-white">
            {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "—"}
          </div>
        </div>

        <div>
          <div className="label">Credential</div>
          <div className="text-sm">
            {hasCredential ? (
              <span className="text-green-400">Issued (in browser)</span>
            ) : (
              <span className="text-zinc-500">Not issued</span>
            )}
          </div>
        </div>

        <div>
          <div className="label">Last On-Chain Proof</div>
          <div className="text-sm text-white">
            {timestamp > 0
              ? new Date(timestamp * 1000).toLocaleString()
              : "Never"}
          </div>
        </div>

        {isCompliant && (
          <div>
            <div className="label">Proof Valid For</div>
            <div className="text-sm text-white">
              {Math.floor(timeRemaining / 60)}m {timeRemaining % 60}s
            </div>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-zinc-800">
              <div
                className="h-1.5 rounded-full bg-green-500 transition-all"
                style={{ width: `${(timeRemaining / freshnessWindow) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="border-t border-[#1e2028] pt-4">
          <div className="label">Identity Root</div>
          <div className="font-mono text-xs text-zinc-400 break-all">
            {identityRoot ? String(identityRoot) : "—"}
          </div>
        </div>

        <div>
          <div className="label">Revocation Root</div>
          <div className="font-mono text-xs text-zinc-400 break-all">
            {revocationRoot ? String(revocationRoot) : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
