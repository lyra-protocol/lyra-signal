import { randomUUID } from "node:crypto";
import {
  deriveSeverity,
  type AlertEnvelope,
  type NormalizedEvent,
} from "../schema/events.js";
import { DailyAlertBudget } from "./daily-budget.js";
import { evaluateRules } from "./rules.js";
import type { EarlyBuysTracker } from "./state/early-buys-tracker.js";
import type { VolumeWindow } from "./state/volume-window.js";
import { incrementMetric } from "../util/metrics.js";

export interface FilterPipeline {
  /** Returns null if dropped by rules or daily cap. */
  accept(event: NormalizedEvent, score?: number): AlertEnvelope | null;
}

export function createFilterPipeline(options: {
  maxAlertsPerDay: number;
  earlyBuys: EarlyBuysTracker;
  volumeByToken: Map<string, VolumeWindow>;
}): FilterPipeline {
  const budget = new DailyAlertBudget(options.maxAlertsPerDay);

  return {
    accept(event, score) {
      const { match, rule } = evaluateRules(event, {
        earlyBuys: options.earlyBuys,
        volumeByToken: options.volumeByToken,
      });
      if (!match || !rule) return null;
      incrementMetric("ruleMatched");
      if (!budget.tryConsume()) {
        incrementMetric("budgetDropped");
        return null;
      }

      const now = new Date().toISOString();
      return {
        id: randomUUID(),
        event,
        primaryRule: rule,
        severity: deriveSeverity(event, rule, score),
        score,
        sentence: "",
        createdAt: now,
      };
    },
  };
}
