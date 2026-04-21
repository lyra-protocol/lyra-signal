import type { SignalBus } from "../bus/signal-bus.js";
import type { FilterPipeline } from "../filter/pipeline.js";
import type { NormalizedEvent } from "../schema/events.js";
import { generateSentence } from "../ai/sentence.js";
import type { WalletContext } from "../ai/sentence.js";
import { incrementMetric } from "../util/metrics.js";

/**
 * End-to-end: normalize → filter → (optional wallet ctx) → LLM → broadcast.
 * For minimum latency: could broadcast twice (skeleton + final); MVP: one push after sentence.
 */
export async function dispatchNormalizedEvent(
  event: NormalizedEvent,
  pipeline: FilterPipeline,
  bus: SignalBus,
  walletContext: WalletContext | null,
): Promise<void> {
  const accepted = pipeline.accept(event);
  if (!accepted) return;

  const sentence = await generateSentence(accepted, walletContext);
  bus.publish({ ...accepted, sentence });
  incrementMetric("alertsPublished");
}
