import type { BirdeyeTokenProfile, JsonRecord, SecuritySummary } from "./types.js";

const DEFAULT_SAFETY_SCORE = 70;

export function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

export function dataRecord(value: unknown): JsonRecord | null {
  return asRecord(asRecord(value)?.data);
}

export function readArray(value: unknown, path: string[]): JsonRecord[] {
  let cursor: unknown = value;
  for (const key of path) cursor = asRecord(cursor)?.[key];
  return Array.isArray(cursor) ? cursor.filter((item): item is JsonRecord => !!asRecord(item)) : [];
}

export function pickTokenProfile(raw: JsonRecord): BirdeyeTokenProfile | null {
  const address = readString(raw, "address", "tokenAddress", "mint", "token_address");
  if (!address) return null;
  return {
    address,
    symbol: readString(raw, "symbol", "tokenSymbol") ?? address.slice(0, 6),
    name: readString(raw, "name", "tokenName") ?? "Unknown token",
    logoURI: readString(raw, "logoURI", "logo_uri", "logo") ?? null,
    liquidityUsd: readNumber(raw, "liquidity", "liquidityUSD", "liquidityUsd"),
    marketCapUsd: readNumber(raw, "marketCap", "marketcap", "mc", "fdv"),
    priceUsd: readNumber(raw, "price", "priceUSD", "value"),
    holders: readNumber(raw, "holder", "holders", "holderCount"),
    volume1hUsd: readNumber(raw, "v1hUSD", "volume1hUSD", "volumeUSD", "volume24hUSD"),
    volume1hChangePercent: readNumber(raw, "v1hChangePercent", "volume1hChangePercent"),
    price1hChangePercent: readNumber(raw, "priceChange1hPercent", "price1hChangePercent"),
    price24hChangePercent: readNumber(raw, "priceChange24hPercent", "price24hChangePercent"),
  };
}

export function mergeProfile(
  base: BirdeyeTokenProfile,
  update: Partial<BirdeyeTokenProfile> | null,
): BirdeyeTokenProfile {
  if (!update) return base;
  return {
    address: update.address ?? base.address,
    symbol: update.symbol ?? base.symbol,
    name: update.name ?? base.name,
    logoURI: update.logoURI ?? base.logoURI,
    liquidityUsd: update.liquidityUsd ?? base.liquidityUsd,
    marketCapUsd: update.marketCapUsd ?? base.marketCapUsd,
    priceUsd: update.priceUsd ?? base.priceUsd,
    holders: update.holders ?? base.holders,
    volume1hUsd: update.volume1hUsd ?? base.volume1hUsd,
    volume1hChangePercent: update.volume1hChangePercent ?? base.volume1hChangePercent,
    price1hChangePercent: update.price1hChangePercent ?? base.price1hChangePercent,
    price24hChangePercent: update.price24hChangePercent ?? base.price24hChangePercent,
  };
}

export function pickSecurity(raw: JsonRecord | null): SecuritySummary | null {
  if (!raw) return null;
  const explicit = readNumber(raw, "score", "safetyScore", "securityScore");
  let score = explicit ?? DEFAULT_SAFETY_SCORE;
  const mutableMetadata = readBoolean(raw, "mutableMetadata", "metadataMutable");
  const freezeable = readBoolean(raw, "freezeable", "freezeAuthority", "isFreezeable");
  const top10HolderPercent = readNumber(raw, "top10HolderPercent", "top10HoldersPercent");
  const jupStrictList = readBoolean(raw, "jupStrictList", "isJupiterStrict");

  if (mutableMetadata === true) score -= 8;
  if (freezeable === true) score -= 12;
  if (top10HolderPercent != null) {
    if (top10HolderPercent >= 0.6 || top10HolderPercent >= 60) score -= 18;
    else if (top10HolderPercent <= 0.25 || top10HolderPercent <= 25) score += 6;
  }
  if (jupStrictList === true) score += 6;
  if (jupStrictList === false) score -= 4;

  return {
    score: clamp(score, 0, 100),
    mutableMetadata,
    freezeable,
    top10HolderPercent,
    jupStrictList,
  };
}

export function readNumber(raw: JsonRecord, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = raw[key];
    const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (Number.isFinite(number)) return number;
  }
  return null;
}

export function readString(raw: JsonRecord, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function readBoolean(raw: JsonRecord, ...keys: string[]): boolean | null {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      if (value === "true") return true;
      if (value === "false") return false;
    }
  }
  return null;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(Math.round(value), min), max);
}
