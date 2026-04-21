import WebSocket from "ws";
import type { NormalizedEvent } from "../../schema/events.js";
import { parsePumpPortalMessage } from "../../pump/parse.js";
import { RecentDedupe } from "../../pump/recent-dedupe.js";

const DEFAULT_WS = "wss://pumpportal.fun/api/data";
const MAX_TRACKED_MINT_TRADES = 400;

export interface PumpWorkerOptions {
  wsUrl?: string;
  signal: AbortSignal;
  getSolUsd: () => number;
  /** Host refreshes SOL/USD cache; return type ignored */
  onRefreshSol?: () => Promise<unknown>;
  onEvent: (event: NormalizedEvent) => void | Promise<void>;
}

/**
 * Single WebSocket: new-token stream + dynamic `subscribeTokenTrade` per mint.
 * Reconnects on close until `signal` aborts.
 */
export function startPumpWorker(options: PumpWorkerOptions): void {
  const wsUrl = options.wsUrl ?? process.env.PUMP_PORTAL_WS_URL ?? DEFAULT_WS;
  const dedupe = new RecentDedupe();
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let active: WebSocket | null = null;
  const subscribedMints = new Set<string>();

  const scheduleReconnect = () => {
    if (options.signal.aborted) return;
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, 3500);
  };

  const connect = () => {
    if (options.signal.aborted) return;

    const ws = new WebSocket(wsUrl);
    active = ws;

    ws.on("open", () => {
      console.error("[pump] connected → subscribeNewToken + subscribeMigration");
      ws.send(JSON.stringify({ method: "subscribeNewToken" }));
      ws.send(JSON.stringify({ method: "subscribeMigration" }));
    });

    ws.on("message", (data) => {
      const raw = String(data);
      const sol = options.getSolUsd();
      const ev = parsePumpPortalMessage(raw, sol);
      if (!ev) return;

      if (ev.dedupeKey && dedupe.checkAndSet(ev.dedupeKey)) return;

      if (ev.action === "create" && ev.token) {
        if (subscribedMints.size < MAX_TRACKED_MINT_TRADES) {
          if (!subscribedMints.has(ev.token)) {
            subscribedMints.add(ev.token);
            ws.send(
              JSON.stringify({
                method: "subscribeTokenTrade",
                keys: [ev.token],
              }),
            );
          }
        }
      }

      void Promise.resolve(options.onEvent(ev)).catch((err) => {
        console.error("[pump] onEvent error", err);
      });
    });

    ws.on("close", (code, reason) => {
      active = null;
      console.error("[pump] closed", code, String(reason));
      scheduleReconnect();
    });

    ws.on("error", (err) => {
      console.error("[pump] socket error", err);
    });
  };

  options.signal.addEventListener(
    "abort",
    () => {
      clearTimeout(reconnectTimer);
      active?.close();
    },
    { once: true },
  );

  void options.onRefreshSol?.();
  setInterval(() => {
    void options.onRefreshSol?.();
  }, 60_000).unref();

  connect();
}
