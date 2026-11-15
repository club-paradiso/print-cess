import {
  mkdirSync,
  openSync,
  writeSync,
  closeSync,
  existsSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";

import { expect, test, type CDPSession, type Page } from "@playwright/test";

/**
 * Real-browser benchmark: two Chromium contexts on one machine, connected over
 * a real WebRTC data channel (host candidates, loopback). Run manually with a
 * Playwright config whose testDir is test/benchmark, for example:
 *
 *   BULK_BROWSER_BENCH=A,B npx playwright test -c <config> bulk-browser
 *
 * This is still not a phone or a radio: both endpoints share one desktop CPU
 * and the loopback interface. It measures the browser-side cost of the
 * protocol (WebCrypto, SCTP, OPFS writes, React updates) end to end.
 */

const MIB = 1024 * 1024;
const WORKLOADS = [
  { id: "A", files: 20, bytes: 100 * MIB },
  { id: "B", files: 300, bytes: 1024 * MIB },
];
const DIRECTORY = process.env.BULK_BENCH_DIR ?? "/tmp/print-cess-bulk-bench";

function corpus(id: string, files: number, bytes: number): string[] {
  const directory = join(DIRECTORY, id);
  mkdirSync(directory, { recursive: true });
  const each = Math.floor(bytes / files);
  const chunk = Buffer.alloc(MIB);
  const paths: string[] = [];
  for (let index = 0; index < files; index += 1) {
    const path = join(directory, `photo-${String(index).padStart(4, "0")}.jpg`);
    paths.push(path);
    if (existsSync(path)) continue;
    const fd = openSync(path, "w");
    let left = each;
    let counter = index;
    while (left > 0) {
      chunk.fill(counter++ & 0xff);
      const take = Math.min(left, chunk.length);
      writeSync(fd, chunk, 0, take);
      left -= take;
    }
    closeSync(fd);
  }
  return paths;
}

async function heap(cdp: CDPSession): Promise<number> {
  const { metrics } = await cdp.send("Performance.getMetrics");
  return metrics.find((metric) => metric.name === "JSHeapUsedSize")?.value ?? 0;
}

test.describe("bulk browser benchmark", () => {
  const selected = (process.env.BULK_BROWSER_BENCH ?? "A").split(",");
  for (const workload of WORKLOADS.filter((entry) => selected.includes(entry.id))) {
    test(`workload ${workload.id}`, async ({ browser }) => {
      test.setTimeout(900_000);
      const paths = corpus(workload.id, workload.files, workload.bytes);
      const sender = await browser.newContext();
      const receiver = await browser.newContext();
      const signalling: string[] = [];
      for (const context of [sender, receiver]) {
        context.on("request", (request) => {
          if (request.url().includes("/api/bulk/")) signalling.push(request.method());
        });
      }
      const sending = await sender.newPage();
      const receiving = await receiver.newPage();
      const cdps = await Promise.all(
        [sending, receiving].map((page: Page) => page.context().newCDPSession(page)),
      );
      await Promise.all(cdps.map((cdp) => cdp.send("Performance.enable")));

      await sending.goto(
        `/bulk/send${process.env.BULK_FRAME ? `?frame=${process.env.BULK_FRAME}` : ""}`,
      );
      await sending.setInputFiles('[data-testid="bulk-file-input"]', paths);
      await sending.getByTestId("bulk-start").click();
      const share = sending.locator("[data-transfer-code]");
      await expect(share).toHaveAttribute("data-transfer-code", /^[0-9A-Z]{12}$/u);
      const code = (await share.getAttribute("data-transfer-code"))!;
      await receiving.goto(`/bulk/receive#c=${code}`);
      await expect(receiving.getByTestId("bulk-manifest-title")).toBeVisible({ timeout: 90_000 });

      let peakSender = 0;
      let peakReceiver = 0;
      const sampler = setInterval(() => {
        void heap(cdps[0]!)
          .then((value) => (peakSender = Math.max(peakSender, value)))
          .catch(() => undefined);
        void heap(cdps[1]!)
          .then((value) => (peakReceiver = Math.max(peakReceiver, value)))
          .catch(() => undefined);
      }, 500);
      const started = Date.now();
      await receiving.getByTestId("bulk-save-batch").click();
      // Large workloads fill a batch and pause; empty each batch as a visitor would.
      while (
        !((await receiving.getByTestId("bulk-receive-title").textContent()) ?? "").includes(
          "모두 받았어요",
        )
      ) {
        if (
          await receiving
            .getByTestId("bulk-batch-done")
            .isVisible()
            .catch(() => false)
        ) {
          receiving.once("dialog", (dialog) => void dialog.accept());
          await receiving.getByTestId("bulk-batch-done").click();
        }
        await receiving.waitForTimeout(250);
        if (process.env.BULK_BENCH_DEBUG && Math.floor((Date.now() - started) / 250) % 60 === 0) {
          console.log(
            "DEBUG",
            Math.round((Date.now() - started) / 1000),
            await receiving.getByTestId("bulk-receive-title").textContent(),
            await receiving.getByTestId("bulk-progress").getAttribute("data-percent"),
            await receiving.locator("[data-link-state]").first().getAttribute("data-link-state"),
            await sending
              .locator("[data-link-state]")
              .first()
              .getAttribute("data-link-state")
              .catch(() => "-"),
          );
        }
        if (Date.now() - started > 840_000) throw new Error("timed out");
      }
      const seconds = (Date.now() - started) / 1000;
      clearInterval(sampler);
      const counts = await receiving.getByTestId("bulk-counts").textContent();
      const failures = await receiving.evaluate(() => {
        const engine = (
          window as unknown as {
            __printCessBulkReceiver?: {
              fileState(i: number): number;
              failureReason(i: number): string | undefined;
              manifest: { files: { size: number }[] } | null;
            };
          }
        ).__printCessBulkReceiver;
        const out: string[] = [];
        engine?.manifest?.files.forEach((file, index) => {
          if (engine.fileState(index) === 5)
            out.push(`${index}:${engine.failureReason(index)}:${file.size}`);
        });
        return out;
      });
      const result = {
        workload: workload.id,
        frameBytes: Number(process.env.BULK_FRAME ?? 16384),
        files: workload.files,
        bytes: workload.bytes,
        seconds: Number(seconds.toFixed(1)),
        mibPerSecond: Number((workload.bytes / MIB / seconds).toFixed(1)),
        peakSenderJsHeapMiB: Number((peakSender / MIB).toFixed(1)),
        peakReceiverJsHeapMiB: Number((peakReceiver / MIB).toFixed(1)),
        signallingRequests: signalling.length,
        receiverCounts: counts,
        failures,
        browser: browser.version(),
      };
      console.log(JSON.stringify(result));
      const out = "../../artifacts/bulk-benchmark/browser.json";
      mkdirSync("../../artifacts/bulk-benchmark", { recursive: true });
      const previous = existsSync(out) ? (JSON.parse(readFileSync(out, "utf8")) as unknown[]) : [];
      writeFileSync(out, JSON.stringify([...previous, result], null, 2));
      await sender.close();
      await receiver.close();
    });
  }
});
