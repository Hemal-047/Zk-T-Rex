import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";

export const hashkeyTestnet = defineChain({
  id: 133,
  name: "HashKey Chain Testnet",
  nativeCurrency: { name: "HSK", symbol: "HSK", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet.hsk.xyz"] },
    public: { http: ["https://testnet.hsk.xyz"] },
  },
  blockExplorers: {
    default: {
      name: "HashKey Explorer",
      url: "https://testnet-explorer.hsk.xyz",
    },
  },
  testnet: true,
});

// NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID must be set in Vercel for WalletConnect
// to work. A placeholder is used as a last-resort fallback so dev builds
// still render (the injected MetaMask connector will still work).
const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  "8f15d27cbe126b8608415d4a994d6b91";

export const config = getDefaultConfig({
  appName: "zkT-REX",
  projectId,
  chains: [hashkeyTestnet],
  ssr: true,
});
