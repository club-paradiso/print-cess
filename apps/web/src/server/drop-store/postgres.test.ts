import type { QueryResult, QueryResultRow } from "pg";
import { describe, expect, it } from "vitest";

import type { PostgresExecutor, PostgresQueryClient } from "../session-store/postgres-client";
import { RailwayPostgresDropStore } from "./postgres";

describe("RailwayPostgresDropStore budgets", () => {
  it("adds to the window total only while it stays within the limit", async () => {
    const database = new FakeBudgetExecutor();
    const store = new RailwayPostgresDropStore(database);

    await expect(store.consumeBudget("bytes:abc", 6, 10, 60_000, 125_000)).resolves.toBe(true);
    await expect(store.consumeBudget("bytes:abc", 5, 10, 60_000, 130_000)).resolves.toBe(false);
    await expect(store.consumeBudget("bytes:abc", 4, 10, 60_000, 130_000)).resolves.toBe(true);
    await expect(store.consumeBudget("bytes:abc", 5, 10, 60_000, 180_000)).resolves.toBe(true);
    await expect(store.consumeBudget("bytes:abc", 11, 10, 60_000, 180_000)).resolves.toBe(false);
  });
});

class FakeBudgetExecutor implements PostgresExecutor {
  private readonly budgets = new Map<string, number>();

  public async transaction<T>(
    _id: string,
    action: (client: PostgresQueryClient) => Promise<T>,
  ): Promise<T> {
    return action({ query: (text, values) => this.query(text, values) });
  }

  public async query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<QueryResult<R>> {
    const sql = text.replace(/\s+/gu, " ").trim();
    if (sql.startsWith("CREATE")) return result([]);
    if (sql.startsWith("DELETE FROM print_cess_drop_budget_v1")) {
      for (const key of this.budgets.keys()) {
        if (Number(key.split("|")[1]) < Number(values[0])) this.budgets.delete(key);
      }
      return result([]);
    }
    if (sql.startsWith("INSERT INTO print_cess_drop_budget_v1")) {
      const key = `${String(values[0])}|${String(values[1])}`;
      const amount = Number(values[2]);
      const used = this.budgets.get(key);
      if (used !== undefined && used + amount > Number(values[3])) return result([]);
      this.budgets.set(key, (used ?? 0) + amount);
      return result<R>([{ used: (used ?? 0) + amount } as unknown as R]);
    }
    throw new Error(`Unexpected test query: ${sql}`);
  }
}

function result<R extends QueryResultRow>(rows: R[]): QueryResult<R> {
  return { rows, rowCount: rows.length, command: "", oid: 0, fields: [] };
}
