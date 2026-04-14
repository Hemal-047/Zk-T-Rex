# zkT-REX: Zero-Knowledge Privacy for ERC-3643 Tokenized Securities

**ERC-3643 makes tokenized securities compliant. We make them private. Without breaking compliance.**

zkT-REX is a zero-knowledge privacy layer for ERC-3643 (T-REX) compliant tokenized securities on HashKey Chain. It replaces transparent on-chain compliance checks with Groth16 zero-knowledge proofs, allowing investors to prove they meet all regulatory requirements (valid KYC, correct jurisdiction, not revoked) without revealing any identity attributes on-chain.

## The Problem

ERC-3643 is the dominant token standard for regulated RWA tokenization ($32B+ in assets). It enforces compliance by checking investor identity (ONCHAINID) before every transfer. But every compliance check **leaks investor identity data on-chain** — jurisdiction, accreditation status, KYC tier — all publicly visible. For institutional investors (hedge funds, family offices), exposing portfolio composition is a dealbreaker.

## How It Works

- **Identity Merkle Tree** — When a KYC issuer verifies an investor, their identity commitment (a Poseidon hash of their signed claim) is added to a Merkle tree. The tree root is stored on-chain; the full tree stays off-chain. To prove compliance, the investor provides a Merkle inclusion proof that their commitment exists — without revealing which leaf is theirs.

- **Revocation Sparse Merkle Tree** — A second tree tracks revoked claims. An empty leaf means "not revoked." To prove they haven't been revoked, the investor provides a non-inclusion proof showing their nullifier maps to an empty leaf. When an issuer revokes someone, they insert the nullifier into the SMT and update the on-chain root — one transaction, instant cryptographic revocation.

- **EdDSA Claim Signatures** — Each compliance claim (KYC status, jurisdiction, accreditation tier) is signed by a trusted issuer using EdDSA over BabyJubJub. The ZK circuit verifies this signature inside the proof, ensuring the claim was genuinely issued without revealing who issued it or what it says.

- **Single Groth16 Proof** — All four checks (identity inclusion, revocation non-inclusion, signature verification, expiration) are combined into one Groth16 proof at 14,992 constraints. The on-chain verifier sees only: "proof valid, both parties compliant." It learns nothing about why.

## Architecture

```
+-----------------------------------------------------------+
|  BROWSER (Client-Side)                                     |
|  - ONCHAINID claim storage (local)                         |
|  - Merkle path construction                                |
|  - Groth16 proof generation via snarkjs                    |
+---------------------------+-------------------------------+
                            | proof + public inputs
                            v
+-----------------------------------------------------------+
|  GROTH16 CIRCUIT (Circom)          14,992 constraints      |
|  1. Identity Merkle inclusion (Poseidon, 20 levels)        |
|  2. Revocation SMT non-inclusion (Poseidon, 20 levels)     |
|  3. EdDSA/BabyJubJub claim signature verification          |
|  4. Expiration timestamp check                             |
+---------------------------+-------------------------------+
                            | verified proof
                            v
+-----------------------------------------------------------+
|  SMART CONTRACTS (HashKey Chain Testnet, ID: 133)          |
|  - Groth16Verifier.sol (auto-generated from circuit)       |
|  - ZKComplianceModule.sol (ERC-3643 ICompliance)           |
|  - RevocationRegistry.sol (SMT root management)            |
|  - IdentityTreeManager.sol (Identity root management)      |
|  - RWAToken.sol (ERC-3643 token)                           |
+---------------------------+-------------------------------+
                            | canTransfer() hook
                            v
+-----------------------------------------------------------+
|  transfer() -> canTransfer() -> ZK verify -> approve       |
+-----------------------------------------------------------+
```

## Deployed Contracts (HashKey Chain Testnet)

