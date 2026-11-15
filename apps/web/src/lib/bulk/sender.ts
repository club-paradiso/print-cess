import {
  deriveBulkFileKey,
  sealBulkBlock,
  sealBulkManifestPage,
  type BulkKeys,
} from "@print-cess/crypto";
import {
  BULK_BLOCK_BYTES,
  BULK_FRAME_BYTES,
  BULK_MANIFEST_PAGE_FILES,
  BULK_MIN_FRAME_BYTES,
  BULK_PROTOCOL_VERSION,
  BULK_DATA_HEADER_BYTES,
  bulkBlockCount,
  bulkBlockPlaintextBytes,
  bulkFragmentCount,
  encodeBulkDataFrame,
  parseBulkControl,
  type BulkControl,
  type BulkManifestFile,
} from "@print-cess/protocol";

import { ChannelClosedError, waitForDrain, type BulkChannel } from "./channel";
import type { HandshakeResult } from "./handshake";
import { Notifier } from "./notifier";
import {
  FILE_STATE,
  countStates,
  outcomeCode,
  type BulkSource,
  type PauseReason,
  type TransferSnapshot,
} from "./types";
import { AdaptiveWindow } from "./window";

export type SenderOptions = {
  keys: BulkKeys;
  files: readonly BulkSource[];
  /** The sanitized names and sizes the receiver will see, index-aligned with `files`. */
  manifest: readonly BulkManifestFile[];
  frameBytes?: number;
  /** Send-buffer high-water mark. Above it, the sender waits for a drain event. */
  highWaterBytes?: number;
  lowWaterBytes?: number;
  /** No acknowledgement for this long halves the window. */
  stallMs?: number;
  /** No acknowledgement for this long declares the channel dead, which triggers a reconnect. */
  deadMs?: number;
  onUpdate?: (snapshot: TransferSnapshot) => void;
};

export type AttachOutcome = "detached" | "cancelled";

type Want = { file: number; from: number };

/**
 * Streams files to whichever receiver has proved it holds the transfer code.
 *
 * The receiver pulls: it asks for a file from a given block, and acknowledges
 * each block only once that block is written to its destination. The sender
 * never has more than a window of unacknowledged blocks outstanding and never
 * queues more than a high-water mark into the channel, so its memory use is a
 * few megabytes whether it is sending twenty files or three thousand.
 *
 * State survives a lost channel. `attach` can be called again with a new
 * channel after a reconnect; the receiver then asks for exactly what it is
 * missing, and nothing already written is sent twice.
 */
export class BulkSender {
  readonly #options: SenderOptions;
  readonly #states: Uint8Array;
  /** Per file, the number of leading blocks acknowledged. */
  readonly #ackedBlocks: Uint32Array;
  readonly #fileKeys = new Map<number, Promise<CryptoKey>>();
  readonly #totalBytes: number;
  readonly #window = new AdaptiveWindow();
  readonly #wake = new Notifier();
  #doneBytes = 0;
  #wants: Want[] = [];
  /** Blocks sent and not yet acknowledged, keyed `file:block`, valued with send time. */
  #outstanding = new Map<string, number>();
  #current: { file: number; next: number } | null = null;
  #localPause = false;
  #remotePause = false;
  #finished = false;
  #cancelled = false;
  #lastUpdate = 0;

  public constructor(options: SenderOptions) {
    if (options.files.length !== options.manifest.length || options.files.length === 0) {
      throw new Error("The manifest must describe every file");
    }
    this.#options = options;
    this.#states = new Uint8Array(options.files.length);
    this.#ackedBlocks = new Uint32Array(options.files.length);
    this.#totalBytes = options.manifest.reduce((sum, file) => sum + file.size, 0);
  }

