import type { NormalizedEvent, SourceId, TradeAction } from "../schema/events.js";

export function makeEvent(input: {
  token: string;
  wallet: string;
  action: TradeAction;
  sizeUsd: number;
  timestampMs: number;
  source: SourceId;
  dedupeKey?: string;
}): NormalizedEvent {
  return { ...input };
}
