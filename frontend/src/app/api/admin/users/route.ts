/**
 * GET /api/admin/users
 *
 * Headers: x-admin-key: <ADMIN_API_KEY>
 *
 * Returns the list of wallets tracked in the in-memory user store and
 * a snapshot of the current tree state.
 */

import { NextRequest, NextResponse } from "next/server";
import { listUsers, storeSnapshot } from "../../../../lib/server/userStore";
import { toBytes32Hex } from "../../../../lib/server/issuer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
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

  const users = listUsers().map((u) => ({
    wallet: u.wallet,
    leafIndex: u.leafIndex,
    issuedAt: u.issuedAt,
    commitment: toBytes32Hex(u.commitment),
    nullifier: toBytes32Hex(u.claimNullifier),
    revoked: !!u.revoked,
    updateRootTxHash: u.updateRootTxHash ?? null,
    mintTxHash: u.mintTxHash ?? null,
    revokeTxHash: u.revokeTxHash ?? null,
  }));

  const snapshot = await storeSnapshot();

  return NextResponse.json({
    users,
    tree: {
      identityRoot: snapshot.identityRoot,
      identityRootBytes32: toBytes32Hex(snapshot.identityRoot),
      revocationRoot: snapshot.revocationRoot,
      revocationRootBytes32: toBytes32Hex(snapshot.revocationRoot),
      leafCount: snapshot.leafCount,
      userCount: snapshot.userCount,
    },
  });
}
