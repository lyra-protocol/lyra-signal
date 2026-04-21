import type { NormalizedEvent } from "../schema/events.js";
import {
  computePumpScore,
  extractPumpFeatures,
  loadScoreWeights,
} from "./algorithm/index.js";
import type { PumpScoringContext } from "./context.js";
import type { ScoredEvent } from "./types.js";

/**
 * Full scoring step: features → weighted core (tunable via `SCORE_ALG_*` env).
 */
export function scorePumpEvent(
  event: NormalizedEvent,
  ctx: PumpScoringContext = {},
): ScoredEvent {
  const weights = loadScoreWeights();
  const features = extractPumpFeatures(event, ctx);
  const result = computePumpScore(features, weights, ctx);
  return {
    event,
    score: result.score,
    reasons: result.reasons,
    breakdown: result.breakdown,
  };
}
