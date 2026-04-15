/**
 * In-memory Merkle and Sparse-Merkle trees using circomlibjs Poseidon.
 *
 * Both trees are height 20 to match the Circom circuit. They cache all
 * computed nodes so path lookups are O(height). Zero subtree hashes are
 * computed once per Poseidon instance.
 *
 * The trees are persisted on `globalThis` so `next dev` hot-reloads and
 * serverless warm-starts keep the state alive across requests.
 */

import { buildPoseidon } from "circomlibjs";

export const TREE_HEIGHT = 20;

// -----------------------------------------------------------------------
// Shared Poseidon instance
// -----------------------------------------------------------------------

let _poseidon: any | null = null;
let _poseidonPromise: Promise<any> | null = null;

export async function getPoseidon(): Promise<any> {
  if (_poseidon) return _poseidon;
  if (!_poseidonPromise) {
    _poseidonPromise = buildPoseidon().then((p) => {
      _poseidon = p;
      return p;
    });
  }
  return _poseidonPromise;
}

/**
 * Recompute a Merkle root by walking a leaf up through its sibling path.
 * Mirrors the circuit's MerkleTreeInclusion template — `pathIndices[i]`
 * is 0 when the current node is the left child, 1 when it's the right
 * child. Returns the reconstructed root as a bigint.
 */
export async function computeRootFromPath(
  leaf: bigint,
  pathElements: bigint[],
  pathIndices: number[]
): Promise<bigint> {
  if (pathElements.length !== pathIndices.length) {
    throw new Error("computeRootFromPath: length mismatch");
  }
  const poseidon = await getPoseidon();
  const F = poseidon.F;
  let current = leaf;
  for (let i = 0; i < pathElements.length; i++) {
    const sibling = pathElements[i];
    const isLeft = pathIndices[i] === 0;
    current = isLeft
      ? (F.toObject(poseidon([current, sibling])) as bigint)
      : (F.toObject(poseidon([sibling, current])) as bigint);
  }
  return current;
}

async function getZeroHashes(): Promise<bigint[]> {
  const poseidon = await getPoseidon();
  const F = poseidon.F;
  const zeros: bigint[] = [F.toObject(poseidon([BigInt(0)])) as bigint];
  for (let i = 1; i <= TREE_HEIGHT; i++) {
    zeros.push(
      F.toObject(poseidon([zeros[i - 1], zeros[i - 1]])) as bigint
    );
  }
  return zeros;
}

// -----------------------------------------------------------------------
// Tree classes
// -----------------------------------------------------------------------

/**
 * Shared base: an explicitly-indexed binary Merkle tree of height H.
 * Node storage is sparse — we only keep nodes that differ from the
 * zero-hash at their level. Reads default to the zero hash.
 */
class BaseTree {
  height = TREE_HEIGHT;
  nodes: Map<string, bigint> = new Map();
  zeroHashes: bigint[] = [];
  ready = false;

  async init() {
    if (this.ready) return;
    this.zeroHashes = await getZeroHashes();
    this.ready = true;
  }

  private key(level: number, index: number) {
    return `${level}:${index}`;
  }

  protected getNode(level: number, index: number): bigint {
    const v = this.nodes.get(this.key(level, index));
    return v !== undefined ? v : this.zeroHashes[level];
  }

  protected setNode(level: number, index: number, value: bigint) {
    if (value === this.zeroHashes[level]) {
      this.nodes.delete(this.key(level, index));
    } else {
      this.nodes.set(this.key(level, index), value);
    }
  }

  /**
   * Insert / overwrite a leaf at the given index and walk the parent
   * chain up to the root, rehashing as we go.
   */
  protected async writeLeaf(leafIndex: number, leafValue: bigint) {
    const poseidon = await getPoseidon();
    const F = poseidon.F;

    this.setNode(0, leafIndex, leafValue);

    let currentIndex = leafIndex;
    let currentValue = leafValue;

    for (let level = 0; level < this.height; level++) {
      const isLeft = (currentIndex & 1) === 0;
      const siblingIndex = currentIndex ^ 1;
      const sibling = this.getNode(level, siblingIndex);

      const parentVal = isLeft
        ? (F.toObject(poseidon([currentValue, sibling])) as bigint)
        : (F.toObject(poseidon([sibling, currentValue])) as bigint);

      const parentIndex = currentIndex >> 1;
      this.setNode(level + 1, parentIndex, parentVal);

      currentIndex = parentIndex;
      currentValue = parentVal;
    }
  }

