/**
 * POST /api/reset-revocation
 *
 * Headers: x-admin-key: <ADMIN_API_KEY>
 *
 * Clears the in-memory revocation SMT, syncs the empty root on-chain,
 * and un-revokes all users in the store.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getRevocationTree,
  listUsers,
  updateUser,
} from "../../../lib/server/userStore";
import { toBytes32Hex } from "../../../lib/server/issuer";
import { getServerWallet } from "../../../lib/server/chain";
import { withTreeLock } from "../../../lib/server/treeLock";
import { CONTRACTS, REVOCATION_ABI } from "../../../lib/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) {
    return NextResponse.json(
      { error: "ADMIN_API_KEY not configured" },
      { status: 401 }
    );
  }
  if (req.headers.get("x-admin-key") !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { txHash, newRootBytes32 } = await withTreeLock(async () => {
      const tree = await getRevocationTree();
      tree.clear();
      await tree.init();
      const newRootBytes32 = toBytes32Hex(tree.getRoot());

      const { walletClient, publicClient, account } = getServerWallet();
      const hash = await walletClient.writeContract({
        account,
        chain: walletClient.chain,
        address: CONTRACTS.revocationRegistry as `0x${string}`,
        abi: REVOCATION_ABI,
        functionName: "revoke",
        args: [
          "0x0000000000000000000000000000000000000000000000000000000000000000",
          newRootBytes32,
        ],
      });
      await publicClient.waitForTransactionReceipt({
        hash,
        timeout: 30_000,
      });
      return { txHash: hash, newRootBytes32 };
    });

    // Un-revoke every user
    for (const u of listUsers()) {
      if (u.revoked) {
        updateUser(u.wallet, { revoked: false, revokeTxHash: undefined });
      }
    }

    return NextResponse.json({ ok: true, txHash, newRootBytes32 });
  } catch (err: any) {
    console.error("[reset-revocation] error:", err);
    return NextResponse.json(
      { error: err?.shortMessage || err?.message || "Internal error" },
      { status: 500 }
    );
  }
}
