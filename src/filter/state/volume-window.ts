/**
 * Minimal rolling windows for volume acceleration (USD notional per time bucket).
 * Production: tune window sizes + use slot-aligned buckets if driven by chain data.
 */
export class VolumeWindow {
  private readonly buckets: number[] = [];
  private readonly windowMs: number;
  private lastPrune = 0;

  constructor(windowMs: number, private readonly maxBuckets: number = 64) {
    this.windowMs = windowMs;
  }

  add(amountUsd: number, atMs: number): void {
    this.prune(atMs);
    this.buckets.push(amountUsd);
  }

  /** Simple acceleration: compare recent sum vs prior window. */
  accelerationRatio(atMs: number): number {
    this.prune(atMs);
    if (this.buckets.length < 4) return 1;
    const half = Math.floor(this.buckets.length / 2);
    const a = this.buckets.slice(0, half).reduce((s, x) => s + x, 0);
    const b = this.buckets.slice(half).reduce((s, x) => s + x, 0);
    if (a < 1e-6) return b > 0 ? 100 : 1;
    return b / a;
  }

  private prune(atMs: number): void {
    if (atMs - this.lastPrune < this.windowMs / 4) return;
    this.lastPrune = atMs;
    while (this.buckets.length > this.maxBuckets) this.buckets.shift();
  }
}
