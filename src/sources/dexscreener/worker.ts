/**
 * DexScreener REST poller — respects 60/300 rpm buckets; maps pair updates into NormalizedEvent where applicable.
 * Many DS endpoints are pair/liquidity, not per-wallet trades; may feed "acceleration" enrichment vs primary trade stream.
 */
export async function startDexscreenerWorker(_signal: AbortSignal): Promise<void> {
  await Promise.resolve();
}
