import type { ScoredEvent } from "./types.js";

export function passesScoreGate(scored: ScoredEvent, minScore: number): boolean {
  if (minScore <= 0) return true;
  return scored.score >= minScore;
}

export function readMinPumpScoreFromEnv(): number {
  // Default lifts the signal/noise ratio — the scoring engine already maxes at
  // ~100; 42 trims a bit more churn than 40 while staying permissive.
  const v = Number(process.env.SCORE_MIN_PUMP ?? 42);
  if (!Number.isFinite(v)) return 42;
  return Math.max(0, Math.min(100, v));
}
