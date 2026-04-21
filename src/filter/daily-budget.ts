/**
 * Caps total alerts per UTC day — keeps product in ~70–100/day range.
 */
export class DailyAlertBudget {
  private count = 0;
  private dayKey = "";

  constructor(private readonly maxPerDay: number) {}

  /** @returns true if this alert may be emitted */
  tryConsume(): boolean {
    const key = new Date().toISOString().slice(0, 10);
    if (key !== this.dayKey) {
      this.dayKey = key;
      this.count = 0;
    }
    if (this.count >= this.maxPerDay) return false;
    this.count += 1;
    return true;
  }

  remainingToday(): number {
    const key = new Date().toISOString().slice(0, 10);
    if (key !== this.dayKey) return this.maxPerDay;
    return Math.max(0, this.maxPerDay - this.count);
  }
}
