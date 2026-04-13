"use client";

import { useState } from "react";

export default function ComparisonDemo() {
  const [isAnimating, setIsAnimating] = useState(false);

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

          <div className="space-y-3">
            <DataRow
              label="Sender ONCHAINID"
              value="0x7a23...8f4d"
              isVisible
              isAnimating={isAnimating}
            />
            <DataRow
              label="Claim: KYC_VERIFIED"
              value="TRUE"
              isVisible
              isAnimating={isAnimating}
              highlight="red"
            />
            <DataRow
              label="Claim: JURISDICTION"
              value="HK (Hong Kong)"
              isVisible
              isAnimating={isAnimating}
              highlight="red"
            />
            <DataRow
              label="Claim: ACCREDITED_INVESTOR"
              value="TIER_2"
              isVisible
              isAnimating={isAnimating}
              highlight="red"
            />
            <DataRow
              label="Trusted Issuer"
              value="0x3f91...2a7c (HashKey KYC)"
              isVisible
              isAnimating={isAnimating}
              highlight="red"
            />
            <DataRow
              label="Identity Registry"
              value="LOOKUP: 0x7a23 -> Claims[1,2,3]"
              isVisible
              isAnimating={isAnimating}
              highlight="red"
            />
            <DataRow
              label="Transfer Amount"
              value="1,000 hkBOND"
              isVisible
              isAnimating={isAnimating}
            />
            <DataRow
              label="Recipient ONCHAINID"
              value="0x9b12...6e3a"
              isVisible
              isAnimating={isAnimating}
            />
          </div>

          <div className="mt-4 rounded-lg bg-red-500/10 p-3 text-center">
            <p className="text-sm font-medium text-red-400">
              6 identity attributes exposed
            </p>
            <p className="text-xs text-red-400/70">
              Anyone can see investor jurisdiction, KYC tier, and accreditation status
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
