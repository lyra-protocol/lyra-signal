import { Redis } from "ioredis";
import { defaultPreferences, type TelegramPreferences } from "../telegram/preferences.js";

export interface TelegramPreferenceStore {
  get(chatId: number): Promise<TelegramPreferences>;
  save(preferences: TelegramPreferences): Promise<void>;
  subscribe(chatId: number): Promise<TelegramPreferences>;
  listSubscribers(): Promise<TelegramPreferences[]>;
}

export function createTelegramPreferenceStore(): TelegramPreferenceStore {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) return new MemoryPreferenceStore();
  return new RedisPreferenceStore(new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 2 }));
}

class MemoryPreferenceStore implements TelegramPreferenceStore {
  private readonly users = new Map<number, TelegramPreferences>();

  async get(chatId: number) {
    return this.users.get(chatId) ?? defaultPreferences(chatId);
  }

  async save(preferences: TelegramPreferences) {
    this.users.set(preferences.chatId, preferences);
  }

  async subscribe(chatId: number) {
    const prefs = await this.get(chatId);
    await this.save(prefs);
    return prefs;
  }

  async listSubscribers() {
    return [...this.users.values()];
  }
}

class RedisPreferenceStore implements TelegramPreferenceStore {
  constructor(private readonly redis: Redis) {}

  async get(chatId: number) {
    const raw = await this.redis.get(key(chatId));
    return raw ? { ...defaultPreferences(chatId), ...JSON.parse(raw) } : defaultPreferences(chatId);
  }

  async save(preferences: TelegramPreferences) {
    await this.redis.set(key(preferences.chatId), JSON.stringify(preferences));
    await this.redis.sadd("telegram:subscribers", String(preferences.chatId));
  }

  async subscribe(chatId: number) {
    const prefs = await this.get(chatId);
    await this.save(prefs);
    return prefs;
  }

  async listSubscribers() {
    const ids = await this.redis.smembers("telegram:subscribers");
    return Promise.all(ids.map((id: string) => this.get(Number(id))));
  }
}

function key(chatId: number) {
  return `telegram:preferences:${chatId}`;
}
