/**
 * GET /api/get-proof-inputs?wallet=0x...
 *
 * Returns a complete, fresh set of Groth16 circuit inputs for the given
 * wallet. The Merkle path is recomputed against the CURRENT identity
 * tree, so even if other users have registered since this user was
 * issued, the path will still verify against the live root.
 *
 * Before returning the inputs we RECONSTRUCT both roots from the
 * witness (leaf + siblings) and compare them against the live on-chain
 * values. If either reconstruction disagrees with the chain, the server
 * refuses to hand out stale inputs and tells the client to re-issue the
 * credential. This avoids the opaque "Identity/Revocation root
 * mismatch" revert from ZKComplianceModule.submitProof().
 *
 * Response shape matches ProofInputs in frontend/src/lib/prover.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import {
  getIdentityTree,
  getRevocationTree,
  getUser,
} from "../../../lib/server/userStore";
import {
  getIssuerPublicKey,
  toBytes32Hex,
} from "../../../lib/server/issuer";
import { getServerWallet } from "../../../lib/server/chain";
import {
  CONTRACTS,
  IDENTITY_TREE_ABI,
  REVOCATION_ABI,
} from "../../../lib/contracts";
import {
  SparseMerkleTree,
  computeRootFromPath,
  getPoseidon,
} from "../../../lib/server/merkleTrees";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const walletParam = req.nextUrl.searchParams.get("wallet");
    if (!walletParam || !isAddress(walletParam)) {
      return NextResponse.json(
        { error: "Missing or invalid wallet query parameter" },
        { status: 400 }
      );
    }
    const wallet = getAddress(walletParam);

    const user = getUser(wallet);
    if (!user) {
      return NextResponse.json(
        {
          error:
            "No credential found for this wallet. Call /api/issue-credential first. (Cold starts wipe server state — you may need to re-verify.)",
        },
        { status: 404 }
      );
    }
    if (user.revoked) {
      return NextResponse.json(
        { error: "This wallet's credential has been revoked." },
        { status: 403 }
      );
    }

    // Rebuild fresh Merkle path from the current tree state.
    const identityTree = await getIdentityTree();
    const revocationTree = await getRevocationTree();

    const { elements: pathElements, indices: pathIndices } =
      identityTree.getPath(user.leafIndex);

    // Siblings proving non-inclusion of the user's nullifier in the
    // current revocation SMT.
    const nullifierBig = BigInt(user.claimNullifier);
    const revocationSiblings =
      revocationTree.getSiblingsForNullifier(nullifierBig);
    const revocationPathIndices =
      SparseMerkleTree.pathIndicesForNullifier(nullifierBig);

    const inMemoryIdentityRoot = identityTree.getRoot();
    const inMemoryRevocationRoot = revocationTree.getRoot();

    // Cross-check against on-chain state. If we can't read the chain we
    // fail loudly — returning stale inputs would just cause a confusing
    // revert at proof submission time.
    let onChainIdentityRootHex: `0x${string}`;
    let onChainRevocationRootHex: `0x${string}`;
    try {
      const { publicClient } = getServerWallet();
      onChainIdentityRootHex = (await publicClient.readContract({
        address: CONTRACTS.identityTreeManager as `0x${string}`,
        abi: IDENTITY_TREE_ABI,
        functionName: "identityRoot",
      })) as `0x${string}`;
      onChainRevocationRootHex = (await publicClient.readContract({
        address: CONTRACTS.revocationRegistry as `0x${string}`,
        abi: REVOCATION_ABI,
        functionName: "revocationRoot",
      })) as `0x${string}`;
    } catch (err) {
      console.error("[get-proof-inputs] on-chain read failed:", err);
      return NextResponse.json(
        {
          error:
            "Could not read on-chain roots. Check the RPC and try again.",
        },
        { status: 503 }
      );
    }

    const onChainIdentityRootBig = BigInt(onChainIdentityRootHex);
    const onChainRevocationRootBig = BigInt(onChainRevocationRootHex);

    // RECONSTRUCT each root from the witness we're about to hand to the
    // prover. The identity leaf is the user's commitment. The revocation
    // "leaf" for a non-revoked nullifier is zeroHashes[0] — i.e. the
    // poseidon hash of 0, which is what `getNode(0, leafIndex)` returns
    // for a never-written slot.
    const commitmentBig = BigInt(user.commitment);
    const reconstructedIdentityRoot = await computeRootFromPath(
      commitmentBig,
      pathElements,
      pathIndices
    );

    const poseidon = await getPoseidon();
    const F = poseidon.F;
    const emptyLeaf = F.toObject(poseidon([BigInt(0)])) as bigint;
    const reconstructedRevocationRoot = await computeRootFromPath(
      emptyLeaf,
      revocationSiblings,
      revocationPathIndices
    );

    const identityRootsMatch =
      reconstructedIdentityRoot === onChainIdentityRootBig &&
      inMemoryIdentityRoot === onChainIdentityRootBig;
    const revocationRootsMatch =
      reconstructedRevocationRoot === onChainRevocationRootBig &&
      inMemoryRevocationRoot === onChainRevocationRootBig;

    console.log("[get-proof-inputs]", {
      wallet,
      leafIndex: user.leafIndex,
      commitment: toBytes32Hex(commitmentBig),
      nullifier: toBytes32Hex(nullifierBig),
      inMemoryIdentityRoot: toBytes32Hex(inMemoryIdentityRoot),
      onChainIdentityRoot: onChainIdentityRootHex,
      reconstructedIdentityRoot: toBytes32Hex(reconstructedIdentityRoot),
      identityRootsMatch,
      inMemoryRevocationRoot: toBytes32Hex(inMemoryRevocationRoot),
      onChainRevocationRoot: onChainRevocationRootHex,
      reconstructedRevocationRoot: toBytes32Hex(reconstructedRevocationRoot),
      revocationRootsMatch,
    });

    // Surface tree-out-of-sync as a specific, actionable error so the UI
    // can show "re-issue credential" instead of the ZK module's opaque
    // revert. This is the hackathon cold-start scenario — in-memory
    // server state gets wiped but the chain remembers.
    if (!identityRootsMatch) {
      return NextResponse.json(
        {
          error:
            "Identity tree out of sync with chain. The server's in-memory tree does not reproduce the on-chain identity root (likely a cold start). Please re-issue your credential.",
          details: {
            inMemoryIdentityRoot: toBytes32Hex(inMemoryIdentityRoot),
            reconstructedIdentityRoot: toBytes32Hex(
              reconstructedIdentityRoot
            ),
            onChainIdentityRoot: onChainIdentityRootHex,
          },
        },
        { status: 409 }
      );
    }
    if (!revocationRootsMatch) {
      return NextResponse.json(
        {
          error:
            "Revocation tree out of sync with chain. The server's in-memory SMT does not reproduce the on-chain revocation root (a revocation happened in a previous session the server has forgotten). Please re-issue your credential.",
          details: {
            inMemoryRevocationRoot: toBytes32Hex(inMemoryRevocationRoot),
            reconstructedRevocationRoot: toBytes32Hex(
              reconstructedRevocationRoot
            ),
            onChainRevocationRoot: onChainRevocationRootHex,
          },
        },
        { status: 409 }
      );
    }

    const { ax, ay } = await getIssuerPublicKey();

    const currentTimestamp = Math.floor(Date.now() / 1000).toString();

    // Roots are in sync — publicSignals[1]/[2] from the circuit will be
    // the decimal form of the on-chain bigints, which re-encode back to
    // the exact bytes32 values the compliance contract compares.
    const proofInputs = {
      // Private claim + signature
      claimTopic: user.claimTopic,
      claimValue: user.claimValue,
      claimExpirationDate: user.claimExpirationDate,
      claimSecret: user.claimSecret,
      sigR8x: user.sigR8x,
      sigR8y: user.sigR8y,
      sigS: user.sigS,
      // Private Merkle / SMT witnesses
      identityPathElements: pathElements.map((e) => e.toString()),
      identityPathIndices: pathIndices,
      revocationSiblings: revocationSiblings.map((s) => s.toString()),
      revocationPathIndices,
      // Public — use the on-chain bigints so the circuit output matches
      // what ZKComplianceModule.submitProof() compares against byte-for-byte.
      identityRoot: onChainIdentityRootBig.toString(),
      revocationRoot: onChainRevocationRootBig.toString(),
      currentTimestamp,
      issuerPubKeyAx: ax.toString(),
      issuerPubKeyAy: ay.toString(),
      requiredClaimTopic: user.claimTopic,
    };

    return NextResponse.json({
      ok: true,
      wallet,
      leafIndex: user.leafIndex,
      proofInputs,
      display: {
        identityRootBytes32: onChainIdentityRootHex,
        revocationRootBytes32: onChainRevocationRootHex,
        commitmentBytes32: toBytes32Hex(commitmentBig),
        nullifierBytes32: toBytes32Hex(nullifierBig),
        onChainIdentityRoot: onChainIdentityRootHex,
        onChainRevocationRoot: onChainRevocationRootHex,
        rootsMatch: true,
      },
    });
  } catch (err: any) {
    console.error("[get-proof-inputs] error:", err);
    return NextResponse.json(
      { error: err?.shortMessage || err?.message || "Internal error" },
      { status: 500 }
    );
  }
}
