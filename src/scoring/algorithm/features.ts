import type { NormalizedEvent } from "../../schema/events.js";
import type { PumpScoringContext } from "../context.js";
import type { PumpFeatureVector } from "./types.js";

/**
 * Single place to map events + context → numeric features for `core.ts`.
 * Add new fields here when PumpPortal or RPC gives you more signal.
 */
export function extractPumpFeatures(
  event: NormalizedEvent,
  _ctx: PumpScoringContext,
): PumpFeatureVector {
  void _ctx;
  const usd = Math.max(0, event.sizeUsd);
  const p = event.metadata?.pump;

  return {
    action: event.action,
    log10UsdPlus1: Math.log10(usd + 1),
    usd,
    mcapSol: typeof p?.marketCapSol === "number" ? p.marketCapSol : null,
    vSolInBondingCurve:
      typeof p?.vSolInBondingCurve === "number" ? p.vSolInBondingCurve : null,
    nameLen: p?.name?.length ?? 0,
    symbolLen: p?.symbol?.length ?? 0,
    initialBuyTokens:
      typeof p?.initialBuyTokens === "number" ? p.initialBuyTokens : null,
  };
}
