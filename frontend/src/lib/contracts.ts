// When true, the frontend uses bundled demo data for proof generation
// instead of reading from on-chain contracts. Set to false after deployment.
export const DEMO_MODE = true;

// UPDATE AFTER DEPLOYMENT — replace with actual deployed addresses
export const CONTRACTS = {
  groth16Verifier: "0x0000000000000000000000000000000000000000",
  revocationRegistry: "0x0000000000000000000000000000000000000000",
  identityTreeManager: "0x0000000000000000000000000000000000000000",
  zkComplianceModule: "0x0000000000000000000000000000000000000000",
  rwaToken: "0x0000000000000000000000000000000000000000",
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
