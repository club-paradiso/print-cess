import { mkdirSync, writeFileSync } from "node:fs";

import { describe, it } from "vitest";

import { deriveBulkKeys } from "@print-cess/crypto";

import { runHandshake } from "@/lib/bulk/handshake";
import { BulkReceiver } from "@/lib/bulk/receiver";
import { BulkSender } from "@/lib/bulk/sender";
import { createChannelPair, syntheticSource, VerifyingTarget } from "@/lib/bulk/testing";

/**
 * Synthetic workload benchmark for the transfer engine, run with
 * `pnpm --filter @print-cess/web benchmark:bulk` (optionally
 * BULK_BENCH=A,B,C,D). It measures the engine — framing, AES-GCM, window and
 * backpressure, per-file overhead, and memory — over an in-memory channel pair.
 * It does not measure a radio, WebRTC's SCTP stack, or a phone's storage, and
 * its numbers must never be reported as device results.
 *
 * Data is generated on demand and verified byte by byte on arrival, so a
 * 15 GiB workload never exists in memory.
 */

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

type Workload = { id: string; files: number; totalBytes: number };
const WORKLOADS: Workload[] = [
  { id: "A", files: 20, totalBytes: 100 * MIB },
  { id: "B", files: 300, totalBytes: 1 * GIB },
  { id: "C", files: 1000, totalBytes: 5 * GIB },
  { id: "D", files: 3000, totalBytes: 15 * GIB },
];

/**
 * A phone-like mix: 1% large videos holding 40% of the bytes, 0.5% empty
 * files, and photos of jittered size for the rest. The last photo absorbs
 * rounding so the total is exact.
 */
function sizesFor(workload: Workload): number[] {
  const videos = Math.max(1, Math.floor(workload.files / 100));
  const empties = Math.max(1, Math.floor(workload.files / 200));
  const photos = workload.files - videos - empties;
  const videoBytes = Math.floor((workload.totalBytes * 0.4) / videos);
  const photoBudget = workload.totalBytes - videoBytes * videos;
  const step = Math.floor(workload.files / videos);
  const kinds: ("video" | "empty" | "photo")[] = Array.from(
    { length: workload.files },
    () => "photo",
  );
  for (let v = 0; v < videos; v += 1) kinds[v * step + step - 1] = "video";
  let placed = 0;
  for (let index = 3; index < workload.files && placed < empties; index += 197) {
    if (kinds[index] === "photo") {
      kinds[index] = "empty";
      placed += 1;
    }
  }
  const weights = kinds.map((kind, index) =>
    kind === "photo" ? 0.75 + ((index * 37) % 50) / 100 : 0,
  );
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const sizes = kinds.map((kind, index) =>
    kind === "video"
      ? videoBytes
      : kind === "empty"
        ? 0
        : Math.floor((photoBudget * (weights[index] ?? 0)) / weightSum),
  );
  const lastPhoto = kinds.lastIndexOf("photo");
  sizes[lastPhoto] =
    (sizes[lastPhoto] ?? 0) + workload.totalBytes - sizes.reduce((sum, size) => sum + size, 0);
  void photos;
  return sizes;
}

const NAMES = [
  "IMG_%.HEIC",
  "IMG_%.JPG",
  "photo %.png",
  "영상 %.mov",
  "clip_%.mp4",
  "문서 %.hwpx",
  "%.pdf",
  "%.hwp",
];

