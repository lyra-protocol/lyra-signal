export interface BirdeyeSignalConfig {
  minSafetyScore: number;
  minLiquidityUsd: number;
  trendingVolumeChangePercent: number;
  whaleUsd: number;
  topGainerPercent: number;
  momentumPercent15m: number;
  candidateLimit: number;
  trendingIntervalMs: number;
  newListingIntervalMs: number;
  dedupeTtlMs: number;
}

export function readBirdeyeSignalConfig(): BirdeyeSignalConfig {
  return {
    minSafetyScore: readNumber("BIRDEYE_MIN_SAFETY_SCORE", 70),
    minLiquidityUsd: readNumber("BIRDEYE_MIN_LIQUIDITY_USD", 5_000),
    trendingVolumeChangePercent: readNumber("BIRDEYE_TRENDING_VOLUME_CHANGE_PERCENT", 200),
    whaleUsd: readNumber("BIRDEYE_WHALE_USD", 10_000),
    topGainerPercent: readNumber("BIRDEYE_TOP_GAINER_PERCENT", 50),
    momentumPercent15m: readNumber("BIRDEYE_MOMENTUM_PERCENT_15M", 15),
    candidateLimit: Math.min(Math.max(readNumber("BIRDEYE_CANDIDATE_LIMIT", 8), 1), 20),
    trendingIntervalMs: readNumber("BIRDEYE_TRENDING_INTERVAL_MS", 30_000),
    newListingIntervalMs: readNumber("BIRDEYE_NEW_LISTING_INTERVAL_MS", 60_000),
    dedupeTtlMs: readNumber("BIRDEYE_SIGNAL_DEDUPE_TTL_MS", 20 * 60_000),
  };
}

function readNumber(key: string, fallback: number) {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
