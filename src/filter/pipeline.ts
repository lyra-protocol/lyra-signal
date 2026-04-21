import { randomUUID } from "node:crypto";
import type { AlertEnvelope, NormalizedEvent } from "../schema/events.js";
import { DailyAlertBudget } from "./daily-budget.js";
import { evaluateRules } from "./rules.js";
import type { EarlyBuysTracker } from "./state/early-buys-tracker.js";
import type { VolumeWindow } from "./state/volume-window.js";

export interface FilterPipeline {
  /** Returns null if dropped by rules or daily cap. */
  accept(event: NormalizedEvent): AlertEnvelope | null;
}

export function createFilterPipeline(options: {
  maxAlertsPerDay: number;
  earlyBuys: EarlyBuysTracker;
  volumeByToken: Map<string, VolumeWindow>;
}): FilterPipeline {
  const budget = new DailyAlertBudget(options.maxAlertsPerDay);

  return {
    accept(event) {
      const { match, rule } = evaluateRules(event, {
        earlyBuys: options.earlyBuys,
        volumeByToken: options.volumeByToken,
      });
      if (!match || !rule) return null;
      if (!budget.tryConsume()) return null;

      const now = new Date().toISOString();
      return {
        id: randomUUID(),
        event,
        primaryRule: rule,
        sentence: "",
        createdAt: now,
      };
    },
  };
}
