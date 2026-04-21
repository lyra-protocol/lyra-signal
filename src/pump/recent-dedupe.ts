/**
 * Skip duplicate signatures within a short TTL (reconnects / duplicate frames).
 */
export class RecentDedupe {
  private readonly ttlMs: number;
  private readonly map = new Map<string, number>();

  constructor(ttlMs: number = 120_000) {
    this.ttlMs = ttlMs;
  }

  /** @returns true if this key was already seen recently */
  checkAndSet(key: string): boolean {
    const now = Date.now();
    this.prune(now);
    if (this.map.has(key)) return true;
    this.map.set(key, now);
    return false;
  }

  private prune(now: number): void {
    const cutoff = now - this.ttlMs;
    for (const [k, t] of this.map) {
      if (t < cutoff) this.map.delete(k);
    }
  }
}
