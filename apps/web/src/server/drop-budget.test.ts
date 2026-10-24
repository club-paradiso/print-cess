import { describe, expect, it, vi } from "vitest";

import { chargeDropBudget } from "./drop-budget";
import { MemoryDropStore } from "./drop-store/memory";

const MIB = 1024 * 1024;
const HOUR = 60 * 60_000;
const config = { dropClientHourlyBytes: 100 * MIB, dropClientHourlyTransfers: 3 };

describe("hourly drop budget", () => {
  it("refuses a fourth transfer in the same hour from the same address", async () => {
    const drops = new MemoryDropStore();
    for (let index = 0; index < 3; index += 1) {
      await chargeDropBudget(drops, config, "198.51.100.7", MIB, 10 * HOUR);
    }
    await expect(chargeDropBudget(drops, config, "198.51.100.7", MIB, 10 * HOUR)).rejects.toThrow(
      "You have sent a lot in the last hour.",
    );
    await expect(
      chargeDropBudget(drops, config, "198.51.100.8", MIB, 10 * HOUR),
    ).resolves.toBeUndefined();
    await expect(
      chargeDropBudget(drops, config, "198.51.100.7", MIB, 11 * HOUR),
    ).resolves.toBeUndefined();
  });

  it("refuses bytes beyond the hourly allowance", async () => {
    const drops = new MemoryDropStore();
    await chargeDropBudget(drops, config, "198.51.100.7", 60 * MIB, 10 * HOUR);
    await expect(
      chargeDropBudget(drops, config, "198.51.100.7", 60 * MIB, 10 * HOUR),
    ).rejects.toMatchObject({ status: 429 });
  });

  it("never hands the raw address to the shared store", async () => {
    const drops = new MemoryDropStore();
    const consume = vi.spyOn(drops, "consumeBudget");
    await chargeDropBudget(drops, config, "198.51.100.7", MIB, 10 * HOUR);
    for (const [key] of consume.mock.calls) {
      expect(key).not.toContain("198.51.100.7");
      expect(key).toMatch(/^(drops|bytes):[0-9a-f]{32}$/u);
    }
  });
});
