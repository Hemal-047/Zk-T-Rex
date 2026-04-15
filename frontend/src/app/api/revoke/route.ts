/**
 * POST /api/revoke
 *
 * Headers: x-admin-key: <ADMIN_API_KEY>
 * Body: { wallet: "0x..." }
 *
 * Looks up the user's claim secret in the in-memory store, derives their
 * unique nullifier, inserts it into the revocation SMT, updates the root
 * on-chain, and marks the user as revoked so /api/get-proof-inputs
 * refuses them.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { computeNullifier, toBytes32Hex } from "../../../lib/server/issuer";
import { getServerWallet } from "../../../lib/server/chain";
import {
  getRevocationTree,
  getUser,
  updateUser,
} from "../../../lib/server/userStore";
import { withTreeLock } from "../../../lib/server/treeLock";
import { CONTRACTS, REVOCATION_ABI } from "../../../lib/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) {
    return NextResponse.json(
      { error: "ADMIN_API_KEY not configured on server" },
      { status: 401 }
    );
  }
  if (req.headers.get("x-admin-key") !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rawWallet = typeof body.wallet === "string" ? body.wallet : "";

    if (!isAddress(rawWallet)) {
      return NextResponse.json(
        { error: "Missing or invalid wallet" },
        { status: 400 }
      );
    }
    const wallet = getAddress(rawWallet);

    const user = getUser(wallet);
    if (!user) {
      return NextResponse.json(
        { error: "Unknown wallet — no server-side record" },
        { status: 404 }
      );
    }

    // Derive the nullifier from the user's stored claimSecret.
    const nullifier = await computeNullifier(
      BigInt(user.claimSecret),
      BigInt(user.claimTopic)
    );
    const nullifierBytes32 = toBytes32Hex(nullifier);

    const { newRootBytes32, txHash } = await withTreeLock(async () => {
      const tree = await getRevocationTree();
      await tree.revokeNullifier(nullifier);
      const newRoot = tree.getRoot();
      const newRootHex = toBytes32Hex(newRoot);

      const { walletClient, publicClient, account } = getServerWallet();
      const hash = await walletClient.writeContract({
        account,
        chain: walletClient.chain,
        address: CONTRACTS.revocationRegistry as `0x${string}`,
        abi: REVOCATION_ABI,
        functionName: "revoke",
        args: [nullifierBytes32, newRootHex],
      });
      await publicClient.waitForTransactionReceipt({
        hash,
        timeout: 30_000,
      });

      return { newRootBytes32: newRootHex, txHash: hash };
    });

    updateUser(wallet, { revoked: true, revokeTxHash: txHash });

    return NextResponse.json({
      ok: true,
      wallet,
      nullifier: nullifierBytes32,
      newRootBytes32,
      txHash,
    });
  } catch (err: any) {
    console.error("[revoke] error:", err);
    return NextResponse.json(
      { error: err?.shortMessage || err?.message || "Internal error" },
      { status: 500 }
    );
  }
}
