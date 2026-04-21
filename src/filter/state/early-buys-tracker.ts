/**
 * Tracks buy count per token for "first N buys" rule.
 * In-memory only; reset on process restart (acceptable for MVP).
 */
export class EarlyBuysTracker {
  private readonly counts = new Map<string, number>();

  /** Returns 1-based index of this buy for the token. */
  recordBuy(token: string): number {
    const next = (this.counts.get(token) ?? 0) + 1;
    this.counts.set(token, next);
    return next;
  }

  getCount(token: string): number {
    return this.counts.get(token) ?? 0;
  }
}
