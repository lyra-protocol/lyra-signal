import { EventEmitter } from "node:events";
import type { AlertEnvelope } from "../schema/events.js";

/** In-process pub/sub. Swap for Redis pub/sub when you scale past one API instance. */
export interface SignalBus {
  publish(alert: AlertEnvelope): void;
  subscribe(handler: (alert: AlertEnvelope) => void): () => void;
}

export function createSignalBus(): SignalBus {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(0);

  return {
    publish(alert) {
      emitter.emit("alert", alert);
    },
    subscribe(handler) {
      emitter.on("alert", handler);
      return () => {
        emitter.off("alert", handler);
      };
    },
  };
}
