import type { ScoredEvent } from "./types.js";

export function passesScoreGate(scored: ScoredEvent, minScore: number): boolean {
  if (minScore <= 0) return true;
  return scored.score >= minScore;
}

export function readMinPumpScoreFromEnv(): number {
  const v = Number(process.env.SCORE_MIN_PUMP ?? 0);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}
