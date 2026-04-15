"use client";

import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import {
  CONTRACTS,
  SIMPLE_IDENTITY_REGISTRY_ABI,
  ZK_COMPLIANCE_ABI,
  EXPLORER_URL,
} from "../lib/contracts";

// Alice — the address the deploy script registered with
// KYC Level 2 / HK (852) / accredited / 365-day expiry.
// Hardcoded on purpose: this panel is a "look at real on-chain identity
// data" demo, not a reflection of whoever is connected.
const ALICE_ADDRESS =
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as `0x${string}`;

const JURISDICTION_NAMES: Record<number, string> = {
  852: "HK (Hong Kong)",
  65: "SG (Singapore)",
  1: "US (United States)",
  44: "UK (United Kingdom)",
};

function formatJurisdiction(code: bigint | number | undefined): string {
  if (code === undefined) return "—";
  const n = Number(code);
  return JURISDICTION_NAMES[n] ?? `Code ${n}`;
}

function formatExpiry(ts: bigint | undefined): string {
  if (ts === undefined) return "—";
  const n = Number(ts);
  if (n === 0) return "not set";
  return new Date(n * 1000).toLocaleDateString();
}

function formatTimestamp(ts: bigint | undefined): string {
  if (ts === undefined) return "—";
  const n = Number(ts);
  if (n === 0) return "never";
  return new Date(n * 1000).toLocaleString();
}

