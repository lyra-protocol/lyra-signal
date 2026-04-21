/**
 * Cached SOL/USD — avoid per-tick HTTP on the hot path.
 * Refreshes on a timer; falls back to env if the request fails.
 */

const DEFAULT = 140;
const COINGECKO =
  "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd";

let cached = DEFAULT;
let lastFetch = 0;
const TTL_MS = 60_000;

export function getCachedSolUsd(): number {
  return cached;
}

export async function refreshSolUsdIfStale(): Promise<number> {
  const now = Date.now();
  if (now - lastFetch < TTL_MS) return cached;
  lastFetch = now;
  const fromEnv = Number(process.env.SOL_USD_OVERRIDE);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    cached = fromEnv;
    return cached;
  }
  try {
    const res = await fetch(COINGECKO, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(String(res.status));
    const j = (await res.json()) as { solana?: { usd?: number } };
    const v = j.solana?.usd;
    if (typeof v === "number" && v > 0) cached = v;
  } catch {
    /* keep previous cached */
  }
  return cached;
}