describe("bulk engine benchmark", () => {
  const selected = (process.env.BULK_BENCH ?? "A,B").split(",");
  const results: Record<string, unknown>[] = [];

  for (const workload of WORKLOADS.filter((entry) => selected.includes(entry.id))) {
    it(`workload ${workload.id}`, async () => {
      const keys = await deriveBulkKeys("23456789ABCD");
      const sizes = sizesFor(workload);
      const totalBytes = sizes.reduce((sum, size) => sum + size, 0);
      const files = sizes.map((size, index) =>
        syntheticSource(
          (NAMES[index % NAMES.length] ?? "%").replaceAll("%", String(index % 997)),
          size,
          index + 1,
        ),
      );
      const manifest = files.map((file) => ({ name: file.name, size: file.size, type: "" }));
      const target = new VerifyingTarget((index) => index + 1);
      const sender = new BulkSender({ keys, files, manifest });
      const receiver = new BulkReceiver({ keys, onManifest: () => receiver.start(target) });
      const pair = createChannelPair({ maxMessageSize: 16 * 1024 });

      global.gc?.();
      const baseline = process.memoryUsage();
      let peakHeap = baseline.heapUsed;
      let peakRss = baseline.rss;
      let peakExternal = baseline.external + baseline.arrayBuffers;
      // Live memory: sampled right after a forced collection every second, so
      // garbage the collector has not reached yet does not count as retained.
      let liveExternal = 0;
      const liveSampler = setInterval(() => {
        global.gc?.();
        const usage = process.memoryUsage();
        liveExternal = Math.max(liveExternal, usage.arrayBuffers - baseline.arrayBuffers);
      }, 1000);
      const sampler = setInterval(() => {
        const usage = process.memoryUsage();
        peakHeap = Math.max(peakHeap, usage.heapUsed);
        peakRss = Math.max(peakRss, usage.rss);
        peakExternal = Math.max(peakExternal, usage.external + usage.arrayBuffers);
      }, 50);
      const cpuStart = process.cpuUsage();
      const started = performance.now();
      // Event-loop responsiveness: the longest gap between 20 ms timers.
      let lastTick = performance.now();
      let worstLag = 0;
      const lag = setInterval(() => {
        const now = performance.now();
        worstLag = Math.max(worstLag, now - lastTick - 20);
        lastTick = now;
      }, 20);

      const [hsA, hsB] = await Promise.all([
        runHandshake(pair.a, {
          keys,
          role: "sender",
          generation: 1,
          senderFingerprint: "a",
          receiverFingerprint: "b",
        }),
        runHandshake(pair.b, {
          keys,
          role: "receiver",
          generation: 1,
          senderFingerprint: "a",
          receiverFingerprint: "b",
        }),
      ]);
      void sender.attach(pair.a, hsA);
      void receiver.attach(pair.b, hsB);
      await new Promise<void>((resolve, reject) => {
        const check = setInterval(() => {
          if (receiver.snapshot().finished) {
            clearInterval(check);
            resolve();
          }
          if (target.mismatches.length > 0) {
            clearInterval(check);
            reject(new Error("integrity mismatch"));
          }
        }, 25);
      });
      const seconds = (performance.now() - started) / 1000;
      const cpu = process.cpuUsage(cpuStart);
      clearInterval(sampler);
      clearInterval(liveSampler);
      clearInterval(lag);
      pair.close();
      // What is still held once the transfer is over: a leak would show here.
      for (let round = 0; round < 3; round += 1) {
        global.gc?.();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const after = process.memoryUsage();

      const result = {
        workload: workload.id,
        files: workload.files,
        totalBytes,
        seconds: Number(seconds.toFixed(2)),
        mibPerSecond: Number((totalBytes / MIB / seconds).toFixed(1)),
        msPerFile: Number(((seconds * 1000) / workload.files).toFixed(2)),
        messages: pair.stats.messages,
        wireBytes: pair.stats.bytes,
        wireOverheadPercent: Number(
          (((pair.stats.bytes - totalBytes) / Math.max(1, totalBytes)) * 100).toFixed(3),
        ),
        peakBufferedBytes: pair.stats.peakBuffered,
        peakHeapDeltaMiB: Number(((peakHeap - baseline.heapUsed) / MIB).toFixed(1)),
        liveArrayBufferPeakMiB: Number((liveExternal / MIB).toFixed(1)),
        retainedAfterArrayBufferMiB: Number(
          ((after.arrayBuffers - baseline.arrayBuffers) / MIB).toFixed(1),
        ),
        retainedAfterHeapMiB: Number(((after.heapUsed - baseline.heapUsed) / MIB).toFixed(1)),
        peakArrayBufferDeltaMiB: Number(
          ((peakExternal - baseline.external - baseline.arrayBuffers) / MIB).toFixed(1),
        ),
        peakRssMiB: Number((peakRss / MIB).toFixed(0)),
        cpuUserSeconds: Number((cpu.user / 1e6).toFixed(1)),
        cpuSystemSeconds: Number((cpu.system / 1e6).toFixed(1)),
        worstEventLoopLagMs: Number(worstLag.toFixed(0)),
        verifiedFiles: target.verified.size,
        integrityMismatches: target.mismatches.length,
        savedCount: receiver.snapshot().counts.saved,
      };
      results.push(result);
      console.log(JSON.stringify(result));
      if (target.verified.size !== workload.files) throw new Error("not every file verified");
      mkdirSync("../../artifacts/bulk-benchmark", { recursive: true });
      writeFileSync(
        "../../artifacts/bulk-benchmark/results.json",
        JSON.stringify({ environment: environment(), results }, null, 2),
      );
    }, 3_600_000);
  }
});

function environment() {
  return {
    note: "Synthetic engine benchmark over an in-memory channel pair. Not a device or network measurement.",
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    date: new Date().toISOString(),
  };
}
