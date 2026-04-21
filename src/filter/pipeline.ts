import { randomUUID } from "node:crypto";
import {
  deriveSeverity,
  type AlertEnvelope,
  type NormalizedEvent,
} from "../schema/events.js";
import { DailyAlertBudget } from "./daily-budget.js";
import { evaluateRules, VOLUME_REPEAT_MS } from "./rules.js";
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
  const lastVolumeSurgeAt = new Map<string, number>();

  return {
    accept(event, score) {
      const { match, rule } = evaluateRules(event, {
        earlyBuys: options.earlyBuys,
        volumeByToken: options.volumeByToken,
      });
      if (!match || !rule) return null;

      if (rule === "volume_acceleration" && VOLUME_REPEAT_MS > 0) {
        const prev = lastVolumeSurgeAt.get(event.token);
        const t = event.timestampMs;
        if (prev !== undefined && t - prev < VOLUME_REPEAT_MS) {
          return null;
        }
        lastVolumeSurgeAt.set(event.token, t);
      }

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
