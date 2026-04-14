"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import ComplianceStatus from "../components/ComplianceStatus";
import TransferPanel from "../components/TransferPanel";
import RevocationAdmin from "../components/RevocationAdmin";
import ComparisonDemo from "../components/ComparisonDemo";
import ProofGenerator from "../components/ProofGenerator";
import { DEMO_MODE } from "../lib/contracts";
import { useState } from "react";

type Tab = "demo" | "dashboard" | "comparison";

export default function Home() {
  const { isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<Tab>(DEMO_MODE ? "demo" : "dashboard");

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
              {DEMO_MODE && (
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
              )}
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

      {/* Content */}
      <div className="mx-auto max-w-7xl px-6 py-8">
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

      {/* Footer */}
      <footer className="border-t border-[#1e2028] px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between text-xs text-zinc-600">
          <span>
            zkT-REX — HashKey Chain On-Chain Horizon Hackathon (ZKID Track)
          </span>
          <span>
            Powered by Circom, Groth16, ERC-3643
          </span>
        </div>
      </footer>
    </main>
  );
}
