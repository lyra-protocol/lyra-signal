import type { ScoredEvent } from "./types.js";

export function passesScoreGate(scored: ScoredEvent, minScore: number): boolean {
  if (minScore <= 0) return true;
  return scored.score >= minScore;
}

export function readMinPumpScoreFromEnv(): number {
  // Primary noise gate when there is no per-day cap (default 46).
  const v = Number(process.env.SCORE_MIN_PUMP ?? 46);
  if (!Number.isFinite(v)) return 46;
  return Math.max(0, Math.min(100, v));
}
