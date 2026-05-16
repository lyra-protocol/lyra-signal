import type { AlertEnvelope, RuleId } from "../schema/events.js";

export type TelegramFrequency = "realtime" | "hourly" | "daily5";

export interface TelegramPreferences {
  chatId: number;
  paused: boolean;
  signalTypes: Record<RuleId, boolean>;
  minSafetyScore: number;
  minLiquidityUsd: number;
  frequency: TelegramFrequency;
  sentAt: string[];
}

const BIRDEYE_RULES: RuleId[] = [
  "new_launch",
  "trending_breakout",
  "whale_move",
  "top_gainer",
  "momentum_spike",
];

export function defaultPreferences(chatId: number): TelegramPreferences {
  return {
    chatId,
    paused: false,
    signalTypes: Object.fromEntries(BIRDEYE_RULES.map((rule) => [rule, true])) as Record<RuleId, boolean>,
    minSafetyScore: 70,
    minLiquidityUsd: 5_000,
    frequency: "realtime",
    sentAt: [],
  };
}

export function signalRule(alert: AlertEnvelope): RuleId | null {
  return BIRDEYE_RULES.includes(alert.primaryRule) ? alert.primaryRule : null;
}

export function shouldSend(alert: AlertEnvelope, prefs: TelegramPreferences, now = new Date()): boolean {
  if (prefs.paused) return false;
  const rule = signalRule(alert);
  if (!rule || prefs.signalTypes[rule] === false) return false;
  const meta = alert.event.metadata?.birdeye;
  if ((meta?.safetyScore ?? 100) < prefs.minSafetyScore) return false;
  if ((meta?.liquidityUsd ?? Number.MAX_SAFE_INTEGER) < prefs.minLiquidityUsd) return false;
  if (prefs.frequency === "hourly") {
    return !prefs.sentAt.some((iso) => now.getTime() - new Date(iso).getTime() < 60 * 60_000);
  }
  if (prefs.frequency === "daily5") {
    const day = now.toISOString().slice(0, 10);
    return prefs.sentAt.filter((iso) => iso.startsWith(day)).length < 5;
  }
  return true;
}

export function recordSent(prefs: TelegramPreferences, now = new Date()): TelegramPreferences {
  const cutoff = now.getTime() - 48 * 60 * 60_000;
  const sentAt = prefs.sentAt.filter((iso) => new Date(iso).getTime() >= cutoff);
  sentAt.push(now.toISOString());
  return { ...prefs, sentAt };
}

export function ruleLabel(rule: RuleId): string {
  const labels: Partial<Record<RuleId, string>> = {
    new_launch: "New Launch",
    trending_breakout: "Trending",
    whale_move: "Whale",
    top_gainer: "Gainer",
    momentum_spike: "Momentum",
  };
  return labels[rule] ?? rule;
}

export { BIRDEYE_RULES };
