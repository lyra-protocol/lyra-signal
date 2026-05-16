export type BirdeyeChain =
  | "solana"
  | "ethereum"
  | "arbitrum"
  | "avalanche"
  | "bsc"
  | "optimism"
  | "polygon"
  | "base"
  | "zksync"
  | "monad"
  | "hyperevm"
  | "aptos"
  | "fogo"
  | "mantle"
  | "megaeth";

export type JsonRecord = Record<string, unknown>;

export type BirdeyeSignalType =
  | "new_launch"
  | "trending_breakout"
  | "whale_move"
  | "top_gainer"
  | "momentum_spike";

export interface BirdeyeTokenProfile {
  address: string;
  symbol: string;
  name: string;
  logoURI: string | null;
  liquidityUsd: number | null;
  marketCapUsd: number | null;
  priceUsd: number | null;
  holders: number | null;
  volume1hUsd: number | null;
  volume1hChangePercent: number | null;
  price1hChangePercent: number | null;
  price24hChangePercent: number | null;
}

export interface SecuritySummary {
  score: number;
  mutableMetadata: boolean | null;
  freezeable: boolean | null;
  top10HolderPercent: number | null;
  jupStrictList: boolean | null;
}

export interface BirdeyeSignalCandidate {
  type: BirdeyeSignalType;
  profile: BirdeyeTokenProfile;
  score: number;
  safety: SecuritySummary | null;
  wallet?: string | null;
  amountUsd?: number | null;
  priceImpactPercent?: number | null;
  gainPercent?: number | null;
  volumeSurgeMultiple?: number | null;
  traderPnlUsd?: number | null;
  note?: string;
}
