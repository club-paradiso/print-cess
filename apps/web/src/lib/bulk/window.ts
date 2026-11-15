/**
 * How many sealed blocks the sender may have in flight before it waits for an
 * acknowledgement. The receiver advertises a ceiling (what it is willing to
 * hold in memory); within that, the sender grows the window while blocks are
 * acknowledged promptly and halves it when acknowledgements stall.
 *
 * This is deliberately simple additive-increase / multiplicative-decrease.
 * The data channel already runs SCTP congestion control underneath; this
 * window exists to bound memory on the receiving phone and to keep a single
 * slow storage write from letting megabytes pile up in a JavaScript queue.
 */
export class AdaptiveWindow {
  #size: number;
  #ceiling: number;
  #acksSinceGrowth = 0;

  public constructor(
    initial = 4,
    ceiling = 16,
    private readonly floor = 2,
  ) {
    this.#ceiling = Math.max(floor, ceiling);
    this.#size = Math.min(Math.max(floor, initial), this.#ceiling);
  }

  public get size(): number {
    return this.#size;
  }

  public setCeiling(ceiling: number): void {
    this.#ceiling = Math.max(this.floor, ceiling);
    this.#size = Math.min(this.#size, this.#ceiling);
  }

  /** One block acknowledged in reasonable time. A full window of these grows it by one. */
  public onAck(): void {
    this.#acksSinceGrowth += 1;
    if (this.#acksSinceGrowth >= this.#size && this.#size < this.#ceiling) {
      this.#size += 1;
      this.#acksSinceGrowth = 0;
    }
  }

  /** Acknowledgements are arriving too slowly: back off. */
  public onStall(): void {
    this.#size = Math.max(this.floor, Math.floor(this.#size / 2));
    this.#acksSinceGrowth = 0;
  }
}
