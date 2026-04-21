import type { ScoreWeights } from "./types.js";

/** Default weights — tune via env `SCORE_ALG_*` (see `loadScoreWeights`). */
export const DEFAULT_WEIGHTS: ScoreWeights = {
  base: 15,
  actionCreate: 45,
  actionBuy: 28,
  actionSell: 12,
  actionMigrate: 35,
  notionalLogScale: 6,
  notionalLogCap: 22,
  notionalTierMid: 6,
  notionalTierLow: 2,
  usdThresholdHigh: 5000,
  usdThresholdMid: 500,
  mcapBonus: 5,
  mcapThresholdSol: 100,
  walletReputationScale: 0,
};

function num(env: string, fallback: number): number {
  const v = Number(process.env[env]);
  return Number.isFinite(v) ? v : fallback;
}

/**
 * Loads weights with optional env overrides for live experiments without redeploying logic.
 *
 * Prefix: `SCORE_ALG_` — e.g. `SCORE_ALG_BASE`, `SCORE_ALG_ACTION_CREATE`, …
 */
export function loadScoreWeights(): ScoreWeights {
  const d = DEFAULT_WEIGHTS;
  return {
    base: num("SCORE_ALG_BASE", d.base),
    actionCreate: num("SCORE_ALG_ACTION_CREATE", d.actionCreate),
    actionBuy: num("SCORE_ALG_ACTION_BUY", d.actionBuy),
    actionSell: num("SCORE_ALG_ACTION_SELL", d.actionSell),
    actionMigrate: num("SCORE_ALG_ACTION_MIGRATE", d.actionMigrate),
    notionalLogScale: num("SCORE_ALG_NOTIONAL_LOG_SCALE", d.notionalLogScale),
    notionalLogCap: num("SCORE_ALG_NOTIONAL_LOG_CAP", d.notionalLogCap),
    notionalTierMid: num("SCORE_ALG_NOTIONAL_TIER_MID", d.notionalTierMid),
    notionalTierLow: num("SCORE_ALG_NOTIONAL_TIER_LOW", d.notionalTierLow),
    usdThresholdHigh: num("SCORE_ALG_USD_THRESHOLD_HIGH", d.usdThresholdHigh),
    usdThresholdMid: num("SCORE_ALG_USD_THRESHOLD_MID", d.usdThresholdMid),
    mcapBonus: num("SCORE_ALG_MCAP_BONUS", d.mcapBonus),
    mcapThresholdSol: num("SCORE_ALG_MCAP_THRESHOLD_SOL", d.mcapThresholdSol),
    walletReputationScale: num(
      "SCORE_ALG_WALLET_REPUTATION_SCALE",
      d.walletReputationScale,
    ),
  };
}
