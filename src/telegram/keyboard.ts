import { Markup } from "telegraf";
import type { RuleId } from "../schema/events.js";
import { BIRDEYE_RULES, ruleLabel, type TelegramFrequency, type TelegramPreferences } from "./preferences.js";

const SAFETY = [50, 60, 70, 80];
const LIQUIDITY = [5_000, 10_000, 25_000, 50_000];
const FREQUENCIES: Array<{ id: TelegramFrequency; label: string }> = [
  { id: "realtime", label: "Real-time" },
  { id: "hourly", label: "Max 1/hour" },
  { id: "daily5", label: "Max 5/day" },
];

export function preferencesKeyboard(prefs: TelegramPreferences) {
  return Markup.inlineKeyboard([
    ...BIRDEYE_RULES.map((rule) => [button(`${prefs.signalTypes[rule] === false ? "⚪" : "🟢"} ${ruleLabel(rule)}`, `type:${rule}`)]),
    [Markup.button.callback("Safety", "noop")],
    SAFETY.map((score) => button(`${prefs.minSafetyScore === score ? "✅" : ""}${score}`, `safety:${score}`)),
    [Markup.button.callback("Liquidity", "noop")],
    LIQUIDITY.map((usd) => button(`${prefs.minLiquidityUsd === usd ? "✅" : ""}$${usd / 1_000}k`, `liq:${usd}`)),
    [Markup.button.callback("Frequency", "noop")],
    FREQUENCIES.map((item) => button(`${prefs.frequency === item.id ? "✅" : ""}${item.label}`, `freq:${item.id}`)),
  ]);
}

export function applyPreferenceAction(
  prefs: TelegramPreferences,
  data: string,
): TelegramPreferences {
  const [kind, value] = data.split(":");
  if (kind === "type" && isRule(value)) {
    return {
      ...prefs,
      signalTypes: { ...prefs.signalTypes, [value]: prefs.signalTypes[value] === false },
    };
  }
  if (kind === "safety") return { ...prefs, minSafetyScore: Number(value) || prefs.minSafetyScore };
  if (kind === "liq") return { ...prefs, minLiquidityUsd: Number(value) || prefs.minLiquidityUsd };
  if (kind === "freq" && isFrequency(value)) return { ...prefs, frequency: value };
  return prefs;
}

function button(label: string, data: string) {
  return Markup.button.callback(label, data);
}

function isRule(value: string): value is RuleId {
  return BIRDEYE_RULES.includes(value as RuleId);
}

function isFrequency(value: string): value is TelegramFrequency {
  return value === "realtime" || value === "hourly" || value === "daily5";
}
