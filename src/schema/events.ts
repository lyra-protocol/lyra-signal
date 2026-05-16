/**
 * Canonical wire types — every ingestion worker maps into NormalizedEvent.
 * Alerts are what cross the filter + get copy from the LLM.
 */

export type SourceId = "pump" | "dexscreener" | "gmgn" | "birdeye";

export type TradeAction = "buy" | "sell" | "create" | "migrate" | "unknown";

/** Raw-ish unit after normalization (USD where possible). */
export interface NormalizedEvent {
  token: string;
  wallet: string;
  action: TradeAction;
  /** Notional USD; workers must agree on methodology (spot, pool-derived). */
  sizeUsd: number;
  timestampMs: number;
  source: SourceId;
  /** Optional: pair id, signature, slot — for dedupe and debugging. */
  dedupeKey?: string;
  /** Source-specific enrichment (scoring + LLM context); keep small. */
  metadata?: {
    pump?: {
      marketCapSol?: number;
      /** SOL locked in bonding curve (when PumpPortal sends it). */
      vSolInBondingCurve?: number;
      vTokensInBondingCurve?: number;
      /** Creator initial buy (token amount) on create, if present. */
      initialBuyTokens?: number;
      name?: string;
      symbol?: string;
      pool?: string;
      txType?: string;
    };
    birdeye?: {
      signalType?: RuleId;
      symbol?: string;
      name?: string;
      logoURI?: string;
      liquidityUsd?: number;
      marketCapUsd?: number;
      holderCount?: number;
      priceUsd?: number;
      safetyScore?: number;
      volume1hUsd?: number;
      volume1hChangePercent?: number;
      price1hChangePercent?: number;
      price24hChangePercent?: number;
      gainPercent?: number;
      priceImpactPercent?: number;
      volumeSurgeMultiple?: number;
      traderPnlUsd?: number;
      note?: string;
      birdeyeUrl?: string;
      chartUrl?: string;
    };
  };
}

export type RuleId =
  | "large_wallet_usd"
  | "early_buy_index"
  | "volume_acceleration"
  /** PumpPortal bonding-curve → pool migration (Raydium, etc.). */
  | "bonding_migration"
  | "new_launch"
  | "trending_breakout"
  | "whale_move"
  | "top_gainer"
  | "momentum_spike";

export type Severity = "info" | "notable" | "alert" | "critical";

export interface AlertEnvelope {
  id: string;
  event: NormalizedEvent;
  /** Which rule(s) fired; MVP: single primary. */
  primaryRule: RuleId;
  /** Conviction bucket driving UI rendering priority. */
  severity: Severity;
  /** 0–100 numeric score (from the scoring engine if available). */
  score?: number;
  /** Human line — filled by AI step. */
  sentence: string;
  /** ISO8601 for API */
  createdAt: string;
}

/**
 * Derive a coarse severity bucket from the rule + USD size + optional score.
 * The UI uses this to decide card weight and whether something is "dust".
 */
export function deriveSeverity(
  event: NormalizedEvent,
  rule: RuleId,
  score?: number,
): Severity {
  const usd = event.sizeUsd ?? 0;

  if (rule === "large_wallet_usd" && usd >= 50_000) return "critical";
  if (rule === "large_wallet_usd" && usd >= 10_000) return "alert";
  if (rule === "large_wallet_usd") return "notable";

  if (rule === "early_buy_index" && event.action === "create") {
    if (usd >= 500) return "alert";
    return "notable";
  }
  if (rule === "early_buy_index" && usd >= 5_000) return "alert";
  if (rule === "early_buy_index" && usd >= 1_000) return "notable";

  if (rule === "volume_acceleration" && usd >= 10_000) return "alert";
  if (rule === "volume_acceleration" && usd >= 1_000) return "notable";

  if (rule === "bonding_migration") return "notable";

  if (rule === "new_launch") return (score ?? 0) >= 80 ? "alert" : "notable";
  if (rule === "trending_breakout") return (score ?? 0) >= 85 ? "critical" : "alert";
  if (rule === "whale_move") return usd >= 50_000 ? "critical" : "alert";
  if (rule === "top_gainer") return (score ?? 0) >= 85 ? "critical" : "alert";
  if (rule === "momentum_spike") return (score ?? 0) >= 85 ? "critical" : "alert";

  if (typeof score === "number") {
    if (score >= 75) return "alert";
    if (score >= 55) return "notable";
  }
  return "info";
}
