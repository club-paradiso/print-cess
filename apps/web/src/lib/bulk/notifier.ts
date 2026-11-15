/** A wake-up signal for an async loop: `wait()` resolves at the next `notify()`. */
export class Notifier {
  #waiters: (() => void)[] = [];

  public wait(timeoutMs?: number): Promise<void> {
    return new Promise((resolve) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const done = () => {
        if (timer !== undefined) clearTimeout(timer);
        resolve();
      };
      this.#waiters.push(done);
      if (timeoutMs !== undefined) {
        timer = setTimeout(() => {
          this.#waiters = this.#waiters.filter((waiter) => waiter !== done);
          resolve();
        }, timeoutMs);
      }
    });
  }

  public notify(): void {
    const waiters = this.#waiters;
    this.#waiters = [];
    for (const waiter of waiters) waiter();
  }
}
