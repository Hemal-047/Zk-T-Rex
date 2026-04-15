"use client";

/**
 * Public Compliance Explorer — no wallet required.
 *
 * Left side: everything anyone on the internet can read from the standard
 * ERC-3643 SimpleIdentityRegistry for Alice (a pre-registered demo user).
 * Right side: everything anyone on the internet can read from the zkT-REX
 * stack. That's a total of three things: two Merkle roots and a
 * per-address proof timestamp.
 *
 * Every read is client-side via wagmi's useReadContract, pinned to HashKey
 * Chain Testnet (chain ID 133). No API routes, no signer, no RPC key —
 * just the public Blockscout RPC.
 */

import { useState } from "react";
import { useReadContract } from "wagmi";
import { isAddress } from "viem";
import {
  CONTRACTS,
  SIMPLE_IDENTITY_REGISTRY_ABI,
  ZK_COMPLIANCE_ABI,
  REVOCATION_ABI,
  IDENTITY_TREE_ABI,
  EXPLORER_URL,
  HASHKEY_TESTNET_CHAIN_ID,
} from "../../lib/contracts";

// The address the deploy script pre-registered in SimpleIdentityRegistry
// with KYC Level 2 / HK (852) / accredited / 365-day expiry. Hardcoded
// because this page is a demo of what's publicly readable — not a
// reflection of whoever is connected.
const ALICE_ADDRESS =
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as `0x${string}`;

const JURISDICTION_NAMES: Record<number, string> = {
  852: "HK (Hong Kong)",
  65: "SG (Singapore)",
  1: "US (United States)",
  44: "UK (United Kingdom)",
};

