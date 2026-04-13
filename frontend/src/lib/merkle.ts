// Merkle tree construction for identity tree
// Uses Poseidon hash from circomlibjs

export class MerkleTree {
  private levels: number;
  private poseidon: any;
  private F: any;
  private zeroHashes: bigint[];
  private leaves: bigint[];
  private nodes: Map<string, bigint>;

  constructor(levels: number, poseidon: any) {
    this.levels = levels;
    this.poseidon = poseidon;
    this.F = poseidon.F;
    this.leaves = [];
    this.nodes = new Map();

    // Precompute zero hashes for empty subtrees
    this.zeroHashes = [this.F.toObject(poseidon([BigInt(0)]))];
    for (let i = 1; i <= levels; i++) {
      this.zeroHashes.push(
        this.F.toObject(poseidon([this.zeroHashes[i - 1], this.zeroHashes[i - 1]]))
      );
    }
  }

  insert(leaf: bigint): number {
    const index = this.leaves.length;
    this.leaves.push(leaf);
    this._updatePath(index);
    return index;
  }

  getRoot(): bigint {
    if (this.leaves.length === 0) {
      return this.zeroHashes[this.levels];
    }
    return this._getNode(this.levels, 0);
  }

  getProof(index: number): { pathElements: string[]; pathIndices: number[] } {
    const pathElements: string[] = [];
    const pathIndices: number[] = [];
    let currentIndex = index;

    for (let level = 0; level < this.levels; level++) {
      const siblingIndex = currentIndex ^ 1;
      pathElements.push(this._getNode(level, siblingIndex).toString());
      pathIndices.push(currentIndex & 1);
      currentIndex = currentIndex >> 1;
    }

    return { pathElements, pathIndices };
  }

  private _getNode(level: number, index: number): bigint {
    const key = `${level}:${index}`;
    if (this.nodes.has(key)) {
      return this.nodes.get(key)!;
    }

    if (level === 0) {
      if (index < this.leaves.length) {
        return this.leaves[index];
      }
      return this.zeroHashes[0];
    }

    const left = this._getNode(level - 1, index * 2);
    const right = this._getNode(level - 1, index * 2 + 1);

    if (left === this.zeroHashes[level - 1] && right === this.zeroHashes[level - 1]) {
      return this.zeroHashes[level];
    }

    const hash = this.F.toObject(this.poseidon([left, right]));
    this.nodes.set(key, hash);
    return hash;
  }

  private _updatePath(leafIndex: number): void {
    let currentIndex = leafIndex;
    for (let level = 1; level <= this.levels; level++) {
      currentIndex = currentIndex >> 1;
      this.nodes.delete(`${level}:${currentIndex}`);
    }
  }
}
