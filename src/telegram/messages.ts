import type { TelegramPreferences } from "./preferences.js";
import { BIRDEYE_RULES, ruleLabel } from "./preferences.js";

export function welcomeText() {
  return [
    "🤖 Lyra Signal Bot is live.",
    "I watch Birdeye for launches, breakouts, whales, gainers, and momentum spikes.",
    "Use /preferences to tune filters or /pause to stop alerts.",
  ].join("\n");
}

export function statusText(prefs: TelegramPreferences) {
  const enabled = BIRDEYE_RULES
    .filter((rule) => prefs.signalTypes[rule] !== false)
    .map(ruleLabel)
    .join(", ");
  return [
    `Status: ${prefs.paused ? "Paused" : "Active"}`,
    `Signals: ${enabled || "none"}`,
    `Min safety: ${prefs.minSafetyScore}/100`,
    `Min liquidity: $${prefs.minLiquidityUsd.toLocaleString("en-US")}`,
    `Frequency: ${prefs.frequency}`,
  ].join("\n");
}
