import type { BulkFileOutcome } from "@print-cess/protocol";

import type { BulkChannel } from "./channel";
import type { BulkFileSink, BulkSaveTarget, ReserveResult } from "./save-target";
import type { BulkSource } from "./types";

/**
 * Test and benchmark support. Nothing here is imported by product code.
 *
 * `createChannelPair` imitates an `RTCDataChannel` pair closely enough to
 * exercise the parts of the engine that matter: messages are delivered
 * asynchronously and in order, `bufferedAmount` rises on send and falls on
 * delivery, `bufferedamountlow` fires on the way down, messages above the
 * negotiated maximum are refused, and either end can be closed mid-transfer.
 */
export type PairOptions = {
  maxMessageSize?: number;
  /** Bytes delivered per tick, to imitate a link that is slower than the sender. */
  bytesPerTick?: number;
  /** Mutates a message in flight (to test corruption handling). */
  tamper?: (data: string | Uint8Array, index: number) => string | Uint8Array;
};

type Endpoint = Omit<BulkChannel, "bufferedAmount"> & {
  bufferedAmount: number;
  deliver(data: string | Uint8Array): void;
  shut(): void;
};

export function createChannelPair(options: PairOptions = {}): {
  a: BulkChannel;
  b: BulkChannel;
  close(): void;
  stats: { messages: number; bytes: number; peakBuffered: number };
} {
  const stats = { messages: 0, bytes: 0, peakBuffered: 0 };
  const maxMessageSize = options.maxMessageSize ?? 256 * 1024;
  let sentIndex = 0;

  const make = (): Endpoint => {
    const messageListeners = new Set<(data: string | Uint8Array) => void>();
    const lowListeners = new Set<() => void>();
    const closeListeners = new Set<() => void>();
    let open = true;
    const endpoint: Endpoint = {
      bufferedAmount: 0,
      bufferedAmountLowThreshold: 0,
      maxMessageSize,
      get isOpen() {
        return open;
      },
      send(data) {
        if (!open) throw new Error("InvalidStateError: channel closed");
        const size = typeof data === "string" ? data.length : data.byteLength;
        if (size > maxMessageSize) throw new TypeError("Message too large");
        // The browser copies on send; so do we, so the caller may reuse its buffer.
        const copy = typeof data === "string" ? data : data.slice();
        const index = sentIndex;
        sentIndex += 1;
        const delivered = options.tamper ? options.tamper(copy, index) : copy;
        endpoint.bufferedAmount += size;
        stats.messages += 1;
        stats.bytes += size;
        stats.peakBuffered = Math.max(stats.peakBuffered, endpoint.bufferedAmount);
        queue.push({ from: endpoint, data: delivered, size });
        schedule();
      },
      onMessage(listener) {
        messageListeners.add(listener);
        return () => messageListeners.delete(listener);
      },
      onBufferedAmountLow(listener) {
        lowListeners.add(listener);
        return () => lowListeners.delete(listener);
      },
      onClose(listener) {
        closeListeners.add(listener);
        return () => closeListeners.delete(listener);
      },
      close() {
        pair.close();
      },
      deliver(data) {
        if (!open) return;
        for (const listener of [...messageListeners]) listener(data);
      },
      shut() {
        if (!open) return;
        open = false;
        for (const listener of [...closeListeners]) listener();
      },
    };
    (endpoint as unknown as { lowListeners: Set<() => void> }).lowListeners = lowListeners;
    return endpoint;
  };

  const queue: { from: Endpoint; data: string | Uint8Array; size: number }[] = [];
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    // setImmediate where it exists: nested setTimeout(0) is clamped to 1 ms,
    // which would throttle the simulated link rather than the engine.
    const immediate = (globalThis as { setImmediate?: (callback: () => void) => unknown })
      .setImmediate;
    if (immediate) immediate(pump);
    else setTimeout(pump, 0);
  };
  const pump = () => {
    scheduled = false;
    let budget = options.bytesPerTick ?? Infinity;
    while (queue.length > 0 && budget > 0) {
      const item = queue.shift();
      if (!item) break;
      budget -= item.size;
      const before = item.from.bufferedAmount;
      item.from.bufferedAmount -= item.size;
      const to = item.from === a ? b : a;
      to.deliver(item.data);
      if (
        before > item.from.bufferedAmountLowThreshold &&
        item.from.bufferedAmount <= item.from.bufferedAmountLowThreshold
      ) {
        const listeners = (item.from as unknown as { lowListeners: Set<() => void> }).lowListeners;
        for (const listener of [...listeners]) listener();
      }
    }
    if (queue.length > 0) schedule();
  };

  const a = make();
  const b = make();
  const pair = {
    close() {
      queue.length = 0;
      a.bufferedAmount = 0;
      b.bufferedAmount = 0;
      a.shut();
      b.shut();
    },
  };
  return { a, b, close: pair.close, stats };
}

