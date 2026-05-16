import { randomUUID } from "node:crypto";
import type { AlertEnvelope, RuleId, TradeAction } from "../schema/events.js";
import type { BirdeyeSignalCandidate, BirdeyeSignalType } from "./types.js";

const BIRDEYE_TOKEN_BASE = "https://birdeye.so/token";
const DEXSCREENER_BASE = "https://dexscreener.com/solana";

export function candidateToAlert(candidate: BirdeyeSignalCandidate): AlertEnvelope {
  const now = new Date();
  const profile = candidate.profile;
  const rule = candidate.type as RuleId;
  return {
    id: randomUUID(),
    primaryRule: rule,
    severity: severityFor(candidate),
    score: candidate.score,
    sentence: formatSignal(candidate),
    createdAt: now.toISOString(),
    event: {
      token: profile.address,
      wallet: candidate.wallet ?? "birdeye-market-scan",
      action: actionFor(candidate.type),
      sizeUsd: candidate.amountUsd ?? profile.volume1hUsd ?? profile.liquidityUsd ?? 0,
      timestampMs: now.getTime(),
      source: "birdeye",
      dedupeKey: `${candidate.type}:${profile.address}:${Math.floor(now.getTime() / 60_000)}`,
      metadata: {
        birdeye: {
          signalType: candidate.type,
          symbol: profile.symbol,
          name: profile.name,
          logoURI: profile.logoURI ?? undefined,
          liquidityUsd: profile.liquidityUsd ?? undefined,
          marketCapUsd: profile.marketCapUsd ?? undefined,
          holderCount: profile.holders ?? undefined,
          priceUsd: profile.priceUsd ?? undefined,
          safetyScore: candidate.safety?.score,
          volume1hUsd: profile.volume1hUsd ?? undefined,
          volume1hChangePercent: profile.volume1hChangePercent ?? undefined,
          price1hChangePercent: profile.price1hChangePercent ?? undefined,
          price24hChangePercent: profile.price24hChangePercent ?? undefined,
          gainPercent: candidate.gainPercent ?? undefined,
          priceImpactPercent: candidate.priceImpactPercent ?? undefined,
          volumeSurgeMultiple: candidate.volumeSurgeMultiple ?? undefined,
          traderPnlUsd: candidate.traderPnlUsd ?? undefined,
          note: candidate.note,
          birdeyeUrl: birdeyeUrl(profile.address),
          chartUrl: chartUrl(profile.address),
        },
      },
    },
  };
}

function actionFor(type: BirdeyeSignalType): TradeAction {
  if (type === "new_launch") return "create";
  if (type === "whale_move") return "buy";
  return "unknown";
}

function severityFor(candidate: BirdeyeSignalCandidate) {
  if (candidate.score >= 90) return "critical" as const;
  if (candidate.score >= 78) return "alert" as const;
  if (candidate.score >= 60) return "notable" as const;
  return "info" as const;
}

function formatSignal(candidate: BirdeyeSignalCandidate): string {
  const p = candidate.profile;
  const symbol = `$${p.symbol.toUpperCase()}`;
  if (candidate.type === "new_launch") {
    return [
      `🚀 NEW LAUNCH — ${symbol}`,
      `Safety: ${candidate.safety?.score ?? "—"}/100 ${safeMark(candidate.safety?.score)}`,
      `Liquidity: ${usd(p.liquidityUsd)}`,
      `Age: ${candidate.note ?? "fresh listing"}`,
      `🔗 View on Birdeye: ${birdeyeUrl(p.address)} | Chart: ${chartUrl(p.address)}`,
    ].join("\n");
  }
  if (candidate.type === "trending_breakout") {
    return [
      `📈 TRENDING BREAKOUT — ${symbol}`,
      `Volume: ${pct(p.volume1hChangePercent)} (1h)`,
      `Price: ${pct(p.price1hChangePercent)}`,
      `Holders: ${integer(p.holders)}`,
      `🔗 View on Birdeye: ${birdeyeUrl(p.address)} | Chart: ${chartUrl(p.address)}`,
    ].join("\n");
  }
  if (candidate.type === "whale_move") {
    return [
      `🐳 WHALE ALERT — ${symbol}`,
      `Buy: ${usd(candidate.amountUsd)} USDC`,
      `Wallet: ${candidate.note ?? "portfolio check unavailable"}`,
      `Price impact: ${pct(candidate.priceImpactPercent)}`,
      `🔗 Wallet: ${walletUrl(candidate.wallet)} | Token: ${birdeyeUrl(p.address)}`,
    ].join("\n");
  }
  if (candidate.type === "top_gainer") {
    return [
      `🏆 TOP GAINER — ${symbol}`,
      `Gain: ${pct(candidate.gainPercent ?? p.price24hChangePercent)} (24h)`,
      `Volume: ${usd(p.volume1hUsd)}`,
      `MC: ${usd(p.marketCapUsd)}`,
      `🔗 View on Birdeye: ${birdeyeUrl(p.address)}`,
    ].join("\n");
  }
  return [
    `⚡ MOMENTUM SPIKE — ${symbol}`,
    `${pct(p.price1hChangePercent)} in 15 mins`,
    `Current: ${price(p.priceUsd)}`,
    `Volume surge: ${multiple(candidate.volumeSurgeMultiple)} avg`,
    `🔗 Chart: ${chartUrl(p.address)} | Trade: ${birdeyeUrl(p.address)}`,
  ].join("\n");
}

function safeMark(score?: number) {
  return typeof score === "number" && score >= 70 ? "✅" : "⚠️";
}

function usd(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function pct(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function price(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value >= 1) return `$${value.toFixed(4)}`;
  return `$${value.toPrecision(3)}`;
}

function integer(value?: number | null) {
  return value == null || !Number.isFinite(value) ? "—" : Math.round(value).toLocaleString("en-US");
}

function multiple(value?: number | null) {
  return value == null || !Number.isFinite(value) ? "—" : `${value.toFixed(1)}x`;
}

function birdeyeUrl(address: string) {
  return `${BIRDEYE_TOKEN_BASE}/${encodeURIComponent(address)}?chain=solana`;
}

function chartUrl(address: string) {
  return `${DEXSCREENER_BASE}/${encodeURIComponent(address)}`;
}

function walletUrl(wallet?: string | null) {
  return wallet ? `https://solscan.io/account/${encodeURIComponent(wallet)}` : "—";
}
