import type { NormalizedEvent, RuleId } from "../schema/events.js";
import type { EarlyBuysTracker } from "./state/early-buys-tracker.js";
import { VolumeWindow } from "./state/volume-window.js";

/**
 * Tunable rule thresholds — defaults are permissive so the signal page is
 * never silent in development. Override in production via env if you want
 * a tighter firehose.
 *
 *   SIGNAL_LARGE_USD            — min USD notional for "large_wallet_usd"
 *   SIGNAL_MAX_EARLY_BUY_INDEX  — buys 1..N trigger "early_buy_index"
 *   SIGNAL_ACCEL_RATIO          — recent/prev window ratio for "volume_acceleration"
 *   SIGNAL_VOLUME_WINDOW_MS     — rolling window size for acceleration
 *   SIGNAL_VOLUME_REPEAT_MS     — min gap between volume_acceleration alerts per mint
 */

function num(envKey: string, fallback: number): number {
  const v = Number(process.env[envKey]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

// Noise floor — tuned to reduce duplicate “surge” spam while keeping launches visible.
export const DEFAULT_LARGE_USD = 3_500;
export const DEFAULT_MAX_EARLY_BUY_INDEX = 7;
export const DEFAULT_ACCEL_RATIO = 2.8;
export const DEFAULT_VOLUME_WINDOW_MS = 60_000;
/** Suppress repeat volume_acceleration for the same mint within this window. */
export const DEFAULT_VOLUME_REPEAT_MS = 15_000;

export const LARGE_USD = num("SIGNAL_LARGE_USD", DEFAULT_LARGE_USD);
export const MAX_EARLY_BUY_INDEX = num(
  "SIGNAL_MAX_EARLY_BUY_INDEX",
  DEFAULT_MAX_EARLY_BUY_INDEX,
);
export const ACCEL_RATIO = num("SIGNAL_ACCEL_RATIO", DEFAULT_ACCEL_RATIO);
export const VOLUME_WINDOW_MS = num(
  "SIGNAL_VOLUME_WINDOW_MS",
  DEFAULT_VOLUME_WINDOW_MS,
);
export const VOLUME_REPEAT_MS = num(
  "SIGNAL_VOLUME_REPEAT_MS",
  DEFAULT_VOLUME_REPEAT_MS,
);

export interface RuleEvaluation {
  match: boolean;
  rule?: RuleId;
}

/**
 * Stateless checks first; early-buys mutates tracker when evaluating buys.
 * New-token `create` events always fire — that's the moment traders want.
 */
export function evaluateRules(
  event: NormalizedEvent,
  ctx: {
    earlyBuys: EarlyBuysTracker;
    volumeByToken: Map<string, VolumeWindow>;
  },
): RuleEvaluation {
  if (event.action === "migrate") {
    return { match: true, rule: "bonding_migration" };
  }

  if (event.action === "create") {
    return { match: true, rule: "early_buy_index" };
  }

  if (event.sizeUsd >= LARGE_USD) {
    return { match: true, rule: "large_wallet_usd" };
  }

  if (event.action === "buy") {
    const idx = ctx.earlyBuys.recordBuy(event.token);
    if (idx <= MAX_EARLY_BUY_INDEX) {
      return { match: true, rule: "early_buy_index" };
    }
  }

  let vw = ctx.volumeByToken.get(event.token);
  if (!vw) {
    vw = new VolumeWindow(VOLUME_WINDOW_MS);
    ctx.volumeByToken.set(event.token, vw);
  }
  vw.add(event.sizeUsd, event.timestampMs);
  if (vw.accelerationRatio(event.timestampMs) >= ACCEL_RATIO) {
    return { match: true, rule: "volume_acceleration" };
  }

  return { match: false };
}
