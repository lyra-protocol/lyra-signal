import type { NormalizedEvent } from "../schema/events.js";
import type { PumpScoringContext } from "../scoring/context.js";

/**
 * Async enrichment before scoring. Default: no-op (no latency).
 * Next steps: batch Helius `getSignaturesForAddress`, cache in LRU, merge here.
 */
export async function enrichPumpScoringContext(
  _event: NormalizedEvent,
): Promise<PumpScoringContext> {
  void _event;
  return {};
}
