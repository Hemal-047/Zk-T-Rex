"use client";

import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatEther, isAddress, parseEther } from "viem";
import {
  CONTRACTS,
  RWA_TOKEN_ABI,
  ZK_COMPLIANCE_ABI,
} from "../lib/contracts";

type Phase = "idle" | "checking" | "transferring" | "done" | "error";

export default function TransferPanel() {
  const { address } = useAccount();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: CONTRACTS.rwaToken as `0x${string}`,
    abi: RWA_TOKEN_ABI,
    functionName: "balanceOf",
    args: [address!],
    query: { enabled: !!address },
  });

  const { data: recipientLastProof, refetch: refetchRecipientProof } =
    useReadContract({
      address: CONTRACTS.zkComplianceModule as `0x${string}`,
      abi: ZK_COMPLIANCE_ABI,
      functionName: "lastProofTimestamp",
      args: [isAddress(recipient) ? (recipient as `0x${string}`) : address!],
      query: { enabled: isAddress(recipient) },
    });

  const { writeContractAsync } = useWriteContract();
  const { isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash ?? undefined,
  });

  const recipientCompliant = (() => {
    if (!isAddress(recipient)) return null;
    const ts = recipientLastProof ? Number(recipientLastProof) : 0;
    if (ts === 0) return false;
    const now = Math.floor(Date.now() / 1000);
    return now - ts < 3600;
  })();

  const handleTransfer = async () => {
    setError("");
    if (!isAddress(recipient)) {
      setError("Invalid recipient address");
      setPhase("error");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setError("Enter an amount greater than zero");
      setPhase("error");
      return;
    }

    try {
      setPhase("checking");
      // Refresh in case the recipient just submitted a proof
      const fresh = await refetchRecipientProof();
      const ts = fresh.data ? Number(fresh.data) : 0;
      const now = Math.floor(Date.now() / 1000);
      if (ts === 0 || now - ts >= 3600) {
        throw new Error(
          "Recipient has no fresh compliance proof. The transfer would revert with 'Transfer not compliant'. Ask the recipient to visit this site, click 'Get Verified', then generate a proof."
        );
      }

      setPhase("transferring");
      const hash = await writeContractAsync({
        address: CONTRACTS.rwaToken as `0x${string}`,
        abi: RWA_TOKEN_ABI,
        functionName: "transfer",
        args: [recipient as `0x${string}`, parseEther(amount)],
      });

      setTxHash(hash);
      setPhase("done");
      // Give the chain a moment, then refresh balance
      setTimeout(() => refetchBalance(), 2000);
    } catch (err: any) {
      setError(err?.shortMessage || err?.message || "Transfer failed");
      setPhase("error");
    }
  };

  return (
    <div className="card">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">
        Step 3 · Transfer hkBOND
      </h2>

      <div className="mb-4 rounded-lg bg-zinc-800/50 p-3">
        <div className="text-xs text-zinc-500">Your balance</div>
        <div className="text-lg font-semibold text-white">
          {balance !== undefined
            ? `${Number(formatEther(balance as bigint)).toLocaleString(undefined, { maximumFractionDigits: 2 })} hkBOND`
            : "—"}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="label">Recipient Address</label>
          <input
            type="text"
            className="input w-full"
            placeholder="0x..."
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
          {isAddress(recipient) && recipientCompliant !== null && (
            <p
              className={`mt-1 text-xs ${
                recipientCompliant ? "text-green-400" : "text-red-400"
              }`}
            >
              {recipientCompliant
                ? "✓ Recipient has a fresh compliance proof"
                : "✗ Recipient has NO fresh proof — transfer will revert"}
            </p>
          )}
        </div>

        <div>
          <label className="label">Amount</label>
          <input
            type="number"
            className="input w-full"
            placeholder="100"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {phase === "done" && txHash && (
          <div className="rounded-lg bg-green-500/10 p-3">
            <div className="text-sm text-green-400">
              {isConfirmed ? "Transfer confirmed!" : "Transfer sent..."}
            </div>
            <a
              href={`https://testnet-explorer.hsk.xyz/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs text-blue-400 hover:text-blue-300"
            >
              {txHash.slice(0, 18)}... ↗
            </a>
          </div>
        )}

        <button
          className="btn-primary w-full"
          onClick={handleTransfer}
          disabled={
            phase === "checking" ||
            phase === "transferring" ||
            !recipient ||
            !amount
          }
        >
          {phase === "checking"
            ? "Checking compliance..."
            : phase === "transferring"
            ? "Transferring..."
            : "Transfer"}
        </button>

        <p className="text-xs text-zinc-600">
          Both sender and recipient must have submitted a valid ZK compliance
          proof within the last hour. The token contract enforces this via the
          ZKComplianceModule hook.
        </p>
      </div>
    </div>
  );
}
