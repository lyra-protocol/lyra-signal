export class SignalDedupe {
  private readonly seen = new Map<string, number>();

  constructor(private readonly ttlMs: number) {}

  shouldEmit(key: string, now = Date.now()): boolean {
    this.prune(now);
    const until = this.seen.get(key);
    if (until && until > now) return false;
    this.seen.set(key, now + this.ttlMs);
    return true;
  }

  private prune(now: number) {
    if (this.seen.size < 1_000) return;
    for (const [key, until] of this.seen) {
      if (until <= now) this.seen.delete(key);
    }
  }
}
