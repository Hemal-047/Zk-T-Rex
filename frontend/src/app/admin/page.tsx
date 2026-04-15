"use client";

import { useEffect, useState } from "react";
import { useReadContract } from "wagmi";
import {
  CONTRACTS,
  IDENTITY_TREE_ABI,
  REVOCATION_ABI,
} from "../../lib/contracts";

interface AdminUser {
  wallet: string;
  issuedAt: number;
  claimNullifier: string;
  mintTxHash?: string;
}

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; kind: "ok" | "err" } | null>(
    null
  );

  const { data: identityRoot, refetch: refetchIdentity } = useReadContract({
    address: CONTRACTS.identityTreeManager as `0x${string}`,
    abi: IDENTITY_TREE_ABI,
    functionName: "identityRoot",
  });

  const { data: identityCount } = useReadContract({
    address: CONTRACTS.identityTreeManager as `0x${string}`,
    abi: IDENTITY_TREE_ABI,
    functionName: "identityCount",
  });

  const { data: revocationRoot, refetch: refetchRevoc } = useReadContract({
    address: CONTRACTS.revocationRegistry as `0x${string}`,
    abi: REVOCATION_ABI,
    functionName: "revocationRoot",
  });

  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? sessionStorage.getItem("zktrex:adminKey")
        : null;
    if (saved) {
      setAdminKey(saved);
      setAuthed(true);
    }
  }, []);

  const authenticate = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/users", {
        headers: { "x-admin-key": adminKey },
      });
      if (!res.ok) throw new Error("Invalid admin key");
      const data = await res.json();
      setUsers(data.users ?? []);
      sessionStorage.setItem("zktrex:adminKey", adminKey);
      setAuthed(true);
    } catch (err: any) {
      setMsg({ text: err.message, kind: "err" });
    } finally {
      setLoading(false);
    }
  };

  const reloadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        headers: { "x-admin-key": adminKey },
      });
      const data = await res.json();
      setUsers(data.users ?? []);
    } finally {
      setLoading(false);
    }
  };

  const revokeUser = async (user: AdminUser) => {
    if (!confirm(`Revoke ${user.wallet}? They will no longer be able to transfer.`))
      return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/revoke", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({
          wallet: user.wallet,
          claimNullifier: user.claimNullifier,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Revoke failed");
      setMsg({
        text: `Revoked. TX: ${data.txHash}`,
        kind: "ok",
      });
      await refetchRevoc();
      await reloadUsers();
    } catch (err: any) {
      setMsg({ text: err.message, kind: "err" });
    } finally {
      setLoading(false);
    }
  };

  const resetRevocation = async () => {
    if (!confirm("Reset the revocation tree? All revocations will be cleared."))
      return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/reset-revocation", {
        method: "POST",
        headers: { "x-admin-key": adminKey },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");
      setMsg({ text: `Revocation tree reset. TX: ${data.txHash}`, kind: "ok" });
      await refetchRevoc();
      await refetchIdentity();
    } catch (err: any) {
      setMsg({ text: err.message, kind: "err" });
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    sessionStorage.removeItem("zktrex:adminKey");
    setAuthed(false);
    setAdminKey("");
    setUsers([]);
  };

  if (!authed) {
    return (
      <main className="min-h-screen bg-[#0a0b0d] px-6 py-12">
        <div className="mx-auto max-w-md">
          <h1 className="mb-2 text-2xl font-bold text-white">Admin Panel</h1>
          <p className="mb-6 text-sm text-zinc-500">
            Enter your admin API key to manage verified users and revocations.
          </p>
          <div className="card">
            <label className="label">Admin Key</label>
            <input
              type="password"
              className="input w-full"
              placeholder="ADMIN_API_KEY"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && authenticate()}
            />
            <button
              className="btn-primary mt-4 w-full"
              onClick={authenticate}
              disabled={!adminKey || loading}
            >
              {loading ? "Checking..." : "Sign In"}
            </button>
            {msg && (
              <div
                className={`mt-4 rounded-lg p-3 text-sm ${
                  msg.kind === "ok"
                    ? "bg-green-500/10 text-green-400"
                    : "bg-red-500/10 text-red-400"
                }`}
              >
                {msg.text}
              </div>
            )}
            <p className="mt-4 text-xs text-zinc-600">
              <a href="/" className="hover:text-zinc-400">
                ← Back to app
              </a>
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0b0d] px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
            <p className="text-sm text-zinc-500">
              Manage verified users and the revocation tree.
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href="/"
              className="rounded-lg border border-[#1e2028] px-3 py-1.5 text-sm text-zinc-400 hover:text-white"
            >
              ← App
            </a>
            <button
              className="rounded-lg border border-[#1e2028] px-3 py-1.5 text-sm text-zinc-400 hover:text-white"
              onClick={logout}
            >
              Sign out
            </button>
          </div>
        </div>

        {msg && (
          <div
            className={`mb-4 rounded-lg p-3 text-sm ${
              msg.kind === "ok"
                ? "bg-green-500/10 text-green-400"
                : "bg-red-500/10 text-red-400"
            }`}
          >
            {msg.text}
          </div>
        )}

        {/* Tree state */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="card">
            <div className="label">Identity Root</div>
            <div className="mt-1 break-all font-mono text-xs text-zinc-300">
              {identityRoot ? String(identityRoot) : "—"}
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              Count: {identityCount?.toString() ?? "—"}
            </div>
          </div>
          <div className="card">
            <div className="label">Revocation Root</div>
            <div className="mt-1 break-all font-mono text-xs text-zinc-300">
              {revocationRoot ? String(revocationRoot) : "—"}
            </div>
            <button
              className="mt-3 rounded-lg border border-red-500/20 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
              onClick={resetRevocation}
              disabled={loading}
            >
              Reset revocation tree
            </button>
          </div>
          <div className="card">
            <div className="label">Tracked Users</div>
            <div className="mt-1 text-2xl font-bold text-white">{users.length}</div>
            <div className="mt-1 text-xs text-zinc-500">
              In-memory only (resets on cold start)
            </div>
            <button
              className="mt-3 rounded-lg border border-[#1e2028] px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
              onClick={reloadUsers}
              disabled={loading}
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Users */}
        <div className="card">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Verified Users
          </h2>
          {users.length === 0 ? (
            <div className="py-6 text-center text-sm text-zinc-500">
              No users yet. Have someone click &ldquo;Get Verified&rdquo; on the
              main app.
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div
                  key={u.wallet}
                  className="flex items-center justify-between rounded-lg bg-zinc-800/30 px-3 py-2"
                >
                  <div>
                    <div className="font-mono text-xs text-zinc-300">
                      {u.wallet}
                    </div>
                    <div className="text-[11px] text-zinc-600">
                      Issued {new Date(u.issuedAt).toLocaleString()}
                      {u.mintTxHash && (
                        <>
                          {" · "}
                          <a
                            href={`https://testnet-explorer.hsk.xyz/tx/${u.mintTxHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-400 hover:text-blue-300"
                          >
                            mint ↗
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    className="rounded-lg border border-red-500/20 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10"
                    onClick={() => revokeUser(u)}
                    disabled={loading}
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
