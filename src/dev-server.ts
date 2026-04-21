/**
 * Development server: SignalBus + WebSocket + PumpPortal worker (or MOCK_INGEST).
 * Production: same process model; workers must stay out of serverless cold paths.
 */
import { createSignalBus } from "./bus/signal-bus.js";
import { createFilterPipeline } from "./filter/pipeline.js";
import { EarlyBuysTracker } from "./filter/state/early-buys-tracker.js";
import type { VolumeWindow } from "./filter/state/volume-window.js";
import { createSignalServer } from "./server/signal-server.js";
import { makeEvent } from "./sources/normalize.js";
import { dispatchNormalizedEvent } from "./pipeline/handle-event.js";
import { processPumpPipeline } from "./pipeline/process-pump.js";
import { startPumpWorker } from "./sources/pump/worker.js";
import { getCachedSolUsd, refreshSolUsdIfStale } from "./util/sol-usd.js";

const PORT = Number(
  process.env.PORT ?? process.env.SIGNAL_HTTP_PORT ?? 3847,
);
// Default budget is intentionally permissive so the /signal page is lively out
// of the box. Tighten via SIGNAL_MAX_ALERTS_PER_DAY once you calibrate rules.
const MAX_ALERTS_PER_DAY = Number(process.env.SIGNAL_MAX_ALERTS_PER_DAY ?? 2000);

async function main() {
  await refreshSolUsdIfStale();

  const bus = createSignalBus();
  const earlyBuys = new EarlyBuysTracker();
  const volumeByToken = new Map<string, VolumeWindow>();
  const pipeline = createFilterPipeline({
    maxAlertsPerDay: MAX_ALERTS_PER_DAY,
    earlyBuys,
    volumeByToken,
  });

  const server = createSignalServer(bus);
  await server.listen(PORT);
  console.error(
    `lyra-signal listening on port ${PORT} (health /, ws /feed) — use PORT or SIGNAL_HTTP_PORT`,
  );

  const pumpEnabled =
    process.env.PUMP_WORKER_ENABLED !== "0" && process.env.MOCK_INGEST !== "1";

  if (process.env.MOCK_INGEST === "1") {
    console.error("MOCK_INGEST=1 — synthetic events only; Pump worker off");
    const timer = setInterval(() => {
      void dispatchNormalizedEvent(
        makeEvent({
          token: "So11111111111111111111111111111111111111112",
          wallet: "11111111111111111111111111111111",
          action: "buy",
          sizeUsd: 6_000 + Math.random() * 100,
          timestampMs: Date.now(),
          source: "pump",
          dedupeKey: `mock-${Date.now()}`,
        }),
        pipeline,
        bus,
        null,
      ).catch((e) => console.error(e));
    }, 12_000);
    process.on("SIGINT", () => {
      clearInterval(timer);
    });
  } else if (pumpEnabled) {
    const ac = new AbortController();
    const minScore = process.env.SCORE_MIN_PUMP ?? "0";
    console.error(
      `[pump] worker starting (SCORE_MIN_PUMP=${minScore}; drops below gate before rules/LLM)`,
    );
    startPumpWorker({
      signal: ac.signal,
      getSolUsd: getCachedSolUsd,
      onRefreshSol: async () => {
        await refreshSolUsdIfStale();
      },
      onEvent: (e) => processPumpPipeline(e, pipeline, bus),
    });
    const shutdown = () => ac.abort();
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } else {
    console.error("PUMP_WORKER_ENABLED=0 — no ingestion; WS idle until you enable pump");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
