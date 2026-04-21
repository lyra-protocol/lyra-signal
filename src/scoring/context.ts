/**
 * Optional enrichment for scoring (Helius, indexers, DB). Keep small — hot path may stay sync
 * until you explicitly async-enrich in the pipeline.
 */
export interface PumpScoringContext {
  /** Wallet-level signals — fill via RPC/indexer later */
  wallet?: {
    /** Approximate age of wallet first funding (hours) — lower = younger “snipers” */
    estimatedAgeHours?: number;
    /** Recent pump.fun creates from same wallet (rolling window) */
    recentPumpCreates?: number;
  };
  /** Token-level — optional DexScreener / internal cache */
  token?: {
    /** Unique buyers in first N minutes — optional */
    uniqueBuyersApprox?: number;
  };
}
