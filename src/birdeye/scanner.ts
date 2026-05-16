import { BirdeyeClient } from "./client.js";
import type { BirdeyeSignalConfig } from "./config.js";
import {
  asRecord,
  dataRecord,
  mergeProfile,
  pickSecurity,
  pickTokenProfile,
  readArray,
  readNumber,
  readString,
} from "./extract.js";
import type { BirdeyeSignalCandidate, BirdeyeTokenProfile } from "./types.js";
import { safeBirdeye } from "./safe.js";
import { topWalletHolding, walletNote } from "./wallet.js";
import { ageHint, priceChangePercent, scoreBase, tradeUsd, volumeSurge } from "./scanner-metrics.js";

export class BirdeyeScanner {
  constructor(
    private readonly client: BirdeyeClient,
    private readonly config: BirdeyeSignalConfig,
  ) {}

  async scanAll(): Promise<BirdeyeSignalCandidate[]> {
    const [launches, market, gainers] = await Promise.all([
      this.scanNewLaunches(),
      this.scanTrendingMarket(),
      this.scanTopGainers(),
    ]);
    return [...launches, ...market, ...gainers].sort((a, b) => b.score - a.score);
  }

  async scanNewLaunches(): Promise<BirdeyeSignalCandidate[]> {
    const response = await safeBirdeye(() => this.client.newListings({ limit: this.config.candidateLimit }));
    const items = readArray(response, ["data", "items"]);
    const candidates: BirdeyeSignalCandidate[] = [];
    for (const item of items) {
      const base = pickTokenProfile(item);
      if (!base) continue;
      const [profile, safety] = await Promise.all([
        this.enrichProfile(base),
        this.loadSecurity(base.address),
      ]);
      if ((safety?.score ?? 0) < this.config.minSafetyScore) continue;
      if ((profile.liquidityUsd ?? 0) < this.config.minLiquidityUsd) continue;
      candidates.push({
        type: "new_launch",
        profile,
        safety,
        score: scoreBase(65, safety?.score, profile.liquidityUsd),
        note: ageHint(item),
      });
    }
    return candidates;
  }

  async scanTrendingMarket(): Promise<BirdeyeSignalCandidate[]> {
    const response = await safeBirdeye(() =>
      this.client.tokenTrending({ interval: "1h", limit: this.config.candidateLimit }),
    );
    const profiles = readArray(response, ["data", "tokens"])
      .map(pickTokenProfile)
      .filter((item): item is BirdeyeTokenProfile => Boolean(item));
    await this.mergeMultiPrice(profiles);

    const groups = await Promise.all(
      profiles.map(async (profile) => this.scanTokenMarketSignals(await this.enrichProfile(profile))),
    );
    return groups.flat().sort((a, b) => b.score - a.score);
  }

  async scanTopGainers(): Promise<BirdeyeSignalCandidate[]> {
    const response = await safeBirdeye(() => this.client.gainersLosers({ limit: 5, type: "today" }));
    const items = readArray(response, ["data", "items"]);
    const candidates: BirdeyeSignalCandidate[] = [];
    for (const item of items) {
      const wallet = readString(item, "address", "wallet");
      const pnl = readNumber(item, "pnl", "PnL");
      if (!wallet || pnl == null) continue;
      const holding = await topWalletHolding(this.client, wallet);
      if (!holding) continue;
      const profile = await this.enrichProfile(holding);
      const gainPercent = profile.price24hChangePercent ?? profile.price1hChangePercent;
      if ((gainPercent ?? 0) < this.config.topGainerPercent) continue;
      candidates.push({
        type: "top_gainer",
        profile,
        score: scoreBase(62, gainPercent, profile.volume1hUsd),
        safety: await this.loadSecurity(profile.address),
        wallet,
        traderPnlUsd: pnl,
        gainPercent,
      });
    }
    return candidates;
  }

