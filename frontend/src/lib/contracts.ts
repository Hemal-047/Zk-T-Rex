// DEMO_MODE controls whether the frontend uses bundled static data or
// reads/writes against the live HashKey Testnet contracts.
//
//  true  -> static comparison data, no wallet required. Safe public-facing default
//           for the Vercel deployment so visitors can browse the project end-to-end.
//  false -> live on-chain reads + writes. Requires a connected wallet on HashKey
//           Testnet (chain 133) and the deployer-funded compliance state below.
//
// Flip to false locally if you have a funded wallet and want to exercise the full
// submitProof / canTransfer / revoke pipeline against the deployed contracts.
export const DEMO_MODE = true;

// Deployed to HashKey Testnet (Chain ID 133)
// Explorer: https://testnet-explorer.hsk.xyz
export const CONTRACTS = {
  groth16Verifier: "0xC65EeAbCD9B10dD3c11a5f5bb5DBd7C83D716386",
  revocationRegistry: "0x0261458Af146a1Fbd718722Af139974aDF2Afe8b",
  identityTreeManager: "0xA763ed1D503c7C36b123A3B8268461A9CA311b16",
  zkComplianceModule: "0x5Fe9E99EA98cEF1f66647E5d038bBE539dD3f744",
  rwaToken: "0x2F4647adf1824e87FaAc34531CB320206cd72151",
  // Standard ERC-3643 comparison contracts
  simpleIdentityRegistry: "0xe0c0Fb6edd33Fd98a2556dA63e38f9C161f1514E",
  standardComplianceModule: "0x7FB37f8216bACD5B3b4609507C79fE51f2b561b6",
  standardRWAToken: "0xE2071b1B1894DE4605b50c279491A98862F37d4b",
} as const;

export const ZK_COMPLIANCE_ABI = [
  {
    inputs: [
      { name: "a", type: "uint256[2]" },
      { name: "b", type: "uint256[2][2]" },
      { name: "c", type: "uint256[2]" },
      { name: "publicSignals", type: "uint256[]" },
    ],
    name: "submitProof",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "canTransfer",
    outputs: [{ type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "", type: "address" }],
    name: "lastProofTimestamp",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const REVOCATION_ABI = [
  {
    inputs: [
      { name: "claimNullifier", type: "bytes32" },
      { name: "newRoot", type: "bytes32" },
    ],
    name: "revoke",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "revocationRoot",
    outputs: [{ type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const RWA_TOKEN_ABI = [
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const SIMPLE_IDENTITY_REGISTRY_ABI = [
  {
    inputs: [{ name: "user", type: "address" }],
    name: "kycLevel",
    outputs: [{ type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "jurisdiction",
    outputs: [{ type: "uint16" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "isAccredited",
    outputs: [{ type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "kycExpiry",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "isVerified",
    outputs: [{ type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "registered",
    outputs: [{ type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const IDENTITY_TREE_ABI = [
  {
    inputs: [],
    name: "identityRoot",
    outputs: [{ type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "identityCount",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
