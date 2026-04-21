import { randomUUID } from "node:crypto";
import type { SignalBus } from "../bus/signal-bus.js";
import type { AlertEnvelope } from "../schema/events.js";
import { getCachedSolUsd } from "../util/sol-usd.js";
import { incrementMetric, snapshotMetrics } from "../util/metrics.js";

const HEARTBEAT_TOKEN = "HEARTBEAT11111111111111111111111111111111";
const HEARTBEAT_WALLET = "lyra-signal-heartbeat";

type StartOptions = {
  bus: SignalBus;
  signal: AbortSignal;
  /** Milliseconds between heartbeats. 0 disables. Default 5 minutes. */
  intervalMs?: number;
  /** Minimum silence (ms) before a heartbeat is emitted. Default = intervalMs. */
  silenceThresholdMs?: number;
};

function buildHeartbeat(): AlertEnvelope {
  const now = new Date();
  const sol = getCachedSolUsd();
  return {
    id: randomUUID(),
    primaryRule: "volume_acceleration",
    severity: "info",
    sentence: `Heartbeat · pipeline online · SOL $${sol.toFixed(2)} · ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`,
    createdAt: now.toISOString(),
    event: {
      token: HEARTBEAT_TOKEN,
      wallet: HEARTBEAT_WALLET,
      action: "unknown",
      sizeUsd: 0,
      timestampMs: now.getTime(),
      source: "pump",
      metadata: {
        pump: {
          name: "Lyra Signal heartbeat",
          symbol: "PING",
          txType: "heartbeat",
        },
      },
    },
  };
}

/**
 * Emits a heartbeat alert on a timer, but only when the real pipeline has
 * been quiet for `silenceThresholdMs`. Keeps /signal visually alive and
 * lets front-end users confirm the bus is healthy without needing /diag.
 */
export function startHeartbeatPublisher({
  bus,
  signal,
  intervalMs = Number(process.env.SIGNAL_HEARTBEAT_MS ?? 300_000),
  silenceThresholdMs,
}: StartOptions): void {
  if (!intervalMs || intervalMs <= 0) return;
  const threshold = silenceThresholdMs ?? intervalMs;

  const tick = () => {
    if (signal.aborted) return;
    const metrics = snapshotMetrics();
    const lastAlert = metrics.lastAlertAt
      ? new Date(metrics.lastAlertAt).getTime()
      : 0;
    const quietFor = Date.now() - lastAlert;
    if (lastAlert === 0 || quietFor >= threshold) {
      bus.publish(buildHeartbeat());
      incrementMetric("heartbeatsPublished");
    }
  };

  // Fire once shortly after boot so the /signal page lights up immediately.
  const bootTimer = setTimeout(tick, 5_000);
  const loop = setInterval(tick, intervalMs);

  signal.addEventListener(
    "abort",
    () => {
      clearTimeout(bootTimer);
      clearInterval(loop);
    },
    { once: true },
  );
}
