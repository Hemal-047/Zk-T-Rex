import { useState, useCallback } from "react";
import { generateProof, type ProofInputs, type GeneratedProof } from "../lib/prover";

export function useProof() {
  const [proof, setProof] = useState<GeneratedProof | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generationTime, setGenerationTime] = useState<number | null>(null);

  const generate = useCallback(async (inputs: ProofInputs) => {
    setIsGenerating(true);
    setError(null);
    const start = performance.now();

    try {
      const result = await generateProof(inputs);
      setProof(result);
      setGenerationTime(performance.now() - start);
      return result;
    } catch (err: any) {
      setError(err.message || "Proof generation failed");
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return { proof, isGenerating, error, generationTime, generate };
}
