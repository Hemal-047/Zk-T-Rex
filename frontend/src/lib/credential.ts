/**
 * Client-side credential handle. Secret claim material now lives on the
 * server — this is just a short identifier saying "this wallet has a
 * credential issued, here's the public commitment to display". The full
 * proof witness is fetched fresh from /api/get-proof-inputs on demand.
 */

export interface CredentialHandle {
  wallet: string;
  leafIndex: number;
  claimTopic: string;
  claimValue: string;
  claimExpirationDate: string;
  commitmentBytes32: `0x${string}`;
  nullifierBytes32: `0x${string}`;
  issuedAt: number;
}

const KEY_PREFIX = "zktrex:credential:";

function key(wallet: string) {
  return KEY_PREFIX + wallet.toLowerCase();
}

export function saveCredential(handle: CredentialHandle) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key(handle.wallet), JSON.stringify(handle));
  } catch {
    // quota exceeded — silently ignore
  }
}

export function loadCredential(wallet: string): CredentialHandle | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key(wallet));
    if (!raw) return null;
    return JSON.parse(raw) as CredentialHandle;
  } catch {
    return null;
  }
}

export function clearCredential(wallet: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key(wallet));
}
