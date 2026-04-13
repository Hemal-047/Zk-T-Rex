# zkT-REX: Zero-Knowledge Privacy for ERC-3643 Tokenized Securities

**ERC-3643 makes tokenized securities compliant. We make them private. Without breaking compliance.**

zkT-REX is a zero-knowledge privacy layer for ERC-3643 (T-REX) compliant tokenized securities on HashKey Chain. It replaces transparent on-chain compliance checks with Groth16 zero-knowledge proofs, allowing investors to prove they meet all regulatory requirements (valid KYC, correct jurisdiction, not revoked) without revealing any identity attributes on-chain.

## The Problem

ERC-3643 is the dominant token standard for regulated RWA tokenization ($32B+ in assets). It enforces compliance by checking investor identity (ONCHAINID) before every transfer. But every compliance check **leaks investor identity data on-chain** — jurisdiction, accreditation status, KYC tier — all publicly visible. For institutional investors (hedge funds, family offices), exposing portfolio composition is a dealbreaker.

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
|  GROTH16 CIRCUIT (Circom)                                  |
|  1. Identity Merkle inclusion (Poseidon, 20 levels)        |
|  2. Revocation SMT non-inclusion (Poseidon, 20 levels)     |
|  3. EdDSA/BabyJubJub claim signature verification          |
|  4. Expiration timestamp check                             |
|  Target: ~25,000 constraints                               |
+---------------------------+-------------------------------+
                            | verified proof
                            v
+-----------------------------------------------------------+
|  SMART CONTRACTS (HashKey Chain Testnet, ID: 133)          |
|  - Groth16Verifier.sol (auto-generated)                    |
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

- **Constraint count**: ~25,000 (target)
- **Smart contracts**: 5 deployed
- **Proof generation**: ~3-5s in-browser
- **Verification gas**: ~200-300k gas
- **Tree height**: 20 levels (supports ~1M identities, scales to 256)

## How to Run Locally

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Circom](https://docs.circom.io/getting-started/installation/) >= 2.1.0
- [snarkjs](https://github.com/iden3/snarkjs) (`npm install -g snarkjs`)
- [Foundry](https://book.getfoundry.sh/getting-started/installation)

### 1. Circuit Setup

```bash
# Compile circuit + trusted setup (downloads ~1GB powers of tau)
bash scripts/setup-circuit.sh
```

### 2. Smart Contract Tests

```bash
cd contracts
forge install --no-commit
forge test -vvv
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

### 4. Deploy to HashKey Testnet

```bash
# Get testnet HSK from https://faucet.hsk.xyz/
cp .env.example .env
# Edit .env with your private key
bash scripts/deploy.sh
```

## Tech Stack

- **ZK Circuit**: Circom 2.1.0, Groth16, snarkjs
- **Cryptographic Primitives**: Poseidon hash, EdDSA/BabyJubJub, Sparse Merkle Tree
- **Smart Contracts**: Solidity 0.8.24, Foundry
- **Frontend**: Next.js 14, RainbowKit, wagmi, viem, TailwindCSS
- **Chain**: HashKey Chain Testnet (Chain ID: 133)
- **Standard**: ERC-3643 (T-REX) compliance interface

## Hackathon

- **Event**: HashKey Chain On-Chain Horizon Hackathon
- **Track**: ZKID (primary), DeFi (secondary - RWA compliance)
- **Deadline**: April 15, 2026

## Project Structure

```
zktrex/
├── circuits/           # Circom ZK circuits + tests
├── contracts/          # Foundry smart contracts
├── frontend/           # Next.js + RainbowKit UI
├── scripts/            # Build, deploy, and demo scripts
└── README.md
```
