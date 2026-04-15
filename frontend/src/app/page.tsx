"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import ComplianceStatus from "../components/ComplianceStatus";
import TransferPanel from "../components/TransferPanel";
import RevocationAdmin from "../components/RevocationAdmin";
import ComparisonDemo from "../components/ComparisonDemo";
import ProofGenerator from "../components/ProofGenerator";
import { CONTRACTS, DEMO_MODE } from "../lib/contracts";
import { useState } from "react";

type Tab = "comparison" | "demo" | "dashboard";

const EXPLORER = "https://testnet-explorer.hsk.xyz";

const ZK_CONTRACTS: { name: string; addr: string }[] = [
  { name: "Groth16Verifier", addr: CONTRACTS.groth16Verifier },
  { name: "RevocationRegistry", addr: CONTRACTS.revocationRegistry },
  { name: "IdentityTreeManager", addr: CONTRACTS.identityTreeManager },
  { name: "ZKComplianceModule", addr: CONTRACTS.zkComplianceModule },
  { name: "RWAToken (hkBOND)", addr: CONTRACTS.rwaToken },
];

const STANDARD_CONTRACTS: { name: string; addr: string }[] = [
  { name: "SimpleIdentityRegistry", addr: CONTRACTS.simpleIdentityRegistry },
  { name: "StandardComplianceModule", addr: CONTRACTS.standardComplianceModule },
  { name: "StandardRWAToken (sBOND)", addr: CONTRACTS.standardRWAToken },
];

