/**
 * Lightweight in-process counters so /diag can explain why alerts are (or
 * aren't) flowing without adding a metrics system.
 */

export type MetricsSnapshot = {
  startedAt: string;
  lastAlertAt: string | null;
  counts: {
    pumpFramesReceived: number;
    pumpEventsParsed: number;
    pumpScoreDropped: number;
    ruleMatched: number;
    budgetDropped: number;
    alertsPublished: number;
    heartbeatsPublished: number;
  };
  pumpWorker: {
    state: "idle" | "connecting" | "open" | "closed" | "error";
    lastOpenAt: string | null;
    lastCloseAt: string | null;
    lastError: string | null;
    reconnects: number;
    subscribedMints: number;
  };
};

function zeroCounts(): MetricsSnapshot["counts"] {
  return {
    pumpFramesReceived: 0,
    pumpEventsParsed: 0,
    pumpScoreDropped: 0,
    ruleMatched: 0,
    budgetDropped: 0,
    alertsPublished: 0,
    heartbeatsPublished: 0,
  };
}

const metrics: MetricsSnapshot = {
  startedAt: new Date().toISOString(),
  lastAlertAt: null,
  counts: zeroCounts(),
  pumpWorker: {
    state: "idle",
    lastOpenAt: null,
    lastCloseAt: null,
    lastError: null,
    reconnects: 0,
    subscribedMints: 0,
  },
};

export function incrementMetric(key: keyof MetricsSnapshot["counts"], by = 1) {
  metrics.counts[key] += by;
  if (key === "alertsPublished") {
    metrics.lastAlertAt = new Date().toISOString();
  }
}

export function setPumpWorkerState(
  patch: Partial<MetricsSnapshot["pumpWorker"]>,
) {
  Object.assign(metrics.pumpWorker, patch);
}

export function snapshotMetrics(): MetricsSnapshot {
  // Return a shallow clone so callers can't mutate internal state.
  return {
    startedAt: metrics.startedAt,
    lastAlertAt: metrics.lastAlertAt,
    counts: { ...metrics.counts },
    pumpWorker: { ...metrics.pumpWorker },
  };
}
