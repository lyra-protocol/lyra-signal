import type { NormalizedEvent, RuleId } from "../schema/events.js";
import type { EarlyBuysTracker } from "./state/early-buys-tracker.js";
import { VolumeWindow } from "./state/volume-window.js";

export const DEFAULT_LARGE_USD = 5_000;
export const DEFAULT_MAX_EARLY_BUY_INDEX = 100;
export const DEFAULT_ACCEL_RATIO = 3;

export interface RuleEvaluation {
  match: boolean;
  rule?: RuleId;
}

/**
 * Stateless checks first; early-buys mutates tracker when evaluating buys.
 */
export function evaluateRules(
  event: NormalizedEvent,
  ctx: {
    earlyBuys: EarlyBuysTracker;
    volumeByToken: Map<string, VolumeWindow>;
  },
): RuleEvaluation {
  if (event.sizeUsd >= DEFAULT_LARGE_USD) {
    return { match: true, rule: "large_wallet_usd" };
  }

  if (event.action === "buy") {
    const idx = ctx.earlyBuys.recordBuy(event.token);
    if (idx <= DEFAULT_MAX_EARLY_BUY_INDEX) {
      return { match: true, rule: "early_buy_index" };
    }
  }

  let vw = ctx.volumeByToken.get(event.token);
  if (!vw) {
    vw = new VolumeWindow(60_000);
    ctx.volumeByToken.set(event.token, vw);
  }
  vw.add(event.sizeUsd, event.timestampMs);
  if (vw.accelerationRatio(event.timestampMs) >= DEFAULT_ACCEL_RATIO) {
    return { match: true, rule: "volume_acceleration" };
  }

  return { match: false };
}