function shortAddr(a: string) {
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

export default function Home() {
  const { isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<Tab>("comparison");

  return (
    <main className="min-h-screen bg-[#0a0b0d]">
      {/* Header */}
      <header className="border-b border-[#1e2028] px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 font-bold text-white text-sm">
              zk
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">zkT-REX</h1>
              <p className="text-xs text-zinc-500">
                Private Compliance for Tokenized Securities
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex rounded-lg border border-[#1e2028] bg-[#111318] p-0.5">
              <button
                onClick={() => setActiveTab("comparison")}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  activeTab === "comparison"
                    ? "bg-blue-600 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                ERC-3643 vs zkT-REX
              </button>
              <button
                onClick={() => setActiveTab("demo")}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  activeTab === "demo"
                    ? "bg-blue-600 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Live Proof
              </button>
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  activeTab === "dashboard"
                    ? "bg-blue-600 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Dashboard
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-[#1e2028] bg-[#111318] px-3 py-1">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-xs text-zinc-400">HashKey Testnet</span>
            </div>
            <ConnectButton />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-[#1e2028] px-6 py-12">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-300">
            <span>HashKey Chain Hackathon · ZKID Track</span>
          </div>
          <h1 className="mb-4 text-4xl font-bold text-white sm:text-5xl">
            Zero-Knowledge Privacy for{" "}
            <span className="text-blue-400">ERC-3643</span> Securities
          </h1>
          <p className="mx-auto mb-6 max-w-2xl text-base text-zinc-400">
            ERC-3643 makes tokenized securities compliant — but every transfer
            leaks investor jurisdiction, KYC tier, and accreditation on-chain.
            zkT-REX replaces that with a single Groth16 proof. Same compliance
            guarantees, zero identity data exposed.
          </p>
          <div className="flex flex-wrap justify-center gap-3 text-xs">
            <span className="rounded-full border border-zinc-700 bg-zinc-800/50 px-3 py-1 text-zinc-400">
              14,992 constraints
            </span>
            <span className="rounded-full border border-zinc-700 bg-zinc-800/50 px-3 py-1 text-zinc-400">
              ~3.9s proof gen
            </span>
            <span className="rounded-full border border-zinc-700 bg-zinc-800/50 px-3 py-1 text-zinc-400">
              ~250k verify gas
            </span>
            <span className="rounded-full border border-zinc-700 bg-zinc-800/50 px-3 py-1 text-zinc-400">
              Poseidon · BabyJubJub · BN128
            </span>
          </div>
        </div>
      </section>

      {/* Tab content */}
      <div className="mx-auto max-w-7xl px-6 py-10">
        {activeTab === "comparison" ? (
          <ComparisonDemo />
        ) : activeTab === "demo" ? (
          <div className="mx-auto max-w-2xl">
            <div className="mb-6 text-center">
              <h2 className="mb-2 text-2xl font-bold text-white">
                In-Browser ZK Proof Generation
              </h2>
              <p className="text-sm text-zinc-500">
                Generate a real Groth16 proof using snarkjs. The proof verifies
                KYC compliance without revealing any identity data.
              </p>
            </div>
            <ProofGenerator />
          </div>
        ) : !isConnected ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600/10">
              <svg
                className="h-8 w-8 text-blue-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h2 className="mb-2 text-xl font-semibold text-white">
              Connect Your Wallet
            </h2>
            <p className="mb-6 text-sm text-zinc-500">
              Connect to HashKey Chain Testnet to manage compliant RWA transfers
              with zero-knowledge privacy
            </p>
            <ConnectButton />
            {DEMO_MODE && (
              <p className="mt-6 max-w-md text-center text-xs text-zinc-600">
                The dashboard talks to live HashKey Testnet contracts and
                requires a funded wallet on chain 133. Use the &quot;Live
                Proof&quot; tab above to generate a real Groth16 proof in your
                browser without connecting.
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <ComplianceStatus />
            </div>
            <div className="lg:col-span-1">
              <TransferPanel />
            </div>
            <div className="lg:col-span-1">
              <RevocationAdmin />
            </div>
          </div>
        )}
      </div>

      {/* Architecture */}
      <section className="border-t border-[#1e2028] px-6 py-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-2 text-center text-2xl font-bold text-white">
            How It Works
          </h2>
          <p className="mb-8 text-center text-sm text-zinc-500">
            One Groth16 proof verifies four checks. The on-chain verifier
            learns &ldquo;compliant&rdquo; — and nothing else.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <ArchCard
              n="1"
              title="Identity Merkle Inclusion"
              body="Prove your commitment is in the on-chain identity root without revealing which leaf."
            />
            <ArchCard
              n="2"
              title="Revocation SMT Non-Inclusion"
              body="Prove your nullifier still maps to an empty leaf in the revocation Sparse Merkle Tree."
            />
            <ArchCard
              n="3"
              title="EdDSA Claim Signature"
              body="Verify a trusted issuer signed your claim using EdDSA over BabyJubJub — inside the circuit."
            />
            <ArchCard
              n="4"
              title="Expiration Check"
              body="Confirm the claim hasn't expired against a fresh on-chain timestamp."
            />
          </div>
        </div>
      </section>

      {/* Deployed contracts */}
      <section className="border-t border-[#1e2028] px-6 py-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-2 text-center text-2xl font-bold text-white">
            Deployed on HashKey Testnet
          </h2>
          <p className="mb-8 text-center text-sm text-zinc-500">
            All eight contracts live on chain ID 133. Click any address to
            inspect on the explorer.
          </p>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* ZK Stack */}
            <div className="rounded-xl border border-green-500/20 bg-[#111318] p-5">
              <div className="mb-3 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <h3 className="text-sm font-semibold text-white">
                  zkT-REX Privacy Stack
                </h3>
              </div>
              <div className="space-y-2">
                {ZK_CONTRACTS.map((c) => (
                  <ContractRow key={c.addr} name={c.name} addr={c.addr} />
                ))}
              </div>
            </div>

            {/* Standard Stack */}
            <div className="rounded-xl border border-red-500/20 bg-[#111318] p-5">
              <div className="mb-3 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-red-500" />
                <h3 className="text-sm font-semibold text-white">
                  Transparent ERC-3643 (for comparison)
                </h3>
              </div>
              <div className="space-y-2">
                {STANDARD_CONTRACTS.map((c) => (
                  <ContractRow key={c.addr} name={c.name} addr={c.addr} />
                ))}
              </div>
              <p className="mt-3 text-[11px] text-zinc-600">
                These store identity attributes in public mappings — anyone
                can read jurisdiction, KYC tier, and accreditation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1e2028] px-6 py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 text-xs text-zinc-600 sm:flex-row">
          <span>
            zkT-REX — HashKey Chain On-Chain Horizon Hackathon (ZKID Track)
          </span>
          <span>Powered by Circom · Groth16 · ERC-3643</span>
        </div>
      </footer>
    </main>
  );
}

function ArchCard({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-[#1e2028] bg-[#111318] p-5">
      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600/10 text-sm font-bold text-blue-400">
        {n}
      </div>
      <h3 className="mb-1 text-sm font-semibold text-white">{title}</h3>
      <p className="text-xs text-zinc-500">{body}</p>
    </div>
  );
}

function ContractRow({ name, addr }: { name: string; addr: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-zinc-800/30 px-3 py-2">
      <span className="text-xs text-zinc-400">{name}</span>
      <a
        href={`${EXPLORER}/address/${addr}`}
        target="_blank"
        rel="noreferrer"
        className="font-mono text-xs text-blue-400 hover:text-blue-300"
      >
        {shortAddr(addr)} ↗
      </a>
    </div>
  );
}
