"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { CONTRACTS, ZK_COMPLIANCE_ABI, RWA_TOKEN_ABI } from "../lib/contracts";
import ProofGenerator from "./ProofGenerator";

type Step = "idle" | "proving" | "submitting" | "transferring" | "complete" | "error";

export default function TransferPanel() {
  const { address } = useAccount();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState("");
  const [proofData, setProofData] = useState<any>(null);

  const { writeContractAsync: submitProof } = useWriteContract();
  const { writeContractAsync: transfer } = useWriteContract();

  const steps: { key: Step; label: string }[] = [
    { key: "proving", label: "Generating ZK Proof" },
    { key: "submitting", label: "Submitting Proof On-chain" },
    { key: "transferring", label: "Executing Transfer" },
    { key: "complete", label: "Complete" },
  ];

  const handleTransfer = async () => {
    if (!recipient || !amount || !address) return;

    try {
      setError("");
      setStep("proving");

      // Step 1: Generate ZK proof (handled by ProofGenerator callback)
      // For demo, we use mock proof data
      const mockProof = {
        a: ["0", "0"] as [string, string],
        b: [["0", "0"], ["0", "0"]] as [[string, string], [string, string]],
        c: ["0", "0"] as [string, string],
        publicSignals: ["1", "0", "0", String(Math.floor(Date.now() / 1000)), "0", "0", "1"],
      };
      setProofData(mockProof);

      // Step 2: Submit proof on-chain
      setStep("submitting");
      const proofTx = await submitProof({
        address: CONTRACTS.zkComplianceModule as `0x${string}`,
        abi: ZK_COMPLIANCE_ABI,
        functionName: "submitProof",
        args: [
          mockProof.a.map(BigInt) as [bigint, bigint],
          mockProof.b.map((r) => r.map(BigInt)) as [[bigint, bigint], [bigint, bigint]],
          mockProof.c.map(BigInt) as [bigint, bigint],
          mockProof.publicSignals.map(BigInt),
        ],
      });

      // Step 3: Execute transfer
      setStep("transferring");
      const transferTx = await transfer({
        address: CONTRACTS.rwaToken as `0x${string}`,
        abi: RWA_TOKEN_ABI,
        functionName: "transfer",
        args: [recipient as `0x${string}`, parseEther(amount)],
      });

      setTxHash(transferTx);
      setStep("complete");
    } catch (err: any) {
      setError(err.message || "Transaction failed");
      setStep("error");
    }
  };

  const getStepStatus = (stepKey: Step) => {
    const stepOrder: Step[] = ["proving", "submitting", "transferring", "complete"];
    const currentIdx = stepOrder.indexOf(step);
    const thisIdx = stepOrder.indexOf(stepKey);

    if (step === "idle" || step === "error") return "pending";
    if (thisIdx < currentIdx) return "done";
    if (thisIdx === currentIdx) return "active";
    return "pending";
  };

  return (
    <div className="card">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">
        Transfer hkBOND
      </h2>

      {/* Step indicator */}
      {step !== "idle" && (
        <div className="mb-6 space-y-2">
          {steps.map((s) => {
            const status = getStepStatus(s.key);
            return (
              <div key={s.key} className="flex items-center gap-3">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    status === "done"
                      ? "bg-green-500 text-white"
                      : status === "active"
                      ? "bg-blue-500 text-white proving-animation"
                      : "bg-zinc-800 text-zinc-500"
                  }`}
                >
                  {status === "done" ? (
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : status === "active" ? (
                    <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                  ) : (
                    <span>{steps.indexOf(s) + 1}</span>
                  )}
                </div>
                <span
                  className={`text-sm ${
                    status === "done"
                      ? "text-green-400"
                      : status === "active"
                      ? "text-white"
                      : "text-zinc-600"
                  }`}
                >
                  {s.label}
                  {status === "active" && s.key === "proving" && (
                    <span className="ml-2 text-xs text-zinc-500">(~3-5 seconds)</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Form */}
      <div className="space-y-4">
        <div>
          <label className="label">Recipient Address</label>
          <input
            type="text"
            className="input w-full"
            placeholder="0x..."
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            disabled={step !== "idle" && step !== "error"}
          />
        </div>

        <div>
          <label className="label">Amount (hkBOND)</label>
          <input
            type="number"
            className="input w-full"
            placeholder="100"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={step !== "idle" && step !== "error"}
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {step === "complete" && txHash && (
          <div className="rounded-lg bg-green-500/10 p-3">
            <div className="text-sm text-green-400">Transfer successful!</div>
            <a
              href={`https://testnet-explorer.hsk.xyz/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:underline"
            >
              View on HashKey Explorer
            </a>
          </div>
        )}

        <button
          className="btn-primary w-full"
          onClick={handleTransfer}
          disabled={!recipient || !amount || (step !== "idle" && step !== "error" && step !== "complete")}
        >
          {step === "idle" || step === "error" || step === "complete"
            ? "Generate Proof & Transfer"
            : "Processing..."}
        </button>

        {step === "complete" && (
          <button
            className="w-full rounded-lg border border-[#1e2028] px-4 py-2 text-sm text-zinc-400 transition hover:text-white"
            onClick={() => {
              setStep("idle");
              setTxHash("");
              setRecipient("");
              setAmount("");
            }}
          >
            New Transfer
          </button>
        )}
      </div>
    </div>
  );
}
