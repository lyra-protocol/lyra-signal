import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";
import type { SignalBus } from "../bus/signal-bus.js";
import type { AlertEnvelope } from "../schema/events.js";
import { resolveListenHost } from "../util/listen-host.js";
import { snapshotMetrics } from "../util/metrics.js";
import {
  LARGE_USD,
  MAX_EARLY_BUY_INDEX,
  ACCEL_RATIO,
  VOLUME_WINDOW_MS,
} from "../filter/rules.js";

export interface SignalServer {
  listen(port: number): Promise<void>;
  close(): Promise<void>;
}

/**
 * HTTP + WebSocket on the same port. WS path `/feed`.
 * Latency: zero queue between bus.publish and ws.send (same tick).
 */
export function createSignalServer(bus: SignalBus): SignalServer {
  const httpServer = createServer((req, res) => {
    if (req.url === "/health" || req.url === "/") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, service: "lyra-signal" }));
      return;
    }
    if (req.url === "/diag" || req.url?.startsWith("/diag?")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify(
          {
            ok: true,
            service: "lyra-signal",
            metrics: snapshotMetrics(),
            config: {
              largeUsd: LARGE_USD,
              maxEarlyBuyIndex: MAX_EARLY_BUY_INDEX,
              accelRatio: ACCEL_RATIO,
              volumeWindowMs: VOLUME_WINDOW_MS,
              scoreMinPump: Number(process.env.SCORE_MIN_PUMP ?? 0),
              maxAlertsPerDay: Number(
                process.env.SIGNAL_MAX_ALERTS_PER_DAY ?? 2000,
              ),
              mockIngest: process.env.MOCK_INGEST === "1",
              pumpWorkerEnabled:
                process.env.PUMP_WORKER_ENABLED !== "0" &&
                process.env.MOCK_INGEST !== "1",
            },
          },
          null,
          2,
        ),
      );
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request, socket, head) => {
    if (request.url?.startsWith("/feed")) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
      return;
    }
    socket.destroy();
  });

  const unsubscribe = bus.subscribe((alert: AlertEnvelope) => {
    const payload = JSON.stringify({ type: "alert", payload: alert });
    for (const client of wss.clients) {
      if (client.readyState === 1) client.send(payload);
    }
  });

  wss.on("connection", (ws) => {
    ws.send(
      JSON.stringify({
        type: "ready",
        connectionId: randomUUID(),
      }),
    );
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as { type?: string };
        if (msg.type === "ping") ws.send(JSON.stringify({ type: "pong" }));
      } catch {
        /* ignore */
      }
    });
  });

  return {
    listen(port) {
      return new Promise((resolve, reject) => {
        httpServer.once("error", reject);
        const host = resolveListenHost();
        httpServer.listen(port, host, () => resolve());
      });
    },
    close() {
      unsubscribe();
      return new Promise((resolve) => {
        wss.close(() => {
          httpServer.close(() => resolve());
        });
      });
    },
  };
}
