import type { SignalBus } from "../bus/signal-bus.js";
import type { AlertEnvelope } from "../schema/events.js";
import { BirdeyeClient } from "./client.js";
import { readBirdeyeSignalConfig } from "./config.js";
import { SignalDedupe } from "./dedupe.js";
import { candidateToAlert } from "./envelope.js";
import { BirdeyeScanner } from "./scanner.js";
import { incrementMetric } from "../util/metrics.js";

export interface BirdeyeSignalEngine {
  scanNow(options?: { publish?: boolean }): Promise<AlertEnvelope[]>;
  start(signal: AbortSignal): void;
}

export function createBirdeyeSignalEngine(bus: SignalBus): BirdeyeSignalEngine | null {
  const client = BirdeyeClient.fromEnv();
  if (!client) return null;
  const config = readBirdeyeSignalConfig();
  const scanner = new BirdeyeScanner(client, config);
  const dedupe = new SignalDedupe(config.dedupeTtlMs);

  async function scanWith(label: string, task: () => Promise<AlertEnvelope[]>) {
    try {
      const alerts = await task();
      if (alerts.length) console.error(`[birdeye] ${label}: ${alerts.length} signals`);
      return alerts;
    } catch (error) {
      console.error(`[birdeye] ${label} scan failed`, error);
      return [];
    }
  }

  function publishFresh(alerts: AlertEnvelope[], publish: boolean) {
    const fresh = alerts.filter((alert) => dedupe.shouldEmit(alert.event.dedupeKey ?? alert.id));
    if (publish) fresh.forEach((alert) => {
      bus.publish(alert);
      incrementMetric("alertsPublished");
    });
    return fresh;
  }

  return {
    async scanNow(options = {}) {
      const publish = options.publish ?? true;
      const candidates = await scanner.scanAll();
      const alerts = candidates.map(candidateToAlert);
      return publishFresh(alerts, publish);
    },

    start(signal) {
      if (process.env.BIRDEYE_WORKER_ENABLED === "0") {
        console.error("[birdeye] worker disabled with BIRDEYE_WORKER_ENABLED=0");
        return;
      }
      const runTrending = () =>
        scanWith("trending", async () =>
          publishFresh((await scanner.scanTrendingMarket()).map(candidateToAlert), true),
        );
      const runListings = () =>
        scanWith("new-listings", async () =>
          publishFresh((await scanner.scanNewLaunches()).map(candidateToAlert), true),
        );
      const runGainers = () =>
        scanWith("gainers", async () =>
          publishFresh((await scanner.scanTopGainers()).map(candidateToAlert), true),
        );

      void runTrending();
      const firstListings = setTimeout(() => void runListings(), 4_000);
      const firstGainers = setTimeout(() => void runGainers(), 8_000);
      const trendingTimer = setInterval(() => void runTrending(), config.trendingIntervalMs);
      const listingTimer = setInterval(() => void runListings(), config.newListingIntervalMs);
      const gainersTimer = setInterval(() => void runGainers(), Math.max(60_000, config.trendingIntervalMs * 2));

      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(firstListings);
          clearTimeout(firstGainers);
          clearInterval(trendingTimer);
          clearInterval(listingTimer);
          clearInterval(gainersTimer);
        },
        { once: true },
      );
    },
  };
}
