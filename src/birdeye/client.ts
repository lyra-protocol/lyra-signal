import type { BirdeyeChain } from "./types.js";

const BASE_URL = "https://public-api.birdeye.so";
const DEFAULT_TIMEOUT_MS = 12_000;

export class BirdeyeHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
  ) {
    super(message);
    this.name = "BirdeyeHttpError";
  }
}

type Query = Record<string, string | number | boolean | undefined>;

type RequestOptions = {
  chain?: BirdeyeChain;
  query?: Query;
  timeoutMs?: number;
};

export class BirdeyeClient {
  constructor(private readonly apiKey: string) {}

  static fromEnv(): BirdeyeClient | null {
    const apiKey = process.env.BIRDEYE_API_KEY?.trim();
    return apiKey ? new BirdeyeClient(apiKey) : null;
  }

  tokenTrending(args: {
    interval?: "1h" | "4h" | "24h";
    limit?: number;
    offset?: number;
  } = {}) {
    return this.get("/defi/token_trending", {
      query: {
        sort_by: "rank",
        sort_type: "asc",
        interval: args.interval ?? "1h",
        limit: bounded(args.limit ?? 20, 1, 20),
        offset: args.offset ?? 0,
        ui_amount_mode: "scaled",
      },
    });
  }

  newListings(args: { limit?: number; timeTo?: number } = {}) {
    return this.get("/defi/v2/tokens/new_listing", {
      query: {
        limit: bounded(args.limit ?? 10, 1, 20),
        time_to: args.timeTo,
        meme_platform_enabled: true,
      },
    });
  }

  tokenSecurity(address: string) {
    return this.get("/defi/token_security", { query: { address } });
  }

  tokenOverview(address: string, frames = "15m,1h,24h") {
    return this.get("/defi/token_overview", {
      query: { address, frames, ui_amount_mode: "scaled" },
    });
  }

  price(address: string) {
    return this.get("/defi/price", {
      query: { address, include_liquidity: true, ui_amount_mode: "scaled" },
    });
  }

  priceVolumeSingle(address: string, type: "1h" | "2h" | "4h" | "8h" | "24h") {
    return this.get("/defi/price_volume/single", {
      query: { address, type, ui_amount_mode: "scaled" },
    });
  }

  historyPrice(address: string, timeFrom: number, timeTo: number) {
    return this.get("/defi/history_price", {
      query: {
        address,
        address_type: "token",
        type: "1m",
        time_from: timeFrom,
        time_to: timeTo,
        ui_amount_mode: "scaled",
      },
    });
  }

  ohlcv(address: string, timeFrom: number, timeTo: number) {
    return this.get("/defi/ohlcv", {
      query: {
        address,
        type: "1m",
        currency: "usd",
        time_from: timeFrom,
        time_to: timeTo,
        ui_amount_mode: "scaled",
      },
    });
  }

  multiPrice(addresses: string[]) {
    return this.get("/defi/multi_price", {
      query: {
        list_address: addresses.slice(0, 100).join(","),
        include_liquidity: true,
        ui_amount_mode: "scaled",
      },
    });
  }

  gainersLosers(args: { limit?: number; type?: "today" | "yesterday" | "1W" } = {}) {
    return this.get("/trader/gainers-losers", {
      query: {
        type: args.type ?? "today",
        sort_by: "PnL",
        sort_type: "desc",
        offset: 0,
        limit: bounded(args.limit ?? 5, 1, 10),
      },
    });
  }

  tradesToken(address: string, limit = 20) {
    return this.get("/defi/txs/token", {
      query: {
        address,
        offset: 0,
        limit: bounded(limit, 1, 50),
        tx_type: "swap",
        sort_type: "desc",
        ui_amount_mode: "scaled",
      },
    });
  }

  walletTokenList(wallet: string) {
    return this.get("/v1/wallet/token_list", {
      query: { wallet, ui_amount_mode: "scaled" },
    });
  }

  private async get(path: string, options: RequestOptions = {}) {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const timeout = AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const response = await fetch(url, {
      headers: {
        "X-API-KEY": this.apiKey,
        "x-chain": options.chain ?? "solana",
      },
      signal: timeout,
    });

    const json = (await response.json().catch(async () => ({
      success: false,
      message: await response.text().catch(() => ""),
    }))) as unknown;

    if (!response.ok) {
      const message = readMessage(json) || `Birdeye request failed (${response.status})`;
      throw new BirdeyeHttpError(message, response.status, path);
    }

    return json;
  }
}

function bounded(value: number, min: number, max: number) {
  return Math.min(Math.max(Math.floor(value), min), max);
}

function readMessage(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const message = (value as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
}
