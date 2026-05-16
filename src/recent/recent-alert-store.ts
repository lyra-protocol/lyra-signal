import type { AlertEnvelope } from "../schema/events.js";

export interface RecentAlertStore {
  add(alert: AlertEnvelope): void;
  list(options?: { limit?: number; includeSystem?: boolean }): AlertEnvelope[];
}

export function createRecentAlertStore(maxEntries = 500): RecentAlertStore {
  const byId = new Map<string, AlertEnvelope>();

  return {
    add(alert) {
      byId.set(alert.id, alert);
      if (byId.size <= maxEntries) return;
      const oldest = [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      for (const item of oldest.slice(0, byId.size - maxEntries)) byId.delete(item.id);
    },
    list(options = {}) {
      const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
      const includeSystem = options.includeSystem ?? false;
      return [...byId.values()]
        .filter((alert) => includeSystem || alert.event.metadata?.pump?.txType !== "heartbeat")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
    },
  };
}
