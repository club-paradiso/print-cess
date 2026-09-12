import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { scoreBenchmark } from "./metrics.mjs";

function formatMetric(value) {
  if (value === null || value === undefined) return "n/a";
  if (typeof value !== "number") return String(value);
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(4);
}

async function main() {
  const inputPath = resolve(process.argv[2] ?? "benchmarks/scanner/fixtures/ci-smoke.json");
  const outputPath = resolve(
    process.argv[3] ?? "artifacts/scanner-benchmark/scanner-quality-report.json",
  );

  const input = JSON.parse(await readFile(inputPath, "utf8"));
  const report = scoreBenchmark(input);

  console.log(`Scanner benchmark: ${report.suite}`);
  console.log(`Source: ${report.source}`);
  if (report.device) console.log(`Device: ${report.device}`);
  console.log("");

  for (const check of report.checks) {
    const marker = check.passed ? "PASS" : "FAIL";
    console.log(
      `${marker.padEnd(4)}  ${check.name}: ${formatMetric(check.value)} ${check.operator} ${formatMetric(check.threshold)}`,
    );
  }

  if (report.violations.length > 0) {
    console.log("\nPrivacy / integrity violations:");
    for (const violation of report.violations) console.log(`- ${violation}`);
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`\nReport: ${outputPath}`);

  if (!report.passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
