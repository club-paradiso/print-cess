import { beforeAll, describe, expect, it } from "vitest";

import { deriveBulkKeys, type BulkKeys } from "@print-cess/crypto";
import { BULK_BLOCK_BYTES, BULK_DATA_HEADER_BYTES, BULK_FRAME_BYTES } from "@print-cess/protocol";

import { BulkHandshakeError, runHandshake, sdpFingerprint } from "./handshake";
import { uniqueSafeNames } from "./names";
import { BulkReceiver } from "./receiver";
import { BulkSender } from "./sender";
import { createChannelPair, syntheticSource, VerifyingTarget, type PairOptions } from "./testing";
import { FILE_STATE, type BulkSource } from "./types";
import { AdaptiveWindow } from "./window";

let keys: BulkKeys;
let otherKeys: BulkKeys;

beforeAll(async () => {
  [keys, otherKeys] = await Promise.all([
    deriveBulkKeys("23456789ABCD"),
    deriveBulkKeys("ZYXWVTSRQPNM"),
  ]);
});

const FP = { senderFingerprint: "sha-256 AA", receiverFingerprint: "sha-256 BB" };

function corpus(sizes: number[]): BulkSource[] {
  return sizes.map((size, index) => syntheticSource(`file-${index}.bin`, size, index + 1));
}

function manifestOf(files: readonly BulkSource[]) {
  return files.map((file) => ({ name: file.name, size: file.size, type: file.type }));
}

async function connect(
  sender: BulkSender,
  receiver: BulkReceiver,
  options: PairOptions = {},
  generation = 1,
) {
  const pair = createChannelPair(options);
  const [hsA, hsB] = await Promise.all([
    runHandshake(pair.a, { keys, role: "sender", generation, ...FP }),
    runHandshake(pair.b, { keys, role: "receiver", generation, ...FP }),
  ]);
  const sending = sender.attach(pair.a, hsA);
  const receiving = receiver.attach(pair.b, hsB);
  return { pair, sending, receiving };
}

function untilFinished(receiver: BulkReceiver, timeoutMs = 20_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (receiver.snapshot().finished) resolve();
      else if (Date.now() - started > timeoutMs) reject(new Error("timed out"));
      else setTimeout(tick, 5);
    };
    tick();
  });
}

describe("handshake", () => {
  it("succeeds with the same code and fails with a different one", async () => {
    const pair = createChannelPair();
    await Promise.all([
      runHandshake(pair.a, { keys, role: "sender", generation: 1, ...FP }),
      runHandshake(pair.b, { keys, role: "receiver", generation: 1, ...FP }),
    ]);

    const bad = createChannelPair();
    const results = await Promise.allSettled([
      runHandshake(bad.a, { keys, role: "sender", generation: 1, ...FP, timeoutMs: 2000 }),
      runHandshake(bad.b, {
        keys: otherKeys,
        role: "receiver",
        generation: 1,
        ...FP,
        timeoutMs: 2000,
      }),
    ]);
    expect(results.every((result) => result.status === "rejected")).toBe(true);
    expect((results[0] as PromiseRejectedResult).reason).toBeInstanceOf(BulkHandshakeError);
  });

  it("fails when the two sides saw different certificate fingerprints", async () => {
    const pair = createChannelPair();
    const results = await Promise.allSettled([
      runHandshake(pair.a, { keys, role: "sender", generation: 1, ...FP, timeoutMs: 2000 }),
      runHandshake(pair.b, {
        keys,
        role: "receiver",
        generation: 1,
        senderFingerprint: "sha-256 EVIL",
        receiverFingerprint: FP.receiverFingerprint,
        timeoutMs: 2000,
      }),
    ]);
    expect(results.every((result) => result.status === "rejected")).toBe(true);
  });

  it("fails across generations, so an old proof cannot be replayed", async () => {
    const pair = createChannelPair();
    const results = await Promise.allSettled([
      runHandshake(pair.a, { keys, role: "sender", generation: 2, ...FP, timeoutMs: 2000 }),
      runHandshake(pair.b, { keys, role: "receiver", generation: 1, ...FP, timeoutMs: 2000 }),
    ]);
    expect(results.every((result) => result.status === "rejected")).toBe(true);
  });

  it("reads and normalizes an SDP fingerprint", () => {
    expect(sdpFingerprint("v=0\r\na=fingerprint:SHA-256 ab:cd:ef\r\n")).toBe("sha-256 AB:CD:EF");
    expect(sdpFingerprint("v=0\r\n")).toBeNull();
  });
});

