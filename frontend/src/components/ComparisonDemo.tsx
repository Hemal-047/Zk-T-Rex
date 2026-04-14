"use client";

import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import {
  CONTRACTS,
  SIMPLE_IDENTITY_REGISTRY_ABI,
  DEMO_MODE,
} from "../lib/contracts";

const JURISDICTION_NAMES: Record<number, string> = {
  852: "HK (Hong Kong)",
  65: "SG (Singapore)",
  1: "US (United States)",
  44: "UK (United Kingdom)",
};

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

export default function ComparisonDemo() {
  const [isAnimating, setIsAnimating] = useState(false);
  const { address, isConnected } = useAccount();

  const isLive =
    isConnected &&
    !DEMO_MODE &&
    CONTRACTS.simpleIdentityRegistry !== ZERO_ADDR;

  const registryAddr = CONTRACTS.simpleIdentityRegistry as `0x${string}`;
  const queryEnabled = isLive && !!address;

  const { data: liveKycLevel } = useReadContract({
    address: registryAddr,
    abi: SIMPLE_IDENTITY_REGISTRY_ABI,
    functionName: "kycLevel",
    args: [address!],
    query: { enabled: queryEnabled },
  });

  const { data: liveJurisdiction } = useReadContract({
    address: registryAddr,
    abi: SIMPLE_IDENTITY_REGISTRY_ABI,
    functionName: "jurisdiction",
    args: [address!],
    query: { enabled: queryEnabled },
  });

  const { data: liveIsAccredited } = useReadContract({
    address: registryAddr,
    abi: SIMPLE_IDENTITY_REGISTRY_ABI,
    functionName: "isAccredited",
    args: [address!],
    query: { enabled: queryEnabled },
  });

  const { data: liveKycExpiry } = useReadContract({
    address: registryAddr,
    abi: SIMPLE_IDENTITY_REGISTRY_ABI,
    functionName: "kycExpiry",
    args: [address!],
    query: { enabled: queryEnabled },
  });

  const { data: liveIsVerified } = useReadContract({
    address: registryAddr,
    abi: SIMPLE_IDENTITY_REGISTRY_ABI,
    functionName: "isVerified",
    args: [address!],
    query: { enabled: queryEnabled },
  });

  // Compute display values — live reads or static fallback
  const displayAddress =
    isLive && address
      ? `${address.slice(0, 6)}...${address.slice(-4)}`
      : "0x7a23...8f4d";
  const displayKycLevel =
    isLive && liveKycLevel !== undefined
      ? `Level ${liveKycLevel}`
      : "Level 2";
  const displayJurisdiction =
    isLive && liveJurisdiction !== undefined
      ? JURISDICTION_NAMES[Number(liveJurisdiction)] ??
        `Code ${liveJurisdiction}`
      : "HK (Hong Kong)";
  const displayAccredited =
    isLive && liveIsAccredited !== undefined
      ? liveIsAccredited
        ? "TRUE"
        : "FALSE"
      : "TRUE";
  const displayExpiry =
    isLive && liveKycExpiry !== undefined
      ? new Date(Number(liveKycExpiry) * 1000).toLocaleDateString()
      : "2026-04-14";
  const displayVerified =
    isLive && liveIsVerified !== undefined
      ? liveIsVerified
        ? "VERIFIED"
        : "NOT VERIFIED"
      : "VERIFIED";

  const triggerDemo = () => {
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 3000);
  };

  return (
    <div>
      <div className="mb-8 text-center">
        <h2 className="mb-2 text-2xl font-bold text-white">
          Standard ERC-3643 vs zkT-REX
        </h2>
        <p className="text-sm text-zinc-500">
          See what data is visible on-chain in each mode
        </p>
        <button className="btn-primary mt-4" onClick={triggerDemo}>
          Simulate Transfer
        </button>
      </div>

      {isLive ? (
        <div className="mb-4 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-center">
          <p className="text-sm text-blue-400">
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
            Live Mode — Reading on-chain data for {address?.slice(0, 6)}...
            {address?.slice(-4)}
          </p>
        </div>
      ) : (
        <div className="mb-4 rounded-lg border border-zinc-700/50 bg-zinc-800/30 p-3 text-center">
          <p className="text-xs text-zinc-500">
            Demo Mode — Connect wallet with deployed contracts for live on-chain reads
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Standard ERC-3643 */}
        <div className="rounded-xl border-2 border-red-500/30 bg-[#111318] p-6">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20">
              <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-white">Standard ERC-3643 Transfer</h3>
              <p className="text-xs text-red-400">All identity data visible on-chain</p>
            </div>
          </div>

          {isLive && (
            <div className="mb-3 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2">
              <p className="text-[10px] font-medium uppercase tracking-wider text-red-400/80">
                ON-CHAIN: PUBLIC — SimpleIdentityRegistry
              </p>
            </div>
          )}

          <div className="space-y-3">
            <DataRow
              label="Identity Address"
              value={displayAddress}
              isVisible
              isAnimating={isAnimating}
            />
            <DataRow
              label="Claim: KYC_LEVEL"
              value={displayKycLevel}
              isVisible
              isAnimating={isAnimating}
              highlight="red"
            />
            <DataRow
              label="Claim: IS_VERIFIED"
              value={displayVerified}
              isVisible
              isAnimating={isAnimating}
              highlight="red"
            />
            <DataRow
              label="Claim: JURISDICTION"
              value={displayJurisdiction}
              isVisible
              isAnimating={isAnimating}
              highlight="red"
            />
            <DataRow
              label="Claim: IS_ACCREDITED"
              value={displayAccredited}
              isVisible
              isAnimating={isAnimating}
              highlight="red"
            />
            <DataRow
              label="Claim: KYC_EXPIRY"
              value={displayExpiry}
              isVisible
              isAnimating={isAnimating}
              highlight="red"
            />
            <DataRow
              label="Data Source"
              value={isLive ? "LIVE ON-CHAIN READ" : "mapping(address => data)"}
              isVisible
              isAnimating={isAnimating}
              highlight="red"
            />
            <DataRow
              label="Transfer Amount"
              value="1,000 sBOND"
              isVisible
              isAnimating={isAnimating}
            />
          </div>

          <div className="mt-4 rounded-lg bg-red-500/10 p-3 text-center">
            <p className="text-sm font-medium text-red-400">
              5 identity attributes exposed
            </p>
            <p className="text-xs text-red-400/70">
              {isLive
                ? "Read directly from SimpleIdentityRegistry — anyone can query this"
                : "Anyone can read investor jurisdiction, KYC level, and accreditation"}
            </p>
          </div>
        </div>

        {/* zkT-REX */}
        <div className="rounded-xl border-2 border-green-500/30 bg-[#111318] p-6">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20">
              <svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-white">zkT-REX Transfer</h3>
              <p className="text-xs text-green-400">Zero identity data exposed</p>
            </div>
          </div>

          <div className="space-y-3">
            <DataRow
              label="ZK Proof"
              value="0xa3f2...9c1e (Groth16)"
              isVisible
              isAnimating={isAnimating}
              highlight="green"
            />
            <DataRow
              label="Verified"
              value="TRUE"
              isVisible
              isAnimating={isAnimating}
              highlight="green"
            />
            <DataRow
              label="Identity Root"
              value="0x1b4a...7d2f"
              isVisible
              isAnimating={isAnimating}
            />
            <DataRow
              label="Revocation Root"
              value="0x8e3c...4a1b"
              isVisible
              isAnimating={isAnimating}
            />
            <PrivateRow
              label="KYC Status"
              isAnimating={isAnimating}
            />
            <PrivateRow
              label="Jurisdiction"
              isAnimating={isAnimating}
            />
            <PrivateRow
              label="Accreditation"
              isAnimating={isAnimating}
            />
            <PrivateRow
              label="Issuer Identity"
              isAnimating={isAnimating}
            />
          </div>

          <div className="mt-4 rounded-lg bg-green-500/10 p-3 text-center">
            <p className="text-sm font-medium text-green-400">
              0 identity attributes exposed
            </p>
            <p className="text-xs text-green-400/70">
              Compliance verified. Privacy preserved. Same security guarantees.
            </p>
          </div>
        </div>
      </div>

      {/* Technical explanation */}
      <div className="mt-8 rounded-xl border border-[#1e2028] bg-[#111318] p-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
          How It Works
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-zinc-800/50 p-4">
            <div className="mb-2 text-lg font-bold text-blue-400">1</div>
            <h4 className="mb-1 text-sm font-medium text-white">Identity Merkle Proof</h4>
            <p className="text-xs text-zinc-500">
              Prove membership in the identity registry without revealing which identity
            </p>
          </div>
          <div className="rounded-lg bg-zinc-800/50 p-4">
            <div className="mb-2 text-lg font-bold text-blue-400">2</div>
            <h4 className="mb-1 text-sm font-medium text-white">Revocation SMT Check</h4>
            <p className="text-xs text-zinc-500">
              Prove non-inclusion in the revocation tree (not revoked) using Sparse Merkle Tree
            </p>
          </div>
          <div className="rounded-lg bg-zinc-800/50 p-4">
            <div className="mb-2 text-lg font-bold text-blue-400">3</div>
            <h4 className="mb-1 text-sm font-medium text-white">EdDSA Claim Verification</h4>
            <p className="text-xs text-zinc-500">
              Verify the trusted issuer signed the compliance claim, all inside the ZK circuit
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DataRow({
  label,
  value,
  isVisible,
  isAnimating,
  highlight,
}: {
  label: string;
  value: string;
  isVisible: boolean;
  isAnimating: boolean;
  highlight?: "red" | "green";
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg p-2 transition-all duration-500 ${
        isAnimating && highlight === "red"
          ? "bg-red-500/10"
          : isAnimating && highlight === "green"
          ? "bg-green-500/10"
          : "bg-zinc-800/30"
      }`}
    >
      <span className="text-xs text-zinc-500">{label}</span>
      <span
        className={`font-mono text-xs ${
          highlight === "red"
            ? "text-red-400"
            : highlight === "green"
            ? "text-green-400"
            : "text-zinc-300"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function PrivateRow({
  label,
  isAnimating,
}: {
  label: string;
  isAnimating: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg p-2 transition-all duration-500 ${
        isAnimating ? "bg-green-500/5" : "bg-zinc-800/30"
      }`}
    >
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="font-mono text-xs text-zinc-700">
        [PRIVATE]
      </span>
    </div>
  );
}