export default function ComparisonDemo() {
  const [isAnimating, setIsAnimating] = useState(false);
  const { address, isConnected } = useAccount();

  const registryAddr = CONTRACTS.simpleIdentityRegistry as `0x${string}`;
  const zkModuleAddr = CONTRACTS.zkComplianceModule as `0x${string}`;

  // === LEFT SIDE: Real on-chain reads for Alice from SimpleIdentityRegistry ===
  const {
    data: kycLevel,
    isLoading: loadingKycLevel,
    isError: errorKycLevel,
  } = useReadContract({
    address: registryAddr,
    abi: SIMPLE_IDENTITY_REGISTRY_ABI,
    functionName: "kycLevel",
    args: [ALICE_ADDRESS],
  });

  const { data: jurisdiction, isLoading: loadingJurisdiction } =
    useReadContract({
      address: registryAddr,
      abi: SIMPLE_IDENTITY_REGISTRY_ABI,
      functionName: "jurisdiction",
      args: [ALICE_ADDRESS],
    });

  const { data: isAccredited, isLoading: loadingIsAccredited } =
    useReadContract({
      address: registryAddr,
      abi: SIMPLE_IDENTITY_REGISTRY_ABI,
      functionName: "isAccredited",
      args: [ALICE_ADDRESS],
    });

  const { data: kycExpiry, isLoading: loadingKycExpiry } = useReadContract({
    address: registryAddr,
    abi: SIMPLE_IDENTITY_REGISTRY_ABI,
    functionName: "kycExpiry",
    args: [ALICE_ADDRESS],
  });

  const { data: isVerified, isLoading: loadingIsVerified } = useReadContract({
    address: registryAddr,
    abi: SIMPLE_IDENTITY_REGISTRY_ABI,
    functionName: "isVerified",
    args: [ALICE_ADDRESS],
  });

  const leftLoading =
    loadingKycLevel ||
    loadingJurisdiction ||
    loadingIsAccredited ||
    loadingKycExpiry ||
    loadingIsVerified;

  // === RIGHT SIDE: zkT-REX proof timestamp for the connected wallet ===
  const { data: lastProofTs, isLoading: loadingProofTs } = useReadContract({
    address: zkModuleAddr,
    abi: ZK_COMPLIANCE_ABI,
    functionName: "lastProofTimestamp",
    args: [address ?? ALICE_ADDRESS],
    query: { enabled: true },
  });

  const triggerDemo = () => {
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 3000);
  };

  const registryReadUrl = `${EXPLORER_URL}/address/${registryAddr}?tab=read_contract`;
  const zkModuleReadUrl = `${EXPLORER_URL}/address/${zkModuleAddr}?tab=read_contract`;

  return (
    <div>
      <div className="mb-8 text-center">
        <h2 className="mb-2 text-2xl font-bold text-white">
          Standard ERC-3643 vs zkT-REX
        </h2>
        <p className="text-sm text-zinc-500">
          Same investor, same compliance rules, completely different on-chain
          footprint. Both panels below read <em>live data</em> from HashKey
          Testnet.
        </p>
        <button className="btn-primary mt-4" onClick={triggerDemo}>
          Simulate Transfer
        </button>
      </div>

      <div className="mb-4 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-center">
        <p className="text-sm text-blue-400">
          <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-blue-400" />
          Live Mode — Left: Alice&rsquo;s entry in{" "}
          <span className="font-mono">SimpleIdentityRegistry</span>. Right:{" "}
          {isConnected
            ? "your wallet's ZK proof timestamp"
            : "ZK proof timestamp (connect a wallet)"}
          .
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* =========================================================
            LEFT — Standard ERC-3643, real on-chain reads for Alice
           ========================================================= */}
        <div className="rounded-xl border-2 border-red-500/30 bg-[#111318] p-6">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20">
              <svg
                className="h-4 w-4 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white">
                Standard ERC-3643 Transfer
              </h3>
              <p className="text-xs text-red-400">
                All identity data visible on-chain
              </p>
            </div>
          </div>

          <div className="mb-3 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-red-400/80">
              [LIVE FROM CHAIN] SimpleIdentityRegistry ·{" "}
              {registryAddr.slice(0, 6)}...{registryAddr.slice(-4)}
            </p>
          </div>

          {leftLoading ? (
            <div className="flex items-center gap-3 rounded-lg bg-zinc-800/30 p-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
              <p className="text-sm text-zinc-400">Reading from chain...</p>
            </div>
          ) : errorKycLevel ? (
            <div className="rounded-lg bg-red-500/10 p-3 text-xs text-red-400">
              Failed to read from registry. Is your wallet on HashKey Testnet
              (chain 133)?
            </div>
          ) : (
            <div className="space-y-3">
              <DataRow
                label="Identity Address"
                value={`${ALICE_ADDRESS.slice(0, 6)}...${ALICE_ADDRESS.slice(
                  -4
                )}`}
                isAnimating={isAnimating}
              />
              <DataRow
                label="kycLevel()"
                value={
                  kycLevel !== undefined ? `Level ${kycLevel.toString()}` : "—"
                }
                isAnimating={isAnimating}
                highlight="red"
              />
              <DataRow
                label="isVerified()"
                value={isVerified ? "TRUE" : "FALSE"}
                isAnimating={isAnimating}
                highlight="red"
              />
              <DataRow
                label="jurisdiction()"
                value={formatJurisdiction(jurisdiction as bigint | undefined)}
                isAnimating={isAnimating}
                highlight="red"
              />
              <DataRow
                label="isAccredited()"
                value={isAccredited ? "TRUE" : "FALSE"}
                isAnimating={isAnimating}
                highlight="red"
              />
              <DataRow
                label="kycExpiry()"
                value={formatExpiry(kycExpiry as bigint | undefined)}
                isAnimating={isAnimating}
                highlight="red"
              />
              <DataRow
                label="Transfer Amount"
                value="1,000 sBOND"
                isAnimating={isAnimating}
              />
            </div>
          )}

          <a
            href={registryReadUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 block rounded-lg border border-red-500/30 bg-red-500/5 p-2 text-center text-xs font-medium text-red-400 transition hover:bg-red-500/10"
          >
            Read Contract on Blockscout ↗
          </a>

          <div className="mt-3 rounded-lg bg-red-500/10 p-3 text-center">
            <p className="text-sm font-medium text-red-400">
              5 identity attributes exposed
            </p>
            <p className="text-xs text-red-400/70">
              Anyone can read Alice&rsquo;s jurisdiction, KYC level, and
              accreditation directly from the registry.
            </p>
          </div>
        </div>

        {/* =========================================================
            RIGHT — zkT-REX, real on-chain lastProofTimestamp read
           ========================================================= */}
        <div className="rounded-xl border-2 border-green-500/30 bg-[#111318] p-6">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20">
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
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white">zkT-REX Transfer</h3>
              <p className="text-xs text-green-400">
                Zero identity data exposed
              </p>
            </div>
          </div>

          <div className="mb-3 rounded-md border border-green-500/20 bg-green-500/5 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-green-400/80">
              [LIVE FROM CHAIN] ZKComplianceModule ·{" "}
              {zkModuleAddr.slice(0, 6)}...{zkModuleAddr.slice(-4)}
            </p>
          </div>

          <div className="space-y-3">
            <DataRow
              label="lastProofTimestamp()"
              value={
                loadingProofTs
                  ? "loading..."
                  : formatTimestamp(lastProofTs as bigint | undefined)
              }
              isAnimating={isAnimating}
              highlight="green"
            />
            <DataRow
              label="Queried address"
              value={
                isConnected && address
                  ? `${address.slice(0, 6)}...${address.slice(-4)}`
                  : "(connect wallet)"
              }
              isAnimating={isAnimating}
            />
            <PrivateRow label="KYC Level" isAnimating={isAnimating} />
            <PrivateRow label="Jurisdiction" isAnimating={isAnimating} />
            <PrivateRow label="Accreditation" isAnimating={isAnimating} />
            <PrivateRow label="KYC Expiry" isAnimating={isAnimating} />
            <PrivateRow label="Issuer Identity" isAnimating={isAnimating} />
          </div>

          <a
            href={zkModuleReadUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 block rounded-lg border border-green-500/30 bg-green-500/5 p-2 text-center text-xs font-medium text-green-400 transition hover:bg-green-500/10"
          >
            Read Contract on Blockscout ↗
          </a>

          <div className="mt-3 rounded-lg bg-green-500/10 p-3 text-center">
            <p className="text-sm font-medium text-green-400">
              0 identity attributes exposed
            </p>
            <p className="text-xs text-green-400/70">
              Only a single opaque timestamp — proof that{" "}
              <em>some</em> compliant user submitted{" "}
              <em>some</em> valid proof. Nothing else.
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
            <h4 className="mb-1 text-sm font-medium text-white">
              Identity Merkle Proof
            </h4>
            <p className="text-xs text-zinc-500">
              Prove membership in the identity registry without revealing which
              identity.
            </p>
          </div>
          <div className="rounded-lg bg-zinc-800/50 p-4">
            <div className="mb-2 text-lg font-bold text-blue-400">2</div>
            <h4 className="mb-1 text-sm font-medium text-white">
              Revocation SMT Check
            </h4>
            <p className="text-xs text-zinc-500">
              Prove non-inclusion in the revocation tree (not revoked) using a
              Sparse Merkle Tree.
            </p>
          </div>
          <div className="rounded-lg bg-zinc-800/50 p-4">
            <div className="mb-2 text-lg font-bold text-blue-400">3</div>
            <h4 className="mb-1 text-sm font-medium text-white">
              EdDSA Claim Verification
            </h4>
            <p className="text-xs text-zinc-500">
              Verify the trusted issuer signed the compliance claim, all inside
              the ZK circuit.
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
  isAnimating,
  highlight,
}: {
  label: string;
  value: string;
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
      <span className="font-mono text-xs text-zinc-700">[PRIVATE]</span>
    </div>
  );
}
