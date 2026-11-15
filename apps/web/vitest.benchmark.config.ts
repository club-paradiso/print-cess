import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  test: {
    include: ["test/benchmark/**/*.bench.test.ts"],
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    testTimeout: 3_600_000,
    pool: "forks",
    execArgv: ["--expose-gc", "--max-old-space-size=4096"],
  },
});
