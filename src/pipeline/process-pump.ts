import type { SignalBus } from "../bus/signal-bus.js";
import { enrichPumpScoringContext } from "../enrich/pump-scoring-context.js";
import type { FilterPipeline } from "../filter/pipeline.js";
import type { NormalizedEvent } from "../schema/events.js";
import {
  passesScoreGate,
  readMinPumpScoreFromEnv,
  scorePumpEvent,
} from "../scoring/index.js";
import { dispatchNormalizedEvent } from "./handle-event.js";

/**
 * Ingestion → enrich (optional) → **score** → gate → rule filter → LLM → bus.
 * Drops cheaply before `dispatchNormalizedEvent` when score < SCORE_MIN_PUMP.
 */
export async function processPumpPipeline(
  event: NormalizedEvent,
  pipeline: FilterPipeline,
  bus: SignalBus,
): Promise<void> {
  const ctx = await enrichPumpScoringContext(event);
  const scored = scorePumpEvent(event, ctx);
  const min = readMinPumpScoreFromEnv();
  if (!passesScoreGate(scored, min)) {
    if (process.env.SIGNAL_DEBUG_SCORE === "1") {
      console.error(
        "[score:drop]",
        scored.score,
        "<",
        min,
        scored.reasons.join(","),
        event.token.slice(0, 8),
        JSON.stringify(scored.breakdown),
      );
    }
    return;
  }

  await dispatchNormalizedEvent(event, pipeline, bus, null);
}
