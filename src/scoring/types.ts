import type { NormalizedEvent } from "../schema/events.js";

/**
 * Output of the scoring stage — feeds the gate (what we keep vs drop before rules/LLM).
 * The numeric core algorithm will evolve; keep `reasons` for debugging and future tuning.
 */
export interface ScoredEvent {
  event: NormalizedEvent;
  /** 0–100; threshold via env SCORE_MIN_PUMP */
  score: number;
  reasons: string[];
  /** Which components contributed (for tuning the core algorithm) */
  breakdown: Record<string, number>;
}
