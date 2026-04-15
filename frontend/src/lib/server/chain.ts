/**
 * Server-side viem clients for API routes. Uses PRIVATE_KEY from env to
 * send transactions to HashKey Testnet (chain ID 133).
 *
 * NEVER import this from a client component. Keep it under src/lib/server.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const hashkeyTestnet = defineChain({
  id: 133,
  name: "HashKey Chain Testnet",
  nativeCurrency: { name: "HSK", symbol: "HSK", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet.hsk.xyz"] },
  },
  blockExplorers: {
    default: {
      name: "HashKey Explorer",
      url: "https://testnet-explorer.hsk.xyz",
    },
  },
  testnet: true,
});

function normalizePrivateKey(raw: string): Hex {
  const hex = raw.startsWith("0x") ? raw : `0x${raw}`;
  if (hex.length !== 66) {
    throw new Error(
      `PRIVATE_KEY must be 32 bytes (0x + 64 hex chars), got length ${hex.length}`
    );
  }
  return hex as Hex;
}

/**
 * Build a viem wallet client signed by the deployer private key.
 * Throws a clear error if PRIVATE_KEY isn't set — API routes catch this
 * and return a readable 500 so misconfigured deployments are obvious.
 */
export function getServerWallet(): {
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: ReturnType<typeof privateKeyToAccount>;
} {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) {
    throw new Error(
      "PRIVATE_KEY env var is not set. Add it in Vercel → Settings → Environment Variables."
    );
  }

  const account = privateKeyToAccount(normalizePrivateKey(pk));
  const transport = http("https://testnet.hsk.xyz");

  const publicClient = createPublicClient({
    chain: hashkeyTestnet,
    transport,
  });

  const walletClient = createWalletClient({
    account,
    chain: hashkeyTestnet,
    transport,
  });

  return { publicClient, walletClient, account };
}