| Contract | Address | Explorer |
|----------|---------|----------|
| Groth16Verifier | `TBD` | [View](https://testnet-explorer.hsk.xyz) |
| RevocationRegistry | `TBD` | [View](https://testnet-explorer.hsk.xyz) |
| IdentityTreeManager | `TBD` | [View](https://testnet-explorer.hsk.xyz) |
| ZKComplianceModule | `TBD` | [View](https://testnet-explorer.hsk.xyz) |
| RWAToken (hkBOND) | `TBD` | [View](https://testnet-explorer.hsk.xyz) |

## Key Stats

| Metric | Value |
|--------|-------|
| Constraint count | **14,992** |
| Smart contracts | 5 |
| Contract test suite | 7/7 passing |
| Proof generation (Node.js) | ~3.9s |
| Proof generation (browser) | ~3-5s |
| Verification gas | ~200-300k gas |
| Tree height | 20 levels (~1M identities) |
| Proof system | Groth16 (BN128) |
| Private inputs | 67 signals |
| Public inputs | 6 signals + 1 output |

## How to Run Locally

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Circom](https://docs.circom.io/getting-started/installation/) >= 2.1.0
- [snarkjs](https://github.com/iden3/snarkjs) (`npm install -g snarkjs`)
- [Foundry](https://book.getfoundry.sh/getting-started/installation)

### 1. Circuit Setup

```bash
# Compile circuit + trusted setup
bash scripts/setup-circuit.sh
```

### 2. Smart Contract Tests

```bash
cd contracts
forge install
forge test -vvv
```

### 3. End-to-End Proof Pipeline

```bash
npm install                          # Install root deps (circomlibjs, snarkjs)
node scripts/compute-roots.js        # Compute empty Poseidon tree roots
node scripts/onboard-user.js         # Generate demo identity + EdDSA signature
node scripts/test-proof.js           # Generate & verify a full Groth16 proof
node scripts/revoke-user.js          # Demonstrate revocation kills the proof
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000 — click "Generate ZK Proof" on the Live Proof tab
```

### 5. Deploy to HashKey Testnet

```bash
# Get testnet HSK from https://faucet.hsk.xyz/
cp .env.example .env
# Edit .env with your private key
bash scripts/deploy.sh
```

## Tech Stack

- **ZK Circuit**: Circom 2.1.9, Groth16, snarkjs
- **Cryptographic Primitives**: Poseidon hash, EdDSA/BabyJubJub, Sparse Merkle Tree
- **Smart Contracts**: Solidity 0.8.24, Foundry
- **Frontend**: Next.js 14, RainbowKit, wagmi, viem, TailwindCSS
- **Chain**: HashKey Chain Testnet (Chain ID: 133)
- **Standard**: ERC-3643 (T-REX) compliance interface

## Hackathon

- **Event**: HashKey Chain On-Chain Horizon Hackathon
- **Track**: ZKID (primary), DeFi (secondary - RWA compliance)
- **Submission**: https://dorahacks.io/hackathon/2045
- **Deadline**: April 15, 2026

## Project Structure

```
zktrex/
├── circuits/
│   ├── zktrex.circom              # Main ZK circuit (14,992 constraints)
│   └── test/circuit.test.js       # Circuit tests
├── contracts/
│   ├── src/
│   │   ├── Groth16Verifier.sol    # Auto-generated from circuit
│   │   ├── ZKComplianceModule.sol # ERC-3643 compliance hook
│   │   ├── RevocationRegistry.sol # SMT root management
│   │   ├── IdentityTreeManager.sol
│   │   ├── RWAToken.sol           # ERC-3643 token
│   │   └── interfaces/ICompliance.sol
│   ├── test/ZKCompliance.t.sol    # 7 tests, all passing
│   └── script/Deploy.s.sol
├── frontend/                      # Next.js + RainbowKit
│   └── src/
│       ├── components/            # ComparisonDemo, ProofGenerator, etc.
│       └── lib/                   # prover.ts, smt.ts, merkle.ts
├── scripts/
│   ├── compute-roots.js           # Empty Poseidon tree roots
│   ├── onboard-user.js            # Generate demo identity + EdDSA sig
│   ├── test-proof.js              # End-to-end proof generation + verification
│   ├── revoke-user.js             # Revocation demo
│   ├── setup-circuit.sh           # Compile + trusted setup
│   └── deploy.sh                  # HashKey testnet deployment
└── README.md
```