  private async scanTokenMarketSignals(profile: BirdeyeTokenProfile) {
    const [safety, priceVolume, whale, momentum] = await Promise.all([
      this.loadSecurity(profile.address),
      this.loadPriceVolume(profile.address),
      this.scanWhales(profile),
      this.scanMomentum(profile),
    ]);
    const merged = mergeProfile(profile, priceVolume);
    const candidates: BirdeyeSignalCandidate[] = [];
    if ((merged.volume1hChangePercent ?? 0) > this.config.trendingVolumeChangePercent) {
      candidates.push({
        type: "trending_breakout",
        profile: merged,
        safety,
        score: scoreBase(64, merged.volume1hChangePercent, merged.volume1hUsd),
      });
    }
    if (whale) candidates.push({ ...whale, safety });
    if (momentum) candidates.push({ ...momentum, safety });
    return candidates;
  }

  private async scanWhales(profile: BirdeyeTokenProfile): Promise<BirdeyeSignalCandidate | null> {
    const response = await safeBirdeye(() => this.client.tradesToken(profile.address, 20));
    const trades = readArray(response, ["data", "items"]).concat(readArray(response, ["data", "txs"]));
    const trade = trades
      .map((item) => ({ item, usd: tradeUsd(item) }))
      .filter((item) => item.usd >= this.config.whaleUsd)
      .sort((a, b) => b.usd - a.usd)[0];
    if (!trade) return null;
    const wallet = readString(trade.item, "owner", "wallet", "from", "txFrom", "maker");
    const note = wallet ? await walletNote(this.client, wallet) : "wallet unavailable";
    return {
      type: "whale_move",
      profile,
      score: scoreBase(72, trade.usd / 1_000, profile.liquidityUsd),
      safety: null,
      wallet,
      amountUsd: trade.usd,
      priceImpactPercent: readNumber(trade.item, "priceImpact", "priceImpactPercent"),
      note,
    };
  }

  private async scanMomentum(profile: BirdeyeTokenProfile): Promise<BirdeyeSignalCandidate | null> {
    const to = Math.floor(Date.now() / 1000);
    const from = to - 20 * 60;
    const [history, ohlcv] = await Promise.all([
      safeBirdeye(() => this.client.historyPrice(profile.address, from, to)),
      safeBirdeye(() => this.client.ohlcv(profile.address, from, to)),
    ]);
    const change = priceChangePercent(history) ?? profile.price1hChangePercent;
    if ((change ?? 0) < this.config.momentumPercent15m) return null;
    const surge = volumeSurge(ohlcv);
    return {
      type: "momentum_spike",
      profile: { ...profile, price1hChangePercent: change ?? profile.price1hChangePercent },
      score: scoreBase(66, change, profile.volume1hUsd),
      safety: null,
      volumeSurgeMultiple: surge,
    };
  }

  private async enrichProfile(profile: BirdeyeTokenProfile): Promise<BirdeyeTokenProfile> {
    const [overview, price] = await Promise.all([
      safeBirdeye(() => this.client.tokenOverview(profile.address)),
      safeBirdeye(() => this.client.price(profile.address)),
    ]);
    return mergeProfile(mergeProfile(profile, pickTokenProfile(dataRecord(overview) ?? {})), pickTokenProfile(dataRecord(price) ?? {}));
  }

  private async loadSecurity(address: string) {
    const response = await safeBirdeye(() => this.client.tokenSecurity(address));
    return pickSecurity(dataRecord(response));
  }

  private async loadPriceVolume(address: string): Promise<Partial<BirdeyeTokenProfile> | null> {
    const response = await safeBirdeye(() => this.client.priceVolumeSingle(address, "1h"));
    return pickTokenProfile(dataRecord(response) ?? {}) ?? null;
  }

  private async mergeMultiPrice(profiles: BirdeyeTokenProfile[]) {
    if (!profiles.length) return;
    const response = await safeBirdeye(() => this.client.multiPrice(profiles.map((item) => item.address)));
    const data = dataRecord(response);
    if (!data) return;
    for (const profile of profiles) {
      const raw = asRecord(data[profile.address]) ?? asRecord(data[profile.address.toLowerCase()]);
      const update = raw ? pickTokenProfile({ ...raw, address: profile.address }) : null;
      if (!update) continue;
      Object.assign(profile, mergeProfile(profile, update));
    }
  }

}
