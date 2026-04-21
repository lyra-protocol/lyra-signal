import type { TradeAction } from "../../schema/events.js";

/**
 * Pure numeric inputs for the core algorithm — all derived from NormalizedEvent + context.
 * Edit `features.ts` when you add new raw signals; edit `core.ts` when you change how they combine.
 */
export interface PumpFeatureVector {
  action: TradeAction;
  /** log10(usd + 1) — stable scale for notional */
  log10UsdPlus1: number;
  /** USD notional (same as event.sizeUsd) */
  usd: number;
  mcapSol: number | null;
  vSolInBondingCurve: number | null;
  nameLen: number;
  symbolLen: number;
  initialBuyTokens: number | null;
}

/** Tunable weights — see `config.ts` + env overrides. */
export interface ScoreWeights {
  base: number;
  actionCreate: number;
  actionBuy: number;
  actionSell: number;
  actionMigrate: number;
  /** log10(usd+1) multiplier, capped — applied when usd >= usdThresholdHigh */
  notionalLogScale: number;
  notionalLogCap: number;
  /** Mid / dust notional tiers */
  notionalTierMid: number;
  notionalTierLow: number;
  usdThresholdHigh: number;
  usdThresholdMid: number;
  mcapBonus: number;
  mcapThresholdSol: number;
  /** Optional: future wallet / token context */
  walletReputationScale: number;
}

export interface AlgorithmResult {
  score: number;
  reasons: string[];
  breakdown: Record<string, number>;
}
