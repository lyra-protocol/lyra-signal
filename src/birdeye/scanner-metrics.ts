import { readArray, readNumber, readString } from "./extract.js";
import type { JsonRecord } from "./types.js";

export function tradeUsd(raw: JsonRecord): number {
  return readNumber(
    raw,
    "volumeUSD",
    "volumeUsd",
    "amountUSD",
    "amountUsd",
    "value",
    "usdValue",
    "quoteAmountUsd",
  ) ?? 0;
}

export function priceChangePercent(response: unknown): number | null {
  const points = readArray(response, ["data", "items"])
    .map((item) => readNumber(item, "value", "price", "close"))
    .filter((value): value is number => value != null && value > 0);
  if (points.length < 2) return null;
  return ((points.at(-1)! - points[0]) / points[0]) * 100;
}

export function volumeSurge(response: unknown): number | null {
  const volumes = readArray(response, ["data", "items"])
    .map((item) => readNumber(item, "volume", "v", "volumeUsd", "volumeUSD"))
    .filter((value): value is number => value != null && value >= 0);
  if (volumes.length < 4) return null;
  const latest = volumes.at(-1)!;
  const prior = volumes.slice(0, -1);
  const avg = prior.reduce((sum, value) => sum + value, 0) / prior.length;
  return avg > 0 ? latest / avg : null;
}

export function scoreBase(base: number, signal?: number | null, scale?: number | null): number {
  const signalScore = Math.min(18, Math.max(0, Math.abs(signal ?? 0) / 10));
  const scaleScore = scale && scale > 0 ? Math.min(12, Math.log10(scale + 1) * 1.8) : 0;
  return Math.max(0, Math.min(100, Math.round(base + signalScore + scaleScore)));
}

export function ageHint(raw: JsonRecord): string {
  const time = readString(raw, "liquidityAddedAt", "createdAt", "lastTradeHumanTime");
  if (!time) return "fresh listing";
  const timestamp = new Date(time).getTime();
  if (!Number.isFinite(timestamp)) return "fresh listing";
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  return minutes < 60 ? `${minutes} mins` : `${Math.round(minutes / 60)} hours`;
}
