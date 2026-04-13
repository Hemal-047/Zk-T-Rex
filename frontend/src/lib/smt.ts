// Sparse Merkle Tree implementation for revocation checks
// Uses Poseidon hash from circomlibjs

export class SparseMerkleTree {
  private tree: Map<string, bigint>;
  private height: number;
  private poseidon: any;
  private F: any;
  private zeroHashes: bigint[];

  constructor(height: number, poseidon: any) {
    this.height = height;
    this.poseidon = poseidon;
    this.F = poseidon.F;
    this.tree = new Map();

    // Precompute zero hashes
    this.zeroHashes = [this.F.toObject(poseidon([BigInt(0)]))];
    for (let i = 1; i <= height; i++) {
      this.zeroHashes.push(
        this.F.toObject(poseidon([this.zeroHashes[i - 1], this.zeroHashes[i - 1]]))
      );
    }
  }

  getRoot(): bigint {
    return this._getNode(this.height, BigInt(0));
  }

  insert(index: bigint, value: bigint): void {
    const key = `${this.height}:${index}`;
    // Store the leaf value
    this.tree.set(`0:${index}`, value);
    // Invalidate cached nodes up the tree
    this._invalidatePath(index);
  }

  getSiblings(index: bigint): bigint[] {
    const siblings: bigint[] = [];
    let currentIndex = index;

    for (let level = 0; level < this.height; level++) {
      const siblingIndex = currentIndex ^ BigInt(1);
      siblings.push(this._getNode(level, siblingIndex));
      currentIndex = currentIndex >> BigInt(1);
    }

    return siblings;
  }

  getNonInclusionProof(index: bigint): { siblings: string[]; root: string } {
    // For non-inclusion, the leaf at index must be 0 (empty)
    const leafKey = `0:${index}`;
    const leafValue = this.tree.get(leafKey) || BigInt(0);
    if (leafValue !== BigInt(0)) {
      throw new Error("Cannot prove non-inclusion: leaf is occupied (user is revoked)");
    }

    const siblings = this.getSiblings(index);
    return {
      siblings: siblings.map((s) => s.toString()),
      root: this.getRoot().toString(),
    };
  }

  private _getNode(level: number, index: bigint): bigint {
    const key = `${level}:${index}`;
    if (this.tree.has(key)) {
      return this.tree.get(key)!;
    }

    if (level === 0) {
      // Leaf level: hash of 0 for empty, hash of value for occupied
      const rawValue = this.tree.get(`0:${index}`) || BigInt(0);
      return this.F.toObject(this.poseidon([rawValue]));
    }

    // Internal node: hash of children
    const leftChild = this._getNode(level - 1, index * BigInt(2));
    const rightChild = this._getNode(level - 1, index * BigInt(2) + BigInt(1));

    if (leftChild === this.zeroHashes[level - 1] && rightChild === this.zeroHashes[level - 1]) {
      return this.zeroHashes[level];
    }

    const hash = this.F.toObject(this.poseidon([leftChild, rightChild]));
    this.tree.set(key, hash);
    return hash;
  }

  private _invalidatePath(leafIndex: bigint): void {
    let currentIndex = leafIndex;
    for (let level = 1; level <= this.height; level++) {
      currentIndex = currentIndex >> BigInt(1);
      this.tree.delete(`${level}:${currentIndex}`);
    }
  }
}
