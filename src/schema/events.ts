/**
 * Canonical wire types — every ingestion worker maps into NormalizedEvent.
 * Alerts are what cross the filter + get copy from the LLM.
 */

export type SourceId = "pump" | "dexscreener" | "gmgn";

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
  };
}

export type RuleId =
  | "large_wallet_usd"
  | "early_buy_index"
  | "volume_acceleration";

export interface AlertEnvelope {
  id: string;
  event: NormalizedEvent;
  /** Which rule(s) fired; MVP: single primary. */
  primaryRule: RuleId;
  /** Human line — filled by AI step. */
  sentence: string;
  /** ISO8601 for API */
  createdAt: string;
}