  /**
   * Collect the sibling path from leaf `leafIndex` up to the root.
   * Returns both `elements` (sibling hashes) and `indices` (0 = current
   * is left child, 1 = right child) — exactly the shape the circuit
   * expects.
   */
  getPath(leafIndex: number): {
    elements: bigint[];
    indices: number[];
  } {
    const elements: bigint[] = [];
    const indices: number[] = [];
    let currentIndex = leafIndex;
    for (let level = 0; level < this.height; level++) {
      const isLeft = (currentIndex & 1) === 0;
      const siblingIndex = currentIndex ^ 1;
      elements.push(this.getNode(level, siblingIndex));
      indices.push(isLeft ? 0 : 1);
      currentIndex >>= 1;
    }
    return { elements, indices };
  }

  getRoot(): bigint {
    return this.getNode(this.height, 0);
  }

  clear() {
    this.nodes.clear();
  }
}

/**
 * Append-only incremental Merkle tree indexed by `nextIndex`.
 * Used for the identity registry.
 */
export class IncrementalMerkleTree extends BaseTree {
  nextIndex = 0;

  async insertLeaf(leafValue: bigint): Promise<number> {
    await this.init();
    const idx = this.nextIndex;
    await this.writeLeaf(idx, leafValue);
    this.nextIndex += 1;
    return idx;
  }

  /** Re-hash an existing leaf to a new value — used for revocation of a
   *  specific identity leaf, not currently called. */
  async updateLeaf(leafIndex: number, leafValue: bigint): Promise<void> {
    await this.init();
    await this.writeLeaf(leafIndex, leafValue);
  }

  override clear() {
    super.clear();
    this.nextIndex = 0;
  }
}

/**
 * Sparse Merkle Tree indexed by the low `TREE_HEIGHT` bits of a field
 * element (used for revocation). Non-inclusion is proved by showing
 * `getPath` siblings combine with an empty leaf to reproduce the root.
 */
export class SparseMerkleTree extends BaseTree {
  /**
   * Compute the leaf index for a nullifier — the low TREE_HEIGHT bits
   * treated as a little-endian integer. Matches the circuit's bit walk.
   */
  static leafIndexForNullifier(nullifier: bigint): number {
    const mask = (BigInt(1) << BigInt(TREE_HEIGHT)) - BigInt(1);
    return Number(nullifier & mask);
  }

  /** Path bits for a nullifier, LSB-first — same convention the circuit
   *  uses for revocationPathIndices. */
  static pathIndicesForNullifier(nullifier: bigint): number[] {
    const bits: number[] = [];
    for (let i = 0; i < TREE_HEIGHT; i++) {
      bits.push(Number((nullifier >> BigInt(i)) & BigInt(1)));
    }
    return bits;
  }

  /** Insert the standard "revoked" marker for a nullifier. */
  async revokeNullifier(nullifier: bigint): Promise<void> {
    await this.init();
    const poseidon = await getPoseidon();
    const F = poseidon.F;
    const revokedLeaf = F.toObject(poseidon([BigInt(1)])) as bigint;
    const leafIndex = SparseMerkleTree.leafIndexForNullifier(nullifier);
    await this.writeLeaf(leafIndex, revokedLeaf);
  }

  /** Siblings along a nullifier's path — used as witness to prove
   *  non-inclusion for a still-valid nullifier. */
  getSiblingsForNullifier(nullifier: bigint): bigint[] {
    const leafIndex = SparseMerkleTree.leafIndexForNullifier(nullifier);
    return this.getPath(leafIndex).elements;
  }
}
