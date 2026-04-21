/**
 * Verifies Helius RPC + PumpPortal WebSocket (official pump.fun stream).
 * Run: npm install && npm run smoke
 * Loads .env from repo root via NODE_OPTIONS or manual dotenv — Node 20+: `node --env-file=../.env`
 * This package expects: run from lyra-signal with `node --env-file=.env scripts/smoke.mjs`
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnv() {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) {
    console.warn("No .env found; copy .env.example to .env");
    return;
  }
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnv();

function solanaRpcUrl() {
  if (process.env.SOLANA_RPC_URL) return process.env.SOLANA_RPC_URL.trim();
  const k = process.env.HELIUS_API_KEY?.trim();
  if (!k) throw new Error("Set SOLANA_RPC_URL or HELIUS_API_KEY in .env");
  return `https://mainnet.helius-rpc.com/?api-key=${k}`;
}

async function rpcGetVersion(url) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getVersion",
    }),
  });
  const j = await res.json();
  if (j.error) throw new Error(JSON.stringify(j.error));
  return j.result;
}

async function pumpPortalSmoke(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("Timeout waiting for first PumpPortal message"));
    }, 25_000);

    ws.on("open", () => {
      ws.send(JSON.stringify({ method: "subscribeNewToken" }));
    });

    ws.on("message", (data) => {
      clearTimeout(timer);
      const preview = String(data).slice(0, 280);
      console.log("PumpPortal (subscribeNewToken) sample:", preview);
      ws.close();
      resolve();
    });

    ws.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function main() {
  const rpcUrl = solanaRpcUrl();
  console.log("RPC endpoint host:", new URL(rpcUrl).hostname);

  const version = await rpcGetVersion(rpcUrl);
  console.log("Solana getVersion:", version?.["solana-core"] ?? version);

  const wsUrl =
    process.env.PUMP_PORTAL_WS_URL?.trim() || "wss://pumpportal.fun/api/data";
  console.log("PumpPortal WebSocket:", wsUrl);
  await pumpPortalSmoke(wsUrl);
  console.log("OK — RPC + PumpPortal WebSocket are reachable.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
