/**
 * Server-side state: identity Merkle tree + revocation SMT + per-wallet
 * user records. Stored on globalThis so warm-starts and `next dev`
 * hot-reloads keep the state alive across requests.
 *
 * IMPORTANT: this is in-memory only. A Vercel cold start wipes the
 * whole state. When that happens the next /api/issue-credential call
 * will reset the on-chain identityRoot to match our now-empty tree —
 * previously-issued credentials become invalid. For hackathon scope
 * this is acceptable and clearly labeled in the admin panel.
 */

import { IncrementalMerkleTree, SparseMerkleTree } from "./merkleTrees";

export interface UserRecord {
  wallet: `0x${string}`;
  leafIndex: number;
  issuedAt: number;

  // Claim — the user's unique KYC data
  claimTopic: string;
  claimValue: string;
  claimExpirationDate: string;
  claimSecret: string;

  // EdDSA signature of Poseidon(topic, value, expiration, secret)
  sigR8x: string;
  sigR8y: string;
  sigS: string;

  // Cached derived values
  claimHash: string;
  commitment: string;
  claimNullifier: string;

  // On-chain side-effects
  rootAfterInsert: string;
  updateRootTxHash?: `0x${string}`;
  mintTxHash?: `0x${string}`;
  revoked?: boolean;
  revokeTxHash?: `0x${string}`;
}

interface Store {
  identityTree: IncrementalMerkleTree;
  revocationTree: SparseMerkleTree;
  users: Map<string, UserRecord>; // key: lowercase wallet
}

// Persist the store on globalThis so it survives HMR and serverless
// warm-starts. The symbol is distinct from any user land symbol.
const GLOBAL_KEY = Symbol.for("zktrex.serverStore.v2");
type GlobalWithStore = typeof globalThis & {
  [k: symbol]: Store | undefined;
};

function getStore(): Store {
  const g = globalThis as GlobalWithStore;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = {
      identityTree: new IncrementalMerkleTree(),
      revocationTree: new SparseMerkleTree(),
      users: new Map(),
    };
  }
  return g[GLOBAL_KEY]!;
}

export async function getIdentityTree(): Promise<IncrementalMerkleTree> {
  const store = getStore();
  await store.identityTree.init();
  return store.identityTree;
}

export async function getRevocationTree(): Promise<SparseMerkleTree> {
  const store = getStore();
  await store.revocationTree.init();
  return store.revocationTree;
}

export function recordUser(record: UserRecord) {
  getStore().users.set(record.wallet.toLowerCase(), record);
}

export function getUser(wallet: string): UserRecord | undefined {
  return getStore().users.get(wallet.toLowerCase());
}

export function updateUser(
  wallet: string,
  patch: Partial<UserRecord>
): UserRecord | undefined {
  const existing = getUser(wallet);
  if (!existing) return undefined;
  const merged = { ...existing, ...patch };
  getStore().users.set(wallet.toLowerCase(), merged);
  return merged;
}

export function listUsers(): UserRecord[] {
  return Array.from(getStore().users.values()).sort(
    (a, b) => b.issuedAt - a.issuedAt
  );
}

export function removeUser(wallet: string) {
  getStore().users.delete(wallet.toLowerCase());
}

export async function resetStore() {
  const store = getStore();
  store.identityTree.clear();
  store.revocationTree.clear();
  store.users.clear();
  await store.identityTree.init();
  await store.revocationTree.init();
}

export async function storeSnapshot() {
  const store = getStore();
  await store.identityTree.init();
  await store.revocationTree.init();
  return {
    identityRoot: store.identityTree.getRoot().toString(),
    revocationRoot: store.revocationTree.getRoot().toString(),
    leafCount: store.identityTree.nextIndex,
    userCount: store.users.size,
  };
}
