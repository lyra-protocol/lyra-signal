import type { PumpScoringContext } from "../context.js";
import type { AlgorithmResult, PumpFeatureVector, ScoreWeights } from "./types.js";

/**
 * Core scoring function — **edit here** to change how features combine.
 * Keep deterministic; no I/O.
 */
export function computePumpScore(
  f: PumpFeatureVector,
  w: ScoreWeights,
  ctx: PumpScoringContext,
): AlgorithmResult {
  const breakdown: Record<string, number> = {};
  let score = w.base;
  breakdown.base = w.base;

  switch (f.action) {
    case "create":
      breakdown.action = w.actionCreate;
      score += w.actionCreate;
      break;
    case "buy":
      breakdown.action = w.actionBuy;
      score += w.actionBuy;
      break;
    case "sell":
      breakdown.action = w.actionSell;
      score += w.actionSell;
      break;
    case "migrate":
      breakdown.action = w.actionMigrate;
      score += w.actionMigrate;
      break;
    default:
      breakdown.action = 0;
  }

  // Notional: high = log-scaled bump only; mid/low = fixed tiers
  if (f.usd >= w.usdThresholdHigh) {
    const bump = Math.min(
      w.notionalLogCap,
      f.log10UsdPlus1 * w.notionalLogScale,
    );
    breakdown.notionalLog = bump;
    score += bump;
  } else if (f.usd >= w.usdThresholdMid) {
    breakdown.notionalMid = w.notionalTierMid;
    score += w.notionalTierMid;
  } else if (f.usd > 0) {
    breakdown.notionalLow = w.notionalTierLow;
    score += w.notionalTierLow;
  }

  if (f.mcapSol !== null && f.mcapSol > w.mcapThresholdSol) {
    breakdown.mcap = w.mcapBonus;
    score += w.mcapBonus;
  }

  // Hook: wallet reputation (populate ctx via enrich/)
  const wr = ctx.wallet?.recentPumpCreates;
  if (typeof wr === "number" && wr > 0 && w.walletReputationScale > 0) {
    const bump = Math.min(15, wr * w.walletReputationScale);
    breakdown.walletRecentCreates = bump;
    score += bump;
  }

  const rounded = Math.max(0, Math.min(100, Math.round(score)));

  const reasons = Object.entries(breakdown)
    .filter(([, v]) => v !== 0 && v !== undefined)
    .map(([k]) => k);

  return { score: rounded, reasons, breakdown };
}
