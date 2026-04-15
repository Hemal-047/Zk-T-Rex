"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import ComplianceStatus from "../components/ComplianceStatus";
import TransferPanel from "../components/TransferPanel";
import ComparisonDemo from "../components/ComparisonDemo";
import ProofGenerator from "../components/ProofGenerator";
import VerifyButton from "../components/VerifyButton";
import { CONTRACTS, HASHKEY_TESTNET_CHAIN_ID } from "../lib/contracts";
import { useState } from "react";

type Tab = "app" | "comparison" | "how";

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
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [activeTab, setActiveTab] = useState<Tab>("app");

  const wrongChain = isConnected && chainId !== HASHKEY_TESTNET_CHAIN_ID;

  return (
    <main className="min-h-screen bg-[#0a0b0d]">
      {/* Header */}
      <header className="border-b border-[#1e2028] px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo.svg"
              alt="zkT-REX"
              width={36}
              height={36}
              className="h-9 w-9"
            />
            <div>
              <h1 className="text-lg font-semibold text-white">zkT-REX</h1>
              <p className="text-xs text-zinc-500">
                Private Compliance for Tokenized Securities
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex rounded-lg border border-[#1e2028] bg-[#111318] p-0.5">
              <TabBtn active={activeTab === "app"} onClick={() => setActiveTab("app")}>
                dApp
              </TabBtn>
              <TabBtn
                active={activeTab === "comparison"}
                onClick={() => setActiveTab("comparison")}
              >
                ERC-3643 vs zkT-REX
              </TabBtn>
              <TabBtn active={activeTab === "how"} onClick={() => setActiveTab("how")}>
                How it works
              </TabBtn>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-[#1e2028] bg-[#111318] px-3 py-1">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-xs text-zinc-400">HashKey Testnet</span>
            </div>
            <ConnectButton chainStatus="icon" showBalance={false} />
          </div>
        </div>
      </header>

      {/* Wrong chain banner */}
      {wrongChain && (
        <div className="border-b border-yellow-500/30 bg-yellow-500/10 px-6 py-3">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <span className="text-sm text-yellow-300">
              Wrong network. zkT-REX lives on HashKey Chain Testnet (ID{" "}
              {HASHKEY_TESTNET_CHAIN_ID}).
            </span>
            <button
              className="btn-primary"
              onClick={() => switchChain({ chainId: HASHKEY_TESTNET_CHAIN_ID })}
            >
              Switch to HashKey Testnet
            </button>
          </div>
        </div>
      )}

      {/* Hero — only on non-app tabs or when disconnected */}
      {(activeTab !== "app" || !isConnected) && (
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
              Connect your wallet, get a signed KYC credential, generate a
              Groth16 proof in your browser, and transfer tokenized bonds.
              Same compliance guarantees as ERC-3643 — zero identity data
              exposed.
            </p>
            <div className="flex flex-wrap justify-center gap-3 text-xs">
              <Badge>14,992 constraints</Badge>
              <Badge>~3.9s proof gen</Badge>
              <Badge>~250k verify gas</Badge>
              <Badge>Poseidon · BabyJubJub · BN128</Badge>
            </div>
          </div>
        </section>
      )}

      {/* Tab content */}
      <div className="mx-auto max-w-7xl px-6 py-10">
        {activeTab === "comparison" && <ComparisonDemo />}
        {activeTab === "how" && <HowItWorks />}
        {activeTab === "app" &&
          (!isConnected ? (
            <ConnectGate />
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-1">
                <VerifyButton />
                <div className="mt-6">
                  <ComplianceStatus />
                </div>
              </div>
              <div className="lg:col-span-1">
                <ProofGenerator />
              </div>
              <div className="lg:col-span-1">
                <TransferPanel />
              </div>
            </div>
          ))}
      </div>

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

      <footer className="border-t border-[#1e2028] px-6 py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 text-xs text-zinc-600 sm:flex-row">
          <span>
            zkT-REX — HashKey Chain On-Chain Horizon Hackathon (ZKID Track)
          </span>
          <span>
            <a href="/explorer" className="hover:text-zinc-400">
              Explorer
            </a>
            {" · "}
            <a href="/admin" className="hover:text-zinc-400">
              Admin
            </a>
            {" · "}
            Powered by Circom · Groth16 · ERC-3643
          </span>
        </div>
      </footer>
    </main>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm transition ${
        active ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-zinc-700 bg-zinc-800/50 px-3 py-1 text-zinc-400">
      {children}
    </span>
  );
}

function ConnectGate() {
  return (
    <div className="flex flex-col items-center justify-center py-24">
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
        Connect your wallet to get started
      </h2>
      <p className="mb-6 max-w-md text-center text-sm text-zinc-500">
        You&apos;ll need a wallet on HashKey Chain Testnet (chain ID 133) with
        a bit of HSK for gas. Get testnet HSK from the HashKey faucet.
      </p>
      <ConnectButton />
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "1",
      title: "Connect wallet",
      body: "MetaMask or any WalletConnect wallet on HashKey Chain Testnet.",
    },
    {
      n: "2",
      title: "Get verified",
      body: "The trusted issuer signs a KYC claim with EdDSA and adds your identity commitment to the on-chain Merkle tree. The witness is stored locally — not on-chain.",
    },
    {
      n: "3",
      title: "Generate proof",
      body: "snarkjs runs in your browser (~3-5s). It proves Merkle inclusion, SMT non-inclusion, EdDSA signature, and expiration — all in one Groth16 proof.",
    },
    {
      n: "4",
      title: "Submit on-chain",
      body: "The ZKComplianceModule verifies the proof in ~250k gas and records your compliance window (1 hour).",
    },
    {
      n: "5",
      title: "Transfer tokens",
      body: "RWAToken.transfer() calls the compliance hook. If both sender and recipient have fresh proofs, the transfer goes through. Otherwise it reverts with 'Transfer not compliant'.",
    },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-2 text-center text-2xl font-bold text-white">
        How zkT-REX Works
      </h2>
      <p className="mb-8 text-center text-sm text-zinc-500">
        One Groth16 proof verifies four checks. The on-chain verifier learns
        &ldquo;compliant&rdquo; — and nothing else.
      </p>
      <div className="space-y-3">
        {steps.map((s) => (
          <div
            key={s.n}
            className="flex gap-4 rounded-xl border border-[#1e2028] bg-[#111318] p-5"
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600/10 text-sm font-bold text-blue-400">
              {s.n}
            </div>
            <div>
              <h3 className="mb-1 text-sm font-semibold text-white">
                {s.title}
              </h3>
              <p className="text-xs text-zinc-500">{s.body}</p>
            </div>
          </div>
        ))}
      </div>
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
