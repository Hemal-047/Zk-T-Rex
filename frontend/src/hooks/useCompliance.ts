import { useAccount, useReadContract } from "wagmi";
import { CONTRACTS, ZK_COMPLIANCE_ABI } from "../lib/contracts";

export function useCompliance() {
  const { address } = useAccount();

  const { data: lastProofTimestamp, refetch } = useReadContract({
    address: CONTRACTS.zkComplianceModule as `0x${string}`,
    abi: ZK_COMPLIANCE_ABI,
    functionName: "lastProofTimestamp",
    args: [address!],
    query: { enabled: !!address },
  });

  const timestamp = lastProofTimestamp ? Number(lastProofTimestamp) : 0;
  const now = Math.floor(Date.now() / 1000);
  const freshnessWindow = 3600; // 1 hour
  const isCompliant = timestamp > 0 && now - timestamp < freshnessWindow;
  const timeRemaining = timestamp > 0 ? Math.max(0, freshnessWindow - (now - timestamp)) : 0;

  return {
    isCompliant,
    lastProofTimestamp: timestamp,
    timeRemaining,
    freshnessWindow,
    refetch,
  };
}
