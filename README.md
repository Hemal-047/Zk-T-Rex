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

zkT-REX integrates with HashKey Chain's official KYC SBT. When `USE_HASHKEY_KYC=true`, credentials are only issued to wallets verified through HashKey's KYC infrastructure. The ZK layer proves compliance attributes from that verified KYC without exposing them on-chain.

## Deployed Contracts (HashKey Chain Testnet)

### ZK Stack (the privacy layer)

All source-verified on HashKey Chain's Blockscout explorer.

| Contract | Address | Verified | Explorer |
|----------|---------|----------|----------|
| Groth16Verifier | `0xC65EeAbCD9B10dD3c11a5f5bb5DBd7C83D716386` | ✅ | [View](https://testnet-explorer.hsk.xyz/address/0xC65EeAbCD9B10dD3c11a5f5bb5DBd7C83D716386) |
| RevocationRegistry | `0x0261458Af146a1Fbd718722Af139974aDF2Afe8b` | ✅ | [View](https://testnet-explorer.hsk.xyz/address/0x0261458Af146a1Fbd718722Af139974aDF2Afe8b) |
| IdentityTreeManager | `0xA763ed1D503c7C36b123A3B8268461A9CA311b16` | ✅ | [View](https://testnet-explorer.hsk.xyz/address/0xA763ed1D503c7C36b123A3B8268461A9CA311b16) |
| ZKComplianceModule | `0x5Fe9E99EA98cEF1f66647E5d038bBE539dD3f744` | ✅ | [View](https://testnet-explorer.hsk.xyz/address/0x5Fe9E99EA98cEF1f66647E5d038bBE539dD3f744) |
| RWAToken (hkBOND) | `0x2F4647adf1824e87FaAc34531CB320206cd72151` | ✅ | [View](https://testnet-explorer.hsk.xyz/address/0x2F4647adf1824e87FaAc34531CB320206cd72151) |

### Standard ERC-3643 Stack (transparent — deployed for side-by-side comparison)

| Contract | Address | Explorer |
|----------|---------|----------|
| SimpleIdentityRegistry | `0xe0c0Fb6edd33Fd98a2556dA63e38f9C161f1514E` | [View](https://testnet-explorer.hsk.xyz/address/0xe0c0Fb6edd33Fd98a2556dA63e38f9C161f1514E) |
| StandardComplianceModule | `0x7FB37f8216bACD5B3b4609507C79fE51f2b561b6` | [View](https://testnet-explorer.hsk.xyz/address/0x7FB37f8216bACD5B3b4609507C79fE51f2b561b6) |
| StandardRWAToken (sBOND) | `0xE2071b1B1894DE4605b50c279491A98862F37d4b` | [View](https://testnet-explorer.hsk.xyz/address/0xE2071b1B1894DE4605b50c279491A98862F37d4b) |

## Integrate zkT-REX in Your Protocol

zkT-REX implements the standard ERC-3643 `ICompliance` interface — so integrating it is a one-line change in the token constructor:

```solidity
// Standard ERC-3643: transparent compliance (exposes investor data)
ICompliance compliance = new StandardComplianceModule(identityRegistry);

// zkT-REX: private compliance (same interface, zero data exposure)
ICompliance compliance = new ZKComplianceModule(
    groth16Verifier,
    revocationRegistry,
    identityTreeManager
);

// Your token works exactly the same — just swap the compliance module
RWAToken token = new RWAToken("Bond", "BOND", address(compliance));
```

## How zkT-REX Compares

| Feature | Standard ERC-3643 | NullGate | zkT-REX |
|---|---|---|---|
| Investor country on-chain | Yes (`investorCountry` mapping) | Hidden at entry, address permanently flagged | Never on-chain |
| Transfer linkability | All linked via ONCHAINID | All linked via admitted address | Proofs expire, no permanent flag |
| Revocation method | Remove from registry (public) | No ZK revocation | SMT non-inclusion (cryptographic, private) |
| Compliance model | Static whitelist | One-time admission | Continuous (freshness window) |
| ZK circuit | N/A | Semaphore (off-the-shelf) | Custom: EdDSA + dual Merkle + expiry (14,992 constraints) |
| ERC-3643 compatible | Native | Separate system | Drop-in `ICompliance` replacement |
| HashKey KYC SBT | Via ONCHAINID | Semaphore gate | `IKycSBT` integrated |

## Verified On-Chain Transactions

Every step of the zkT-REX flow has been exercised on HashKey Chain Testnet (chain ID 133). These hashes are live — click through to the explorer to inspect calldata, events, and gas.

| Step | Description | Tx Hash | Gas | Explorer |
|---|---|---|---|---|
| 1 | Identity commitment registered (`IdentityTreeManager.addIdentity`) | `0x512bdada25ec252e54b4774ac68e92ce5bc523c975c655292e9e7d475ccb1002` | 54,679 | [View](https://testnet-explorer.hsk.xyz/tx/0x512bdada25ec252e54b4774ac68e92ce5bc523c975c655292e9e7d475ccb1002) |
| 2 | ZK proof verified on-chain (`ZKComplianceModule.submitProof`) | `0xc72e7bd373bebb42a98246b804a0f80f01ecec9d69eea70154677010b7dcee35` | 297,517 | [View](https://testnet-explorer.hsk.xyz/tx/0xc72e7bd373bebb42a98246b804a0f80f01ecec9d69eea70154677010b7dcee35) |
| 3 | hkBOND transfer via ZK compliance (`RWAToken.transfer`) | `0xd8dd6123d0029709364ef8a4c60a7d5979525f31bb3c0d60fe58604631d045e3` | 41,387 | [View](https://testnet-explorer.hsk.xyz/tx/0xd8dd6123d0029709364ef8a4c60a7d5979525f31bb3c0d60fe58604631d045e3) |
| 4 | Credential revoked via SMT (`RevocationRegistry.revoke`) | `0xa3dda47a900985c6d2cf56e63b6e9c6d169c2dfce91ceedca53838eab9bdd6ed` | 32,372 | [View](https://testnet-explorer.hsk.xyz/tx/0xa3dda47a900985c6d2cf56e63b6e9c6d169c2dfce91ceedca53838eab9bdd6ed) |

Additional transactions from live dApp testing with multiple wallets:

| Description | Tx Hash | Explorer |
|---|---|---|
| Second identity registered (dApp flow) | `0x17aabc1d7ee74c84cc509f26667641067cb552ca267565230915d32ba2e7f124` | [View](https://testnet-explorer.hsk.xyz/tx/0x17aabc1d7ee74c84cc509f26667641067cb552ca267565230915d32ba2e7f124) |
| hkBOND airdrop to new user | `0xd86176529986b5bffda5e11c8ade1e619df9f26d8602a4dca84be097acc6ea34` | [View](https://testnet-explorer.hsk.xyz/tx/0xd86176529986b5bffda5e11c8ade1e619df9f26d8602a4dca84be097acc6ea34) |
| Second submitProof (proof #2 measured at 280,429 gas) | `0x3e65e0cc6bf96bdef0f53c1951a66190bbcba3a39fa96db350dafa96245125e3` | [View](https://testnet-explorer.hsk.xyz/tx/0x3e65e0cc6bf96bdef0f53c1951a66190bbcba3a39fa96db350dafa96245125e3) |
| Second compliant transfer | `0xb0d2406ca5bbdc82eed0b4e2752c4374741c69e9329858d7b98aa22ba2e92363` | [View](https://testnet-explorer.hsk.xyz/tx/0xb0d2406ca5bbdc82eed0b4e2752c4374741c69e9329858d7b98aa22ba2e92363) |

## Key Stats

| Metric | Value |
|--------|-------|
| Circuit constraints | **14,992** (measured) |
| Smart contracts | 8 deployed on HashKey Testnet (chain ID 133) |
| Contract test suite | **27/27 passing** |
| Proof generation (browser) | ~4s (8.9MB proving key) |
| Verification gas | **297,517** (measured on-chain) |
| Tree height | 20 (supports 1,048,576 identities) |
| Revocation | Sparse Merkle Tree with per-user nullifiers |
| HashKey KYC SBT | Compatible (`0x6447...Bd43`) |
| Live dApp | https://zk-t-rex.vercel.app |
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
│   ├── test/                      # 27 tests, all passing
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