  public snapshot(): TransferSnapshot {
    return {
      fileCount: this.#states.length,
      totalBytes: this.#totalBytes,
      doneBytes: this.#doneBytes,
      counts: countStates(this.#states),
      currentFile: this.#current?.file ?? null,
      paused: this.#pauseReason(),
      finished: this.#finished,
    };
  }

  /** Blocks sent and not yet acknowledged. Bounded by the window. */
  public get outstandingBlocks(): number {
    return this.#outstanding.size;
  }

  public fileState(index: number): number {
    return this.#states[index] ?? FILE_STATE.pending;
  }

  public pause(): void {
    this.#localPause = true;
    this.#broadcast?.({ t: "pause" });
    this.#emit(true);
  }

  public resume(): void {
    this.#localPause = false;
    this.#broadcast?.({ t: "resume" });
    this.#wake.notify();
    this.#emit(true);
  }

  public cancel(): void {
    this.#cancelled = true;
    this.#broadcast?.({ t: "cancel", reason: "user" });
    this.#wake.notify();
  }

  #broadcast: ((message: BulkControl) => void) | null = null;

  /**
   * Serves one channel until it closes or the transfer is cancelled. Resolves
   * rather than rejects on a closed channel: losing a connection is an
   * expected event that the caller answers by reconnecting.
   */
  public async attach(channel: BulkChannel, handshake: HandshakeResult): Promise<AttachOutcome> {
    const frameBytes = Math.max(
      BULK_MIN_FRAME_BYTES,
      Math.min(this.#options.frameBytes ?? BULK_FRAME_BYTES, channel.maxMessageSize),
    );
    const highWater = this.#options.highWaterBytes ?? 2 * 1024 * 1024;
    channel.bufferedAmountLowThreshold = this.#options.lowWaterBytes ?? 512 * 1024;
    const controller = new AbortController();
    let closed = false;

    // A new channel starts clean: the receiver re-requests what it lacks.
    this.#wants = [];
    this.#outstanding.clear();
    this.#current = null;
    this.#remotePause = false;

    const send = (message: BulkControl) => {
      if (!closed && channel.isOpen) channel.send(JSON.stringify(message));
    };
    this.#broadcast = send;

    let resolveCancelled: (() => void) | null = null;
    const cancelled = new Promise<void>((resolve) => {
      resolveCancelled = resolve;
    });

    const offClose = channel.onClose(() => {
      closed = true;
      controller.abort();
      this.#wake.notify();
    });
    const release = handshake.takeOver((data) => {
      if (typeof data !== "string") return; // The receiver never sends binary.
      const message = parseBulkControl(data);
      if (!message) {
        channel.close();
        return;
      }
      if (message.t === "cancel") {
        this.#cancelled = true;
        resolveCancelled?.();
      }
      this.#onControl(message);
    });

    const stallTimer = setInterval(() => this.#checkStall(channel), 1000);
    try {
      await this.#sendManifest(channel, controller.signal, highWater);
      const pump = this.#pump(channel, frameBytes, highWater, controller.signal);
      await Promise.race([pump, cancelled]);
      if (this.#cancelled) {
        send({ t: "cancel", reason: "user" });
        return "cancelled";
      }
      return "detached";
    } catch (error) {
      if (error instanceof ChannelClosedError) return this.#cancelled ? "cancelled" : "detached";
      throw error;
    } finally {
      clearInterval(stallTimer);
      controller.abort();
      offClose();
      release();
      this.#broadcast = null;
    }
  }

  async #sendManifest(channel: BulkChannel, signal: AbortSignal, highWater: number) {
    const { keys, manifest } = this.#options;
    const pages = Math.ceil(manifest.length / BULK_MANIFEST_PAGE_FILES);
    for (let page = 0; page < pages; page += 1) {
      const first = page * BULK_MANIFEST_PAGE_FILES;
      const sealed = await sealBulkManifestPage(keys, page, pages, manifest.length, {
        v: BULK_PROTOCOL_VERSION,
        first,
        files: manifest.slice(first, first + BULK_MANIFEST_PAGE_FILES),
      });
      if (channel.bufferedAmount > highWater) await waitForDrain(channel, signal);
      if (!channel.isOpen) throw new ChannelClosedError();
      channel.send(
        JSON.stringify({
          t: "manifest",
          page,
          pages,
          fileCount: manifest.length,
          totalBytes: this.#totalBytes,
          sealed,
        }),
      );
    }
  }

  #onControl(message: BulkControl): void {
    switch (message.t) {
      case "want": {
        if (message.file >= this.#states.length) return;
        const blockCount = bulkBlockCount(this.#options.manifest[message.file]?.size ?? 0);
        if (message.from >= blockCount) return;
        if (this.#current?.file === message.file) {
          // A re-request for the file in flight: rewind and forget what was outstanding.
          this.#current.next = message.from;
          for (const key of [...this.#outstanding.keys()]) {
            const [file, block] = key.split(":").map(Number);
            if (file === message.file && (block ?? 0) >= message.from)
              this.#outstanding.delete(key);
          }
        } else {
          this.#wants = this.#wants.filter((want) => want.file !== message.file);
          this.#wants.push({ file: message.file, from: message.from });
        }
        this.#wake.notify();
        return;
      }
      case "ack": {
        const key = `${message.file}:${message.block}`;
        const sentAt = this.#outstanding.get(key);
        if (sentAt !== undefined) {
          this.#outstanding.delete(key);
          if (Date.now() - sentAt < (this.#options.stallMs ?? 8000)) this.#window.onAck();
        }
        if (
          message.file < this.#ackedBlocks.length &&
          message.block === this.#ackedBlocks[message.file]
        ) {
          this.#ackedBlocks[message.file] = message.block + 1;
          const size = this.#options.manifest[message.file]?.size ?? 0;
          this.#doneBytes += bulkBlockPlaintextBytes(size, message.block);
        }
        this.#wake.notify();
        this.#emit();
        return;
      }
      case "done":
        if (message.file < this.#states.length) {
          this.#states[message.file] = outcomeCode(message.outcome);
          if (message.outcome === "failed") {
            // A failed file can be retried; its acknowledged bytes no longer count.
            const size = this.#options.manifest[message.file]?.size ?? 0;
            const acked = this.#ackedBlocks[message.file] ?? 0;
            for (let block = 0; block < acked; block += 1) {
              this.#doneBytes -= bulkBlockPlaintextBytes(size, block);
            }
            this.#ackedBlocks[message.file] = 0;
          }
        }
        this.#emit(true);
        return;
      case "window":
        this.#window.setCeiling(message.blocks);
        this.#wake.notify();
        return;
      case "pause":
        this.#remotePause = true;
        this.#emit(true);
        return;
      case "resume":
        this.#remotePause = false;
        this.#wake.notify();
        this.#emit(true);
        return;
      case "finished":
        this.#finished = true;
        this.#emit(true);
        return;
      default:
        return;
    }
  }

  async #pump(channel: BulkChannel, frameBytes: number, highWater: number, signal: AbortSignal) {
    const { manifest } = this.#options;
    while (!signal.aborted && !this.#cancelled) {
      if (!this.#current) {
        const want = this.#wants.shift();
        if (!want) {
          await this.#wake.wait(1000);
          continue;
        }
        this.#current = { file: want.file, next: want.from };
        if (want.from === 0) {
          this.#ackedBlocks[want.file] = 0;
        }
        this.#states[want.file] = FILE_STATE.active;
        this.#emit(true);
      }
      const current = this.#current;
      const entry = manifest[current.file];
      const source = this.#options.files[current.file];
      if (!entry || !source) {
        this.#current = null;
        continue;
      }
      const blockCount = bulkBlockCount(entry.size);
      if (current.next >= blockCount) {
        // Every block is on the wire; the outcome arrives as a `done` message.
        this.#current = null;
        continue;
      }
      if (this.#pauseReason() || this.#outstanding.size >= this.#window.size) {
        await this.#wake.wait(1000);
        continue;
      }

      const block = current.next;
      const sealed = await this.#sealedBlock(current.file, block);
      if (sealed === "unreadable") {
        // The file changed or vanished under us (a photo library revoking access).
        this.#markUnreadable(current.file);
        continue;
      }
      // Read and seal the next block while this one is on the wire.
      if (block + 1 < blockCount) void this.#sealedBlock(current.file, block + 1, true);
      // The file may have been rewound while sealing; only send what is still wanted.
      if (this.#current !== current || current.next !== block) continue;

      const fragments = bulkFragmentCount(sealed.byteLength, frameBytes);
      const payloadBytes = frameBytes - BULK_DATA_HEADER_BYTES;
      for (let fragment = 0; fragment < fragments; fragment += 1) {
        if (this.#cancelled) return;
        if (channel.bufferedAmount > highWater) await waitForDrain(channel, signal);
        if (!channel.isOpen) throw new ChannelClosedError();
        channel.send(
          encodeBulkDataFrame({
            file: current.file,
            block,
            fragment,
            fragments,
            payload: sealed.subarray(fragment * payloadBytes, (fragment + 1) * payloadBytes),
          }),
        );
      }
      this.#outstanding.set(`${current.file}:${block}`, Date.now());
      current.next = block + 1;
    }
  }

  #prefetch: { file: number; block: number; result: Promise<Uint8Array | "unreadable"> } | null =
    null;

  /**
   * One block, read from the source and sealed. With `prefetch`, the result is
   * kept for the next call, so reading the next block from disk and sealing it
   * overlaps with sending this one. At most one extra block is held.
   */
  #sealedBlock(file: number, block: number, prefetch = false): Promise<Uint8Array | "unreadable"> {
    const cached = this.#prefetch;
    if (cached && cached.file === file && cached.block === block) {
      if (!prefetch) this.#prefetch = null;
      return cached.result;
    }
    const result = this.#readAndSeal(file, block);
    if (prefetch) this.#prefetch = { file, block, result };
    return result;
  }

  async #readAndSeal(file: number, block: number): Promise<Uint8Array | "unreadable"> {
    const { manifest, keys } = this.#options;
    const entry = manifest[file];
    const source = this.#options.files[file];
    if (!entry || !source) return "unreadable";
    const blockCount = bulkBlockCount(entry.size);
    const length = bulkBlockPlaintextBytes(entry.size, block);
    let plaintext: Uint8Array;
    try {
      const start = block * BULK_BLOCK_BYTES;
      plaintext =
        length === 0
          ? new Uint8Array(0)
          : new Uint8Array(await source.slice(start, start + length).arrayBuffer());
    } catch {
      return "unreadable";
    }
    if (plaintext.byteLength !== length) return "unreadable";
    const fileKey = await this.#fileKey(keys, file);
    const sealed = await sealBulkBlock(fileKey, keys, { file, block, blockCount }, plaintext);
    plaintext.fill(0);
    return sealed;
  }

  #markUnreadable(file: number): void {
    this.#states[file] = FILE_STATE.failed;
    this.#broadcast?.({ t: "unreadable", file });
    for (const key of [...this.#outstanding.keys()]) {
      if (key.startsWith(`${file}:`)) this.#outstanding.delete(key);
    }
    this.#current = null;
    this.#emit(true);
  }

  #checkStall(channel: BulkChannel): void {
    if (this.#outstanding.size === 0 || this.#pauseReason()) return;
    let oldest = Infinity;
    for (const sentAt of this.#outstanding.values()) oldest = Math.min(oldest, sentAt);
    const age = Date.now() - oldest;
    if (age > (this.#options.deadMs ?? 45_000)) {
      channel.close();
      return;
    }
    if (age > (this.#options.stallMs ?? 8000)) this.#window.onStall();
  }

  #fileKey(keys: BulkKeys, file: number): Promise<CryptoKey> {
    let key = this.#fileKeys.get(file);
    if (!key) {
      key = deriveBulkFileKey(keys, file);
      this.#fileKeys.set(file, key);
      // Keys are cheap to re-derive; holding thousands is not worth it.
      if (this.#fileKeys.size > 8) {
        const oldest = this.#fileKeys.keys().next().value;
        if (oldest !== undefined && oldest !== file) this.#fileKeys.delete(oldest);
      }
    }
    return key;
  }

  #pauseReason(): PauseReason | null {
    if (this.#localPause) return "local";
    if (this.#remotePause) return "remote";
    return null;
  }

  #emit(force = false): void {
    const now = Date.now();
    if (!force && now - this.#lastUpdate < 150) return;
    this.#lastUpdate = now;
    this.#options.onUpdate?.(this.snapshot());
  }
}