function formatJurisdiction(code: unknown): string {
  if (code === undefined || code === null) return "—";
  const n = Number(code as bigint | number);
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

function shortHex(h: string | undefined, head = 10, tail = 8): string {
  if (!h) return "—";
  if (h.length <= head + tail + 3) return h;
  return `${h.slice(0, head)}...${h.slice(-tail)}`;
}

export default function ExplorerPage() {
  const [lookup, setLookup] = useState("");
  const trimmed = lookup.trim();
  const lookupValid = isAddress(trimmed)
    ? (trimmed as `0x${string}`)
    : undefined;

  const registryAddr = CONTRACTS.simpleIdentityRegistry as `0x${string}`;
  const zkModuleAddr = CONTRACTS.zkComplianceModule as `0x${string}`;
  const identityTreeAddr = CONTRACTS.identityTreeManager as `0x${string}`;
  const revocationAddr = CONTRACTS.revocationRegistry as `0x${string}`;

  // =========================================================================
  // SECTION 1 — Privacy Leak Monitor (standard ERC-3643)
  //
  // Every one of these is a public view function on SimpleIdentityRegistry.
  // Pass Alice's address, get back a piece of her KYC profile in plaintext.
  // Anyone with an RPC endpoint can run the same calls.
  // =========================================================================
  const kycLevel = useReadContract({
    chainId: HASHKEY_TESTNET_CHAIN_ID,
    address: registryAddr,
    abi: SIMPLE_IDENTITY_REGISTRY_ABI,
    functionName: "kycLevel",
    args: [ALICE_ADDRESS],
  });
  const jurisdiction = useReadContract({
    chainId: HASHKEY_TESTNET_CHAIN_ID,
    address: registryAddr,
    abi: SIMPLE_IDENTITY_REGISTRY_ABI,
    functionName: "jurisdiction",
    args: [ALICE_ADDRESS],
  });
  const isAccredited = useReadContract({
    chainId: HASHKEY_TESTNET_CHAIN_ID,
    address: registryAddr,
    abi: SIMPLE_IDENTITY_REGISTRY_ABI,
    functionName: "isAccredited",
    args: [ALICE_ADDRESS],
  });
  const kycExpiry = useReadContract({
    chainId: HASHKEY_TESTNET_CHAIN_ID,
    address: registryAddr,
    abi: SIMPLE_IDENTITY_REGISTRY_ABI,
    functionName: "kycExpiry",
    args: [ALICE_ADDRESS],
  });
  const isVerified = useReadContract({
    chainId: HASHKEY_TESTNET_CHAIN_ID,
    address: registryAddr,
    abi: SIMPLE_IDENTITY_REGISTRY_ABI,
    functionName: "isVerified",
    args: [ALICE_ADDRESS],
  });

  // =========================================================================
  // SECTION 2 — zkT-REX Privacy Audit
  //
  // The only public state is two Merkle roots and (per address) a single
  // timestamp. We read all three. There is literally nothing else to read.
  // =========================================================================
  const identityRoot = useReadContract({
    chainId: HASHKEY_TESTNET_CHAIN_ID,
    address: identityTreeAddr,
    abi: IDENTITY_TREE_ABI,
    functionName: "identityRoot",
  });
  const identityCount = useReadContract({
    chainId: HASHKEY_TESTNET_CHAIN_ID,
    address: identityTreeAddr,
    abi: IDENTITY_TREE_ABI,
    functionName: "identityCount",
  });
  const revocationRoot = useReadContract({
    chainId: HASHKEY_TESTNET_CHAIN_ID,
    address: revocationAddr,
    abi: REVOCATION_ABI,
    functionName: "revocationRoot",
  });

  // Visitor-supplied address lookup — the single per-address field that
  // zkT-REX publishes. Only fires once the address parses.
  const lookupTs = useReadContract({
    chainId: HASHKEY_TESTNET_CHAIN_ID,
    address: zkModuleAddr,
    abi: ZK_COMPLIANCE_ABI,
    functionName: "lastProofTimestamp",
    args: lookupValid ? [lookupValid] : undefined,
    query: { enabled: !!lookupValid },
  });

  const registryReadUrl = `${EXPLORER_URL}/address/${registryAddr}?tab=read_contract`;
  const zkModuleReadUrl = `${EXPLORER_URL}/address/${zkModuleAddr}?tab=read_contract`;
  const identityTreeReadUrl = `${EXPLORER_URL}/address/${identityTreeAddr}?tab=read_contract`;
  const revocationReadUrl = `${EXPLORER_URL}/address/${revocationAddr}?tab=read_contract`;

  return (
    <main className="min-h-screen bg-[#0a0b0d] text-zinc-200">
      {/* Header */}
      <header className="border-b border-[#1e2028] px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            <img
              src="/logo.svg"
              alt="zkT-REX"
              width={36}
              height={36}
              className="h-9 w-9"
            />
            <div>
              <h1 className="text-lg font-semibold text-white">
                zkT-REX · Compliance Explorer
              </h1>
              <p className="text-xs text-zinc-500">
                Read-only audit of what each stack leaks on-chain
              </p>
            </div>
          </a>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-full border border-[#1e2028] bg-[#111318] px-3 py-1">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-xs text-zinc-400">HashKey Testnet</span>
            </div>
            <a
              href="/"
              className="rounded-md border border-[#1e2028] bg-[#111318] px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
            >
              ← dApp
            </a>
          </div>
        </div>
      </header>

      {/* Intro */}
      <section className="border-b border-[#1e2028] px-6 py-10">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-300">
            <span>Public read-only · No wallet connection required</span>
          </div>
          <h2 className="mb-3 text-3xl font-bold text-white sm:text-4xl">
            What can you actually <em className="text-blue-400">see</em>?
          </h2>
          <p className="text-sm text-zinc-400">
            Both panels below read live data from HashKey Chain Testnet right
            now, in your browser. Compare how much of an investor&rsquo;s
            profile leaks out of each stack.
          </p>
        </div>
      </section>

      {/* The two panels */}
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-10 lg:grid-cols-2">
        {/* ============================================================
            SECTION 1 — Privacy Leak Monitor (standard ERC-3643)
           ============================================================ */}
        <div className="rounded-xl border-2 border-red-500/40 bg-[#111318] p-6">
          <div className="mb-1 flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500/20 text-xs text-red-400">
              !
            </span>
            <h3 className="text-base font-semibold text-white">
              Privacy Leak Monitor
            </h3>
          </div>
          <p className="mb-4 text-xs text-red-400/80">
            What anyone can read from a standard ERC-3643 deployment right now
          </p>

          <div className="mb-4 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 font-mono text-[10px] text-red-300">
            <div className="text-red-400/70">Contract</div>
            <div className="mt-0.5 break-all">
              SimpleIdentityRegistry @ {registryAddr}
            </div>
          </div>

          <div className="mb-4 rounded-md bg-zinc-900/60 p-3">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">
              Queried identity
            </div>
            <div className="font-mono text-xs text-zinc-300">
              {ALICE_ADDRESS}
            </div>
            <div className="mt-0.5 text-[11px] text-zinc-500">
              Alice — pre-registered by the deploy script
            </div>
          </div>

          <div className="space-y-2">
            <LeakRow
              signature="kycLevel(address) → uint8"
              value={
                kycLevel.isLoading
                  ? "reading..."
                  : kycLevel.isError
                  ? "error"
                  : kycLevel.data !== undefined
                  ? `Level ${String(kycLevel.data)}`
                  : "—"
              }
            />
            <LeakRow
              signature="isVerified(address) → bool"
              value={
                isVerified.isLoading
                  ? "reading..."
                  : isVerified.data === true
                  ? "TRUE"
                  : isVerified.data === false
                  ? "FALSE"
                  : "—"
              }
            />
            <LeakRow
              signature="jurisdiction(address) → uint16"
              value={
                jurisdiction.isLoading
                  ? "reading..."
                  : formatJurisdiction(jurisdiction.data)
              }
            />
            <LeakRow
              signature="isAccredited(address) → bool"
              value={
                isAccredited.isLoading
                  ? "reading..."
                  : isAccredited.data === true
                  ? "TRUE"
                  : isAccredited.data === false
                  ? "FALSE"
                  : "—"
              }
            />
            <LeakRow
              signature="kycExpiry(address) → uint256"
              value={
                kycExpiry.isLoading
                  ? "reading..."
                  : formatExpiry(kycExpiry.data as bigint | undefined)
              }
            />
          </div>

          <a
            href={registryReadUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-5 block rounded-lg border border-red-500/30 bg-red-500/5 p-2 text-center text-xs font-medium text-red-400 transition hover:bg-red-500/10"
          >
            Verify on Blockscout Read Contract ↗
          </a>

          <div className="mt-4 rounded-lg bg-red-500/10 p-3 text-center">
            <p className="text-sm font-semibold text-red-300">
              5 identity attributes exposed
            </p>
            <p className="mt-0.5 text-[11px] text-red-400/70">
              Jurisdiction, KYC tier, accreditation, expiry — all public,
              forever, no wallet needed.
            </p>
          </div>
        </div>

        {/* ============================================================
            SECTION 2 — zkT-REX Privacy Audit
           ============================================================ */}
        <div className="rounded-xl border-2 border-green-500/40 bg-[#111318] p-6">
          <div className="mb-1 flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-500/20 text-xs text-green-400">
              ✓
            </span>
            <h3 className="text-base font-semibold text-white">
              zkT-REX Privacy Audit
            </h3>
          </div>
          <p className="mb-4 text-xs text-green-400/80">
            What anyone can read from zkT-REX. This is everything. There is
            nothing else.
          </p>

          <div className="mb-4 rounded-md border border-green-500/20 bg-green-500/5 px-3 py-2 font-mono text-[10px] text-green-300">
            <div className="text-green-400/70">Contracts</div>
            <div className="mt-0.5 break-all">
              IdentityTreeManager @ {identityTreeAddr}
            </div>
            <div className="mt-0.5 break-all">
              RevocationRegistry @ {revocationAddr}
            </div>
            <div className="mt-0.5 break-all">
              ZKComplianceModule @ {zkModuleAddr}
            </div>
          </div>

          <div className="space-y-2">
            <RootRow
              signature="identityRoot() → bytes32"
              value={shortHex(identityRoot.data as string | undefined)}
              full={identityRoot.data as string | undefined}
              loading={identityRoot.isLoading}
              href={identityTreeReadUrl}
            />
            <RootRow
              signature="identityCount() → uint256"
              value={
                identityCount.isLoading
                  ? "reading..."
                  : identityCount.data !== undefined
                  ? (identityCount.data as bigint).toString()
                  : "—"
              }
              loading={identityCount.isLoading}
              href={identityTreeReadUrl}
            />
            <RootRow
              signature="revocationRoot() → bytes32"
              value={shortHex(revocationRoot.data as string | undefined)}
              full={revocationRoot.data as string | undefined}
              loading={revocationRoot.isLoading}
              href={revocationReadUrl}
            />
          </div>

          <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">
            Two opaque Merkle roots and a counter. No per-user data. The
            roots commit to the full state of the tree without revealing any
            leaf.
          </p>

          {/* Per-address lookup — the one per-user field zkT-REX publishes */}
          <div className="mt-5 rounded-md border border-[#1e2028] bg-zinc-900/40 p-4">
            <div className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">
              Look up any wallet
            </div>
            <input
              type="text"
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
              placeholder="0x..."
              className="w-full rounded-md border border-[#1e2028] bg-[#0a0b0d] px-3 py-2 font-mono text-xs text-zinc-200 placeholder-zinc-600 focus:border-green-500/40 focus:outline-none"
              spellCheck={false}
            />
            <div className="mt-3 rounded-md bg-zinc-800/40 p-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-zinc-500">
                  lastProofTimestamp(address) → uint256
                </span>
                <span className="font-mono text-xs text-green-300">
                  {!lookup
                    ? "—"
                    : !lookupValid
                    ? "invalid address"
                    : lookupTs.isLoading
                    ? "reading..."
                    : formatTimestamp(lookupTs.data as bigint | undefined)}
                </span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
                This is the entire publicly-readable profile of any zkT-REX
                user. No jurisdiction. No KYC tier. No accreditation flag.
                Just when (if ever) they last submitted a valid proof.
              </p>
            </div>
          </div>

          <a
            href={zkModuleReadUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-5 block rounded-lg border border-green-500/30 bg-green-500/5 p-2 text-center text-xs font-medium text-green-400 transition hover:bg-green-500/10"
          >
            Verify on Blockscout Read Contract ↗
          </a>

          <div className="mt-4 rounded-lg bg-green-500/10 p-3 text-center">
            <p className="text-sm font-semibold text-green-300">
              0 identity attributes exposed
            </p>
            <p className="mt-0.5 text-[11px] text-green-400/70">
              Only a counter, two root hashes, and a per-address timestamp —
              cryptographically committed, semantically opaque.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#1e2028] px-6 py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 text-xs text-zinc-600 sm:flex-row">
          <span>
            zkT-REX Compliance Explorer — live reads via HashKey Testnet public
            RPC (chain 133)
          </span>
          <a href="/" className="hover:text-zinc-400">
            ← Back to dApp
          </a>
        </div>
      </footer>
    </main>
  );
}

function LeakRow({
  signature,
  value,
}: {
  signature: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-md bg-zinc-800/40 px-3 py-2">
      <span className="font-mono text-[11px] text-zinc-500">{signature}</span>
      <span className="font-mono text-xs font-semibold text-red-300">
        {value}
      </span>
    </div>
  );
}

function RootRow({
  signature,
  value,
  full,
  loading,
  href,
}: {
  signature: string;
  value: string;
  full?: string;
  loading: boolean;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between rounded-md bg-zinc-800/40 px-3 py-2 transition hover:bg-zinc-800/70"
      title={full}
    >
      <span className="font-mono text-[11px] text-zinc-500">{signature}</span>
      <span className="font-mono text-xs text-green-300">
        {loading ? "reading..." : value}
      </span>
    </a>
  );
}
