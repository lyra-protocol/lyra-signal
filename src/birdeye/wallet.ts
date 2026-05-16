import type { BirdeyeClient } from "./client.js";
import { pickTokenProfile, readArray, readNumber, readString } from "./extract.js";
import { safeBirdeye } from "./safe.js";
import type { BirdeyeTokenProfile, JsonRecord } from "./types.js";

export async function topWalletHolding(
  client: BirdeyeClient,
  wallet: string,
): Promise<BirdeyeTokenProfile | null> {
  const response = await safeBirdeye(() => client.walletTokenList(wallet));
  const items = walletTokens(response);
  const best = items
    .map((item) => ({ item, value: readNumber(item, "valueUsd", "valueUSD", "usdValue") ?? 0 }))
    .sort((a, b) => b.value - a.value)[0]?.item;
  return best ? pickTokenProfile(normalizeWalletToken(best)) : null;
}

export async function walletNote(client: BirdeyeClient, wallet: string): Promise<string> {
  const response = await safeBirdeye(() => client.walletTokenList(wallet));
  const count = walletTokens(response).length;
  return count ? `${count} token portfolio checked` : "portfolio unavailable";
}

function walletTokens(response: unknown): JsonRecord[] {
  return readArray(response, ["data", "items"]).concat(readArray(response, ["data", "tokens"]));
}

function normalizeWalletToken(raw: JsonRecord): JsonRecord {
  return {
    ...raw,
    address:
      readString(raw, "address", "tokenAddress", "mint", "token_address") ??
      readString(raw, "token_address"),
    symbol: readString(raw, "symbol", "tokenSymbol"),
    name: readString(raw, "name", "tokenName"),
    price: readNumber(raw, "price", "priceUsd", "priceUSD"),
    liquidity: readNumber(raw, "liquidity", "liquidityUsd", "liquidityUSD"),
  };
}
