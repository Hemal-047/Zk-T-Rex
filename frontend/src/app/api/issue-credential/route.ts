/**
 * POST /api/issue-credential
 *
 * Body: { wallet: "0x..." }
 *
 * 1. Generates a unique claim for the wallet (fresh claimSecret).
 * 2. Signs the claim with the issuer's EdDSA key.
 * 3. Inserts the identity commitment into the in-memory Merkle tree.
 * 4. Calls IdentityTreeManager.updateRoot() with the new root so the
 *    on-chain state stays in sync with the in-memory state.
 * 5. Mints 1,000 hkBOND to the wallet.
 * 6. Stores the full user record server-side so /api/get-proof-inputs
 *    can build fresh Merkle paths later.
 *
 * The user's browser only holds a short "credential handle" that says
 * "yes, you're verified" plus the display-only identifiers. The secret
 * material stays server-side — another wallet can't forge a proof with
 * someone else's claim secret.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAddress, isAddress, parseEther } from "viem";
import {
  generateUserClaim,
  getIssuerPublicKey,
  toBytes32Hex,
} from "../../../lib/server/issuer";
import { getServerWallet } from "../../../lib/server/chain";
import {
  getIdentityTree,
  getRevocationTree,
  getUser,
  recordUser,
  storeSnapshot,
} from "../../../lib/server/userStore";
import { withTreeLock } from "../../../lib/server/treeLock";
import {
  CONTRACTS,
  IDENTITY_TREE_ABI,
  RWA_TOKEN_ABI,
} from "../../../lib/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MINT_AMOUNT = parseEther("1000"); // 1000 hkBOND airdrop

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawWallet = typeof body.wallet === "string" ? body.wallet : "";

    if (!isAddress(rawWallet)) {
      return NextResponse.json(
        { error: "Invalid wallet address" },
        { status: 400 }
      );
    }
    const wallet = getAddress(rawWallet) as `0x${string}`;

    // If this wallet already has a live record, return the existing
    // credential handle so re-verification is idempotent. We still mint
    // another batch of hkBOND so the UX feels alive.
    const existing = getUser(wallet);
    let claim;
    let leafIndex: number;
    let rootAfterInsert: bigint;
    let updateRootTxHash: `0x${string}` | undefined;

    if (existing && !existing.revoked) {
      claim = null; // no new claim generated
      leafIndex = existing.leafIndex;
      const tree = await getIdentityTree();
      rootAfterInsert = tree.getRoot();
    } else {
      // Generate a unique claim AND update the tree under the lock so
      // concurrent requests can't race on the nextIndex counter or the
      // on-chain updateRoot transaction.
      const result = await withTreeLock(async () => {
        const freshClaim = await generateUserClaim();
        const tree = await getIdentityTree();
        const idx = await tree.insertLeaf(freshClaim.commitment);
        const newRoot = tree.getRoot();

        console.log("[issue-credential] inserting leaf", {
          wallet,
          commitment: toBytes32Hex(freshClaim.commitment),
          leafIndex: idx,
          rootBeforeChainUpdate: toBytes32Hex(newRoot),
        });

        // Sync on-chain
        const { walletClient, publicClient, account } = getServerWallet();
        const txHash = await walletClient.writeContract({
          account,
          chain: walletClient.chain,
          address: CONTRACTS.identityTreeManager as `0x${string}`,
          abi: IDENTITY_TREE_ABI,
          functionName: "addIdentity",
          args: [toBytes32Hex(newRoot), toBytes32Hex(freshClaim.commitment)],
        });
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
          timeout: 30_000,
        });

        console.log("[issue-credential] addIdentity tx", {
          txHash,
          status: receipt.status,
          blockNumber: receipt.blockNumber.toString(),
        });

        return {
          claim: freshClaim,
          idx,
          newRoot,
          txHash,
        };
      });

      claim = result.claim;
      leafIndex = result.idx;
      rootAfterInsert = result.newRoot;
      updateRootTxHash = result.txHash;

      // Persist user record with the fresh claim
      recordUser({
        wallet,
        leafIndex,
        issuedAt: Date.now(),
        claimTopic: claim.claimTopic.toString(),
        claimValue: claim.claimValue.toString(),
        claimExpirationDate: claim.claimExpirationDate.toString(),
        claimSecret: claim.claimSecret.toString(),
        sigR8x: claim.sigR8x.toString(),
        sigR8y: claim.sigR8y.toString(),
        sigS: claim.sigS.toString(),
        claimHash: claim.claimHash.toString(),
        commitment: claim.commitment.toString(),
        claimNullifier: claim.claimNullifier.toString(),
        rootAfterInsert: rootAfterInsert.toString(),
        updateRootTxHash,
      });
    }

    // Airdrop hkBOND — outside the tree lock, it's independent
    let mintTxHash: `0x${string}` | undefined;
    let mintError: string | undefined;
    try {
      const { walletClient, publicClient, account } = getServerWallet();
      const hash = await walletClient.writeContract({
        account,
        chain: walletClient.chain,
        address: CONTRACTS.rwaToken as `0x${string}`,
        abi: RWA_TOKEN_ABI,
        functionName: "mint",
        args: [wallet, MINT_AMOUNT],
      });
      mintTxHash = hash;
      await publicClient.waitForTransactionReceipt({
        hash,
        timeout: 15_000,
      });
    } catch (err: any) {
      mintError = err?.shortMessage || err?.message || "Mint failed";
      console.error("[issue-credential] mint failed:", mintError);
    }

    // Load the record that got persisted (handles both new + existing)
    const record = getUser(wallet)!;
    if (mintTxHash) record.mintTxHash = mintTxHash;

    const { ax, ay } = await getIssuerPublicKey();
    const snapshot = await storeSnapshot();

    return NextResponse.json({
      ok: true,
      credential: {
        wallet,
        leafIndex: record.leafIndex,
        claimTopic: record.claimTopic,
        claimValue: record.claimValue,
        claimExpirationDate: record.claimExpirationDate,
        commitmentBytes32: toBytes32Hex(record.commitment),
        nullifierBytes32: toBytes32Hex(record.claimNullifier),
        issuedAt: record.issuedAt,
        reused: !!existing && !existing.revoked,
      },
      tree: {
        identityRoot: snapshot.identityRoot,
        identityRootBytes32: toBytes32Hex(snapshot.identityRoot),
        leafCount: snapshot.leafCount,
        updateRootTxHash: updateRootTxHash ?? null,
      },
      issuer: {
        pubKeyAx: ax.toString(),
        pubKeyAy: ay.toString(),
      },
      mint: {
        txHash: mintTxHash ?? null,
        amount: MINT_AMOUNT.toString(),
        error: mintError ?? null,
      },
    });
  } catch (err: any) {
    console.error("[issue-credential] error:", err);
    return NextResponse.json(
      { error: err?.shortMessage || err?.message || "Internal error" },
      { status: 500 }
    );
  }
}