/**
 * Synthetic content: a fixed pseudo-random table read at a seed-dependent
 * rotation. Generating and checking bytes is then a native copy or compare,
 * so benchmarks measure the engine rather than a byte loop. The table length
 * is prime, so content does not repeat at block or chunk boundaries, and each
 * seed reads a different rotation, so two files mixed up are detected.
 */
const TABLE_LENGTH = 1_048_573;
const TABLE = (() => {
  const table = new Uint8Array(TABLE_LENGTH * 2);
  let state = 0x2545f491;
  for (let index = 0; index < TABLE_LENGTH; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    table[index] = state & 0xff;
  }
  table.copyWithin(TABLE_LENGTH, 0, TABLE_LENGTH);
  return table;
})();

export function syntheticByte(seed: number, offset: number): number {
  return TABLE[(offset + seed * 7919) % TABLE_LENGTH] ?? 0;
}

export function fillSynthetic(seed: number, offset: number, out: Uint8Array): void {
  let written = 0;
  while (written < out.byteLength) {
    const start = (offset + written + seed * 7919) % TABLE_LENGTH;
    const take = Math.min(out.byteLength - written, TABLE_LENGTH);
    out.set(TABLE.subarray(start, start + take), written);
    written += take;
  }
}

/** A file whose bytes are generated on demand, so a 15 GiB corpus never exists in memory. */
export function syntheticSource(name: string, size: number, seed: number, type = ""): BulkSource {
  return {
    name,
    size,
    type,
    slice(start, end) {
      return {
        async arrayBuffer() {
          const bounded = Math.max(0, Math.min(end, size) - start);
          const out = new Uint8Array(bounded);
          fillSynthetic(seed, start, out);
          return out.buffer;
        },
      };
    },
  };
}

/**
 * A destination that checks every byte against the generator as it arrives
 * and keeps none of them. It proves integrity end to end without holding a
 * file in memory, which is what lets the large workloads run at all.
 */
export class VerifyingTarget implements BulkSaveTarget {
  public readonly kind = "discard" as const;
  public readonly verified = new Map<number, number>();
  public readonly mismatches: number[] = [];
  public readonly aborted: number[] = [];
  public opened = 0;
  public writeDelayMs = 0;
  public budgetBytes = Infinity;
  public usedBytes = 0;
  public maxFileBytes = Infinity;
  public outcome: BulkFileOutcome = "saved";
  /** Fail the next write of this file once, to imitate a storage error. */
  public failWriteFor: number | null = null;
  /** Writes fail once this many bytes are held, imitating a real quota below the estimate. */
  public hardQuotaBytes = Infinity;
  /** Whether emptying the batch would help (a batch target with items). */
  public canFreeOnFailure = false;

  public handleWriteFailure(): boolean {
    return this.canFreeOnFailure && this.usedBytes > 0;
  }

  public constructor(private readonly seeds: (index: number) => number) {}

  public reserve(file: { size: number }): ReserveResult {
    if (file.size > this.maxFileBytes) return "too-large";
    if (this.usedBytes + file.size > this.budgetBytes && this.usedBytes > 0) return "full";
    return "ok";
  }

  public async open(file: { name: string; size: number }, index: number): Promise<BulkFileSink> {
    this.opened += 1;
    let offset = 0;
    const seed = this.seeds(index);
    const expected = new Uint8Array(256 * 1024);
    return {
      write: async (chunk) => {
        if (this.failWriteFor === index) {
          this.failWriteFor = null;
          throw new Error("disk full");
        }
        if (this.usedBytes + chunk.byteLength > this.hardQuotaBytes) {
          throw new DOMException("quota", "QuotaExceededError");
        }
        if (this.writeDelayMs > 0) await new Promise((r) => setTimeout(r, this.writeDelayMs));
        const view = expected.subarray(0, chunk.byteLength);
        fillSynthetic(seed, offset, view);
        if (!sameBytes(chunk, view)) this.mismatches.push(index);
        offset += chunk.byteLength;
        this.usedBytes += chunk.byteLength;
      },
      finish: async () => {
        if (offset !== file.size) {
          this.mismatches.push(index);
          throw new Error("size mismatch");
        }
        this.verified.set(index, offset);
        return this.outcome;
      },
      abort: async () => {
        this.aborted.push(index);
        this.usedBytes -= offset;
      },
    };
  }
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  const words = left.byteLength >>> 2;
  if (left.byteOffset % 4 === 0 && right.byteOffset % 4 === 0) {
    const a = new Uint32Array(left.buffer, left.byteOffset, words);
    const b = new Uint32Array(right.buffer, right.byteOffset, words);
    for (let index = 0; index < words; index += 1) if (a[index] !== b[index]) return false;
    for (let index = words * 4; index < left.byteLength; index += 1) {
      if (left[index] !== right[index]) return false;
    }
    return true;
  }
  for (let index = 0; index < left.byteLength; index += 1)
    if (left[index] !== right[index]) return false;
  return true;
}
