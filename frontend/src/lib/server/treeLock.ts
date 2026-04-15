/**
 * Simple FIFO async mutex. Used to serialize mutations against the
 * in-memory identity and revocation trees so concurrent requests can't
 * corrupt the state or produce racing on-chain updateRoot calls.
 */

type Resolver = () => void;

let isUpdating = false;
const queue: Resolver[] = [];

export async function withTreeLock<T>(fn: () => Promise<T>): Promise<T> {
  while (isUpdating) {
    await new Promise<void>((resolve) => queue.push(resolve));
  }
  isUpdating = true;
  try {
    return await fn();
  } finally {
    isUpdating = false;
    const next = queue.shift();
    if (next) next();
  }
}