describe("transfer engine", () => {
  it("moves mixed files byte-exactly, including empty files, and reports outcomes", async () => {
    const files = corpus([
      0,
      1,
      BULK_BLOCK_BYTES - 1,
      BULK_BLOCK_BYTES,
      BULK_BLOCK_BYTES + 1,
      3 * BULK_BLOCK_BYTES + 77,
    ]);
    const target = new VerifyingTarget((index) => index + 1);
    const sender = new BulkSender({ keys, files, manifest: manifestOf(files) });
    const receiver = new BulkReceiver({ keys, onManifest: () => receiver.start(target) });
    const { pair } = await connect(sender, receiver);
    await untilFinished(receiver);

    expect(target.mismatches).toEqual([]);
    expect(target.verified.size).toBe(files.length);
    const snapshot = receiver.snapshot();
    expect(snapshot.counts.saved).toBe(files.length);
    expect(snapshot.doneBytes).toBe(snapshot.totalBytes);
    // The sender learns outcomes only from the receiver's explicit reports.
    await new Promise((r) => setTimeout(r, 20));
    expect(sender.snapshot().counts.saved).toBe(files.length);
    expect(sender.snapshot().finished).toBe(true);
    expect(sender.snapshot().doneBytes).toBe(snapshot.totalBytes);
    pair.close();
  });

  it("never sends a data-channel message larger than the frame size", async () => {
    const files = corpus([2 * BULK_BLOCK_BYTES]);
    const target = new VerifyingTarget((index) => index + 1);
    const sender = new BulkSender({ keys, files, manifest: manifestOf(files) });
    const receiver = new BulkReceiver({ keys, onManifest: () => receiver.start(target) });
    // A channel that refuses anything above 16 KiB would throw on a larger send.
    const { pair } = await connect(sender, receiver, { maxMessageSize: BULK_FRAME_BYTES });
    await untilFinished(receiver);
    expect(target.mismatches).toEqual([]);
    pair.close();
  });

  it("honours a smaller negotiated maximum message size", async () => {
    const files = corpus([BULK_BLOCK_BYTES + 5]);
    const target = new VerifyingTarget((index) => index + 1);
    const sender = new BulkSender({ keys, files, manifest: manifestOf(files) });
    const receiver = new BulkReceiver({ keys, onManifest: () => receiver.start(target) });
    const { pair } = await connect(sender, receiver, { maxMessageSize: 4096 });
    await untilFinished(receiver);
    expect(target.mismatches).toEqual([]);
    pair.close();
  });

  it("keeps the send buffer bounded on a slow link", async () => {
    const files = corpus([24 * BULK_BLOCK_BYTES]);
    const target = new VerifyingTarget((index) => index + 1);
    const sender = new BulkSender({
      keys,
      files,
      manifest: manifestOf(files),
      highWaterBytes: 256 * 1024,
      lowWaterBytes: 64 * 1024,
    });
    const receiver = new BulkReceiver({ keys, onManifest: () => receiver.start(target) });
    const { pair } = await connect(sender, receiver, { bytesPerTick: 64 * 1024 });
    await untilFinished(receiver, 60_000);
    expect(target.mismatches).toEqual([]);
    // High-water plus at most one frame (and control traffic) may be queued.
    expect(pair.stats.peakBuffered).toBeLessThan(256 * 1024 + 2 * BULK_FRAME_BYTES);
    pair.close();
  });

  it("applies receiver backpressure: a slow disk caps blocks in flight at the window", async () => {
    const files = corpus([16 * BULK_BLOCK_BYTES]);
    const target = new VerifyingTarget((index) => index + 1);
    target.writeDelayMs = 5;
    const sender = new BulkSender({ keys, files, manifest: manifestOf(files) });
    const receiver = new BulkReceiver({
      keys,
      windowBlocks: 2,
      onManifest: () => receiver.start(target),
    });
    let peakOutstanding = 0;
    const sampler = setInterval(() => {
      peakOutstanding = Math.max(peakOutstanding, sender.outstandingBlocks);
    }, 1);
    const { pair } = await connect(sender, receiver);
    await untilFinished(receiver, 30_000);
    clearInterval(sampler);
    expect(target.mismatches).toEqual([]);
    expect(peakOutstanding).toBeGreaterThan(0);
    expect(peakOutstanding).toBeLessThanOrEqual(2);
    pair.close();
  });

  it("re-requests a corrupted block and still delivers the exact bytes", async () => {
    const files = corpus([3 * BULK_BLOCK_BYTES]);
    const target = new VerifyingTarget((index) => index + 1);
    const sender = new BulkSender({ keys, files, manifest: manifestOf(files) });
    const receiver = new BulkReceiver({ keys, onManifest: () => receiver.start(target) });
    let corrupted = 0;
    const { pair } = await connect(sender, receiver, {
      tamper: (data) => {
        if (
          typeof data !== "string" &&
          data.byteLength > BULK_DATA_HEADER_BYTES + 100 &&
          corrupted < 2
        ) {
          corrupted += 1;
          const copy = data.slice();
          copy[BULK_DATA_HEADER_BYTES + 50] = (copy[BULK_DATA_HEADER_BYTES + 50] ?? 0) ^ 0xff;
          return copy;
        }
        return data;
      },
    });
    await untilFinished(receiver);
    expect(corrupted).toBe(2);
    expect(target.mismatches).toEqual([]);
    expect(receiver.snapshot().counts.saved).toBe(1);
    pair.close();
  });

  it("fails a file that keeps arriving damaged, without failing the others", async () => {
    const files = corpus([BULK_BLOCK_BYTES, BULK_BLOCK_BYTES, BULK_BLOCK_BYTES]);
    const target = new VerifyingTarget((index) => index + 1);
    const sender = new BulkSender({ keys, files, manifest: manifestOf(files) });
    const receiver = new BulkReceiver({ keys, onManifest: () => receiver.start(target) });
    const { pair } = await connect(sender, receiver, {
      tamper: (data) => {
        if (typeof data !== "string" && data.byteLength > BULK_DATA_HEADER_BYTES) {
          const view = new DataView(data.buffer, data.byteOffset);
          if (view.getUint32(1) === 1) {
            const copy = data.slice();
            copy[copy.byteLength - 1] = (copy[copy.byteLength - 1] ?? 0) ^ 1;
            return copy;
          }
        }
        return data;
      },
    });
    await untilFinished(receiver);
    expect(receiver.fileState(0)).toBe(FILE_STATE.saved);
    expect(receiver.fileState(1)).toBe(FILE_STATE.failed);
    expect(receiver.failureReason(1)).toBe("damaged");
    expect(receiver.fileState(2)).toBe(FILE_STATE.saved);
    expect(target.aborted).toContain(1);
    await new Promise((r) => setTimeout(r, 20));
    expect(sender.fileState(1)).toBe(FILE_STATE.failed);
    pair.close();
  });

  it("resumes after a lost connection without re-sending written blocks", async () => {
    const files = corpus([10 * BULK_BLOCK_BYTES, 2 * BULK_BLOCK_BYTES]);
    const target = new VerifyingTarget((index) => index + 1);
    const sender = new BulkSender({ keys, files, manifest: manifestOf(files) });
    const receiver = new BulkReceiver({ keys, onManifest: () => receiver.start(target) });
    const first = await connect(sender, receiver);
    // Let part of the first file through, then cut the connection.
    await new Promise<void>((resolve) => {
      const tick = () => {
        if (receiver.snapshot().doneBytes >= 3 * BULK_BLOCK_BYTES) resolve();
        else setTimeout(tick, 1);
      };
      tick();
    });
    first.pair.close();
    expect(await first.sending).toBe("detached");
    expect(await first.receiving).toBe("detached");
    const writtenBefore = receiver.snapshot().doneBytes;

    const second = await connect(sender, receiver, {}, 2);
    let bytesOnSecond = 0;
    const counter = second.pair.stats;
    await untilFinished(receiver);
    bytesOnSecond = counter.bytes;
    expect(target.mismatches).toEqual([]);
    expect(target.opened).toBe(2); // the interrupted file's sink was kept, not reopened
    expect(receiver.snapshot().doneBytes).toBe(12 * BULK_BLOCK_BYTES);
    // The second connection carried roughly what was missing, not everything again.
    const missing = 12 * BULK_BLOCK_BYTES - writtenBefore;
    expect(bytesOnSecond).toBeLessThan(missing + 6 * BULK_BLOCK_BYTES);
    second.pair.close();
  });

  it("pauses and resumes from either side", async () => {
    const files = corpus([8 * BULK_BLOCK_BYTES]);
    const target = new VerifyingTarget((index) => index + 1);
    const sender = new BulkSender({ keys, files, manifest: manifestOf(files) });
    const receiver = new BulkReceiver({ keys, onManifest: () => receiver.start(target) });
    const { pair } = await connect(sender, receiver);
    await new Promise((r) => setTimeout(r, 5));
    receiver.pause();
    await new Promise((r) => setTimeout(r, 30));
    const paused = receiver.snapshot().doneBytes;
    expect(sender.snapshot().paused).toBe("remote");
    await new Promise((r) => setTimeout(r, 50));
    // Only what was already in flight may land while paused.
    expect(receiver.snapshot().doneBytes - paused).toBeLessThanOrEqual(16 * BULK_BLOCK_BYTES);
    receiver.resume();
    await untilFinished(receiver);
    expect(target.mismatches).toEqual([]);
    pair.close();
  });

  it("cancels cleanly: the active file is aborted and both sides stop", async () => {
    const files = corpus([40 * BULK_BLOCK_BYTES]);
    const target = new VerifyingTarget((index) => index + 1);
    target.writeDelayMs = 2;
    const sender = new BulkSender({ keys, files, manifest: manifestOf(files) });
    const receiver = new BulkReceiver({ keys, onManifest: () => receiver.start(target) });
    const { pair, sending, receiving } = await connect(sender, receiver);
    await new Promise((r) => setTimeout(r, 30));
    await receiver.cancel();
    expect(await sending).toBe("cancelled");
    expect(target.aborted).toContain(0);
    expect(receiver.snapshot().counts.saved).toBe(0);
    pair.close();
    await receiving;
  });

  it("pauses for a full batch, then continues once the batch is emptied", async () => {
    const files = corpus([BULK_BLOCK_BYTES, BULK_BLOCK_BYTES, BULK_BLOCK_BYTES, BULK_BLOCK_BYTES]);
    const target = new VerifyingTarget((index) => index + 1);
    target.outcome = "stored";
    target.budgetBytes = 2 * BULK_BLOCK_BYTES;
    let fullEvents = 0;
    const receiver = new BulkReceiver({
      keys,
      onManifest: () => receiver.start(target),
      onStorageFull: () => {
        fullEvents += 1;
        // The visitor saves the batch; the page empties it.
        setTimeout(() => {
          target.usedBytes = 0;
          receiver.storageFreed();
        }, 10);
      },
    });
    const sender = new BulkSender({ keys, files, manifest: manifestOf(files) });
    const { pair } = await connect(sender, receiver);
    await untilFinished(receiver);
    expect(fullEvents).toBe(1);
    expect(receiver.snapshot().counts.stored).toBe(4);
    await new Promise((r) => setTimeout(r, 20));
    // "Stored" is reported as stored, never as saved.
    expect(sender.snapshot().counts.stored).toBe(4);
    expect(sender.snapshot().counts.saved).toBe(0);
    pair.close();
  });

  it("treats a quota error mid-batch as a full batch, not a failed file", async () => {
    const files = corpus([BULK_BLOCK_BYTES, BULK_BLOCK_BYTES, BULK_BLOCK_BYTES, BULK_BLOCK_BYTES]);
    const target = new VerifyingTarget((index) => index + 1);
    target.outcome = "stored";
    // The browser claimed plenty of room but only 2.5 blocks fit.
    target.hardQuotaBytes = 2.5 * BULK_BLOCK_BYTES;
    target.canFreeOnFailure = true;
    let fullEvents = 0;
    const receiver = new BulkReceiver({
      keys,
      onManifest: () => receiver.start(target),
      onStorageFull: () => {
        fullEvents += 1;
        setTimeout(() => {
          target.usedBytes = 0;
          receiver.storageFreed();
        }, 10);
      },
    });
    const sender = new BulkSender({ keys, files, manifest: manifestOf(files) });
    const { pair } = await connect(sender, receiver);
    await untilFinished(receiver);
    expect(fullEvents).toBeGreaterThanOrEqual(1);
    expect(receiver.snapshot().counts.stored).toBe(4);
    expect(receiver.snapshot().counts.failed).toBe(0);
    expect(target.mismatches).toEqual([]);
    pair.close();
  });

  it("fails a file the destination cannot hold, and a storage write error, then retries", async () => {
    const files = corpus([BULK_BLOCK_BYTES, 5 * BULK_BLOCK_BYTES, BULK_BLOCK_BYTES]);
    const target = new VerifyingTarget((index) => index + 1);
    target.maxFileBytes = 4 * BULK_BLOCK_BYTES;
    target.failWriteFor = 2;
    const sender = new BulkSender({ keys, files, manifest: manifestOf(files) });
    const receiver = new BulkReceiver({ keys, onManifest: () => receiver.start(target) });
    const { pair } = await connect(sender, receiver);
    await untilFinished(receiver);
    expect(receiver.failureReason(1)).toBe("tooLarge");
    expect(receiver.failureReason(2)).toBe("storage");
    receiver.retryFailed();
    await untilFinished(receiver);
    expect(receiver.fileState(2)).toBe(FILE_STATE.saved);
    // A file that can never fit is not retried in a loop.
    expect(receiver.fileState(1)).toBe(FILE_STATE.failed);
    expect(target.mismatches).toEqual([]);
    pair.close();
  });

  it("reports an unreadable source file as failed and carries on", async () => {
    const good = syntheticSource("ok.bin", BULK_BLOCK_BYTES, 1);
    const broken: BulkSource = {
      name: "gone.jpg",
      size: BULK_BLOCK_BYTES,
      type: "image/jpeg",
      slice: () => ({ arrayBuffer: () => Promise.reject(new Error("NotReadableError")) }),
    };
    const third = syntheticSource("ok2.bin", 10, 3);
    const files = [good, broken, third];
    const target = new VerifyingTarget((index) => index + 1);
    const sender = new BulkSender({ keys, files, manifest: manifestOf(files) });
    const receiver = new BulkReceiver({ keys, onManifest: () => receiver.start(target) });
    const { pair } = await connect(sender, receiver);
    await untilFinished(receiver);
    expect(receiver.fileState(0)).toBe(FILE_STATE.saved);
    expect(receiver.failureReason(1)).toBe("unreadable");
    expect(receiver.fileState(2)).toBe(FILE_STATE.saved);
    pair.close();
  });

  it("handles a 3,000-file manifest with duplicate and hostile names", async () => {
    const files = Array.from({ length: 3000 }, (_, index) =>
      syntheticSource(
        index % 3 === 0
          ? "IMG_0001.JPG"
          : index % 3 === 1
            ? `../../etc/passwd-${index}`
            : `사진 ${index} 🎉.heic`,
        index % 50 === 0 ? 0 : 64,
        index + 1,
      ),
    );
    const target = new VerifyingTarget((index) => index + 1);
    let manifestNames: string[] = [];
    const sender = new BulkSender({ keys, files, manifest: manifestOf(files) });
    const receiver = new BulkReceiver({
      keys,
      onManifest: (manifest) => {
        manifestNames = manifest.files.map((file) => file.name);
        receiver.start(target);
      },
    });
    const { pair } = await connect(sender, receiver);
    await untilFinished(receiver, 60_000);
    expect(manifestNames).toHaveLength(3000);
    expect(new Set(manifestNames.map((name) => name.toLowerCase())).size).toBe(3000);
    expect(manifestNames.some((name) => name.includes("/") || name.includes("\\"))).toBe(false);
    expect(target.verified.size).toBe(3000);
    expect(target.mismatches).toEqual([]);
    pair.close();
  }, 60_000);

  it("rejects a manifest sealed with a different code", async () => {
    const files = corpus([10]);
    const sender = new BulkSender({ keys: otherKeys, files, manifest: manifestOf(files) });
    const receiver = new BulkReceiver({ keys });
    const pair = createChannelPair();
    const [hsA, hsB] = await Promise.all([
      runHandshake(pair.a, { keys, role: "sender", generation: 1, ...FP }),
      runHandshake(pair.b, { keys, role: "receiver", generation: 1, ...FP }),
    ]);
    void sender.attach(pair.a, hsA);
    expect(await receiver.attach(pair.b, hsB)).toBe("rejected");
    expect(receiver.manifest).toBeNull();
  });
});

describe("helpers", () => {
  it("names stay unique and linear for thousands of duplicates", () => {
    const names = uniqueSafeNames(Array.from({ length: 3000 }, () => "a.jpg"));
    expect(new Set(names).size).toBe(3000);
    expect(names[1]).toBe("a (2).jpg");
    expect(uniqueSafeNames(["A.JPG", "a.jpg"])).toEqual(["A.JPG", "a (2).jpg"]);
  });

  it("grows the window on prompt acks and halves it on a stall", () => {
    const window = new AdaptiveWindow(4, 8);
    for (let i = 0; i < 4; i += 1) window.onAck();
    expect(window.size).toBe(5);
    window.onStall();
    expect(window.size).toBe(2);
    window.setCeiling(1);
    expect(window.size).toBe(2);
  });
});
