import type { NormalizedEvent, TradeAction } from "../schema/events.js";

/** Raw PumpPortal payload (subset; fields vary by txType). */
export interface PumpPortalPayload {
  message?: string;
  signature?: string;
  mint?: string;
  traderPublicKey?: string;
  txType?: string;
  solAmount?: number;
  marketCapSol?: number;
  /** Token amount on create (not SOL). */
  initialBuy?: number;
  vSolInBondingCurve?: number;
  vTokensInBondingCurve?: number;
  name?: string;
  symbol?: string;
  pool?: string;
}

function mapTxType(raw: string | undefined): TradeAction | null {
  if (!raw) return null;
  const t = raw.toLowerCase();
  if (t === "create") return "create";
  if (t === "buy") return "buy";
  if (t === "sell") return "sell";
  if (t === "migrate" || t === "migration") return "migrate";
  return "unknown";
}

/**
 * Turn one PumpPortal JSON message into NormalizedEvent, or null if ack/irrelevant.
 */
export function parsePumpPortalMessage(
  rawJson: string,
  solUsd: number,
): NormalizedEvent | null {
  let p: PumpPortalPayload;
  try {
    p = JSON.parse(rawJson) as PumpPortalPayload;
  } catch {
    return null;
  }

  if (typeof p.message === "string" && !p.mint) return null;

  const action = mapTxType(p.txType);
  if (!action || action === "unknown") return null;

  const mint = p.mint?.trim();
  const wallet = p.traderPublicKey?.trim();
  if (!mint || !wallet) return null;

  const sol = typeof p.solAmount === "number" ? Math.abs(p.solAmount) : 0;
  const sizeUsd = sol * solUsd;

  const ts = Date.now();

  return {
    token: mint,
    wallet,
    action,
    sizeUsd,
    timestampMs: ts,
    source: "pump",
    dedupeKey: p.signature ? `${p.signature}:${p.txType}` : undefined,
    metadata: {
      pump: {
        marketCapSol: p.marketCapSol,
        vSolInBondingCurve: p.vSolInBondingCurve,
        vTokensInBondingCurve: p.vTokensInBondingCurve,
        initialBuyTokens:
          typeof p.initialBuy === "number" ? p.initialBuy : undefined,
        name: p.name,
        symbol: p.symbol,
        pool: p.pool,
        txType: p.txType,
      },
    },
  };
}
