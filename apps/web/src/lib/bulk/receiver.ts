import {
  deriveBulkFileKey,
  openBulkBlock,
  openBulkManifestPage,
  type BulkKeys,
} from "@print-cess/crypto";
import {
  BULK_FRAME_BYTES,
  BULK_MANIFEST_PAGE_FILES,
  BULK_MAX_FILES,
  BULK_MAX_SEALED_BLOCK_BYTES,
  BULK_MAX_TOTAL_BYTES,
  bulkBlockCount,
  bulkBlockPlaintextBytes,
  bulkManifestPageSchema,
  decodeBulkDataFrame,
  parseBulkControl,
  type BulkControl,
  type BulkFileOutcome,
  type BulkManifestFile,
} from "@print-cess/protocol";

import type { BulkChannel } from "./channel";
import type { HandshakeResult } from "./handshake";
import { safeMediaType, uniqueSafeNames } from "./names";
import type { BulkFileSink, BulkSaveTarget } from "./save-target";
import {
  FILE_STATE,
  countStates,
  outcomeCode,
  type PauseReason,
  type TransferSnapshot,
} from "./types";

export type ReceivedManifest = {
  files: BulkManifestFile[];
  totalBytes: number;
};

export type FailureReason = "damaged" | "unreadable" | "tooLarge" | "storage";

export type ReceiverOptions = {
  keys: BulkKeys;
  /** Blocks the receiver is willing to hold unacknowledged. Fewer on small devices. */
  windowBlocks?: number;
  onManifest?: (manifest: ReceivedManifest) => void;
  onUpdate?: (snapshot: TransferSnapshot) => void;
  /** The current batch is full: the visitor must save it before more can arrive. */
  onStorageFull?: () => void;
};

export type ReceiverAttachOutcome = "detached" | "cancelled" | "rejected";

const MAX_BLOCK_RETRIES = 3;

type Active = {
  file: number;
  blockCount: number;
  size: number;
  sink: BulkFileSink;
  nextBlock: number;
  retries: number;
};

/**
 * Pulls files one at a time, decrypts and authenticates every block, writes it
 * to the chosen destination, and only then acknowledges it. Acknowledging
 * after the write is what turns a slow disk or a full batch into backpressure
 * on the sending phone rather than into memory growth on this one.
 *
 * Every file ends with an explicit outcome: written to a folder, held in the
 * browser for the visitor to save, handed to a download, or failed with a
 * reason. Nothing is reported as received before its destination says so.
 */
export class BulkReceiver {
  readonly #options: ReceiverOptions;
  #manifest: ReceivedManifest | null = null;
  #pages: (BulkManifestFile[] | null)[] = [];
  #pageMeta: { pages: number; fileCount: number; totalBytes: number } | null = null;
  #states = new Uint8Array(0);
  #failures = new Map<number, FailureReason>();
  #target: BulkSaveTarget | null = null;
  #queue: number[] = [];
  #active: Active | null = null;
  #assembly = new Uint8Array(BULK_MAX_SEALED_BLOCK_BYTES);
  #assembled = 0;
  #nextFragment = 0;
  #fragments = 0;
  #doneBytes = 0;
  #localPause = false;
  #remotePause = false;
  #storageFull = false;
  #cancelled = false;
  #finishedSent = false;
  #send: ((message: BulkControl) => void) | null = null;
  #chain: Promise<void> = Promise.resolve();
  #lastUpdate = 0;
  #fileKey: { file: number; key: Promise<CryptoKey> } | null = null;

  public constructor(options: ReceiverOptions) {
    this.#options = options;
  }

  public get manifest(): ReceivedManifest | null {
    return this.#manifest;
  }

  public fileState(index: number): number {
    return this.#states[index] ?? FILE_STATE.pending;
  }

  public failureReason(index: number): FailureReason | undefined {
    return this.#failures.get(index);
  }

  public snapshot(): TransferSnapshot {
    return {
      fileCount: this.#states.length,
      totalBytes: this.#manifest?.totalBytes ?? 0,
      doneBytes: this.#doneBytes,
      counts: countStates(this.#states),
      currentFile: this.#active?.file ?? null,
      paused: this.#pauseReason(),
      finished: this.#finishedSent,
    };
  }

  /** Begins pulling files into the destination the visitor chose. */
  public start(target: BulkSaveTarget): void {
    if (!this.#manifest) throw new Error("The file list has not arrived yet");
    this.#target = target;
    this.#queue = [];
    for (let index = 0; index < this.#states.length; index += 1) {
      if (this.#states[index] === FILE_STATE.pending) this.#queue.push(index);
    }
    this.#enqueue(() => this.#advance());
  }

  /** Asks again for files that failed. Already-saved files are never fetched twice. */
  public retryFailed(): void {
    for (let index = 0; index < this.#states.length; index += 1) {
      if (this.#states[index] === FILE_STATE.failed && this.#failures.get(index) !== "tooLarge") {
        this.#states[index] = FILE_STATE.pending;
        this.#failures.delete(index);
        this.#queue.push(index);
      }
    }
    this.#finishedSent = false;
    this.#enqueue(() => this.#advance());
  }

  public pause(): void {
    this.#localPause = true;
    this.#send?.({ t: "pause" });
    this.#emit(true);
  }

  public resume(): void {
    this.#localPause = false;
    this.#send?.({ t: "resume" });
    this.#emit(true);
  }

  /** The visitor emptied the batch; carry on with whatever fits now. */
  public storageFreed(): void {
    this.#storageFull = false;
    this.#enqueue(() => this.#advance());
  }

  public async cancel(): Promise<void> {
    this.#cancelled = true;
    this.#send?.({ t: "cancel", reason: "user" });
    await this.#abortActive();
    this.#emit(true);
  }

  public async attach(
    channel: BulkChannel,
    handshake: HandshakeResult,
  ): Promise<ReceiverAttachOutcome> {
    const maxFrame = Math.max(channel.maxMessageSize, BULK_FRAME_BYTES);
    return new Promise<ReceiverAttachOutcome>((resolve) => {
      let settled = false;
      const settle = (outcome: ReceiverAttachOutcome) => {
        if (settled) return;
        settled = true;
        offClose();
        release();
        this.#send = null;
        resolve(outcome);
      };
      const send = (message: BulkControl) => {
        if (channel.isOpen) channel.send(JSON.stringify(message));
      };
      this.#send = send;
      // Reassembly never spans a reconnect.
      this.#fragments = 0;
      this.#assembled = 0;
      this.#nextFragment = 0;
      send({ t: "window", blocks: this.#options.windowBlocks ?? 16 });

      const offClose = channel.onClose(() => settle(this.#cancelled ? "cancelled" : "detached"));
      const release = handshake.takeOver((data) => {
        this.#enqueue(async () => {
          if (settled) return;
          if (typeof data === "string") {
            const message = parseBulkControl(data);
            if (!message) {
              settle("rejected");
              channel.close();
              return;
            }
            const verdict = await this.#onControl(message);
            if (verdict === "rejected") {
              settle("rejected");
              channel.close();
            } else if (verdict === "cancelled") {
              settle("cancelled");
            }
          } else {
            await this.#onData(data, maxFrame);
          }
        });
      });

      // After a reconnect, ask for exactly what is missing.
      if (this.#manifest && this.#target) {
        this.#enqueue(async () => {
          if (this.#pauseReason() === "local") send({ t: "pause" });
          if (this.#active) {
            send({ t: "want", file: this.#active.file, from: this.#active.nextBlock });
          } else if (this.#finishedSent) {
            send({ t: "finished" });
          } else {
            await this.#advance();
          }
        });
      }
    });
  }

  #enqueue(task: () => Promise<void>): void {
    this.#chain = this.#chain.then(task).catch(() => undefined);
  }

  async #onControl(message: BulkControl): Promise<"ok" | "rejected" | "cancelled"> {
    switch (message.t) {
      case "manifest":
        return this.#onManifestPage(message);
      case "pause":
        this.#remotePause = true;
        this.#emit(true);
        return "ok";
      case "resume":
        this.#remotePause = false;
        this.#emit(true);
        return "ok";
      case "cancel":
        this.#cancelled = true;
        await this.#abortActive();
        this.#emit(true);
        return "cancelled";
      case "unreadable":
        if (this.#active?.file === message.file) {
          await this.#failActive("unreadable");
          await this.#advance();
        } else if (message.file < this.#states.length) {
          this.#markFailed(message.file, "unreadable");
        }
        return "ok";
      default:
        // A sender never sends want/ack/done/window/finished; ignore rather than trust.
        return "ok";
    }
  }

  async #onManifestPage(
    message: Extract<BulkControl, { t: "manifest" }>,
  ): Promise<"ok" | "rejected"> {
    if (this.#manifest) {
      // A reconnect re-sends the list; it must describe the same transfer.
      return message.fileCount === this.#manifest.files.length &&
        message.totalBytes === this.#manifest.totalBytes
        ? "ok"
        : "rejected";
    }
    if (!this.#pageMeta) {
      this.#pageMeta = {
        pages: message.pages,
        fileCount: message.fileCount,
        totalBytes: message.totalBytes,
      };
      this.#pages = Array.from({ length: message.pages }, () => null);
    }
    const meta = this.#pageMeta;
    if (
      message.pages !== meta.pages ||
      message.fileCount !== meta.fileCount ||
      message.totalBytes !== meta.totalBytes ||
      message.page >= meta.pages ||
      this.#pages[message.page] !== null
    ) {
      return "rejected";
    }
    let page;
    try {
      const raw = await openBulkManifestPage(
        this.#options.keys,
        message.page,
        meta.pages,
        meta.fileCount,
        message.sealed,
      );
      page = bulkManifestPageSchema.parse(raw);
    } catch {
      return "rejected";
    }
    if (
      page.first !== message.page * BULK_MANIFEST_PAGE_FILES ||
      page.first + page.files.length > meta.fileCount
    ) {
      return "rejected";
    }
    this.#pages[message.page] = page.files;
    if (this.#pages.some((entry) => entry === null)) return "ok";

    const files = this.#pages.flatMap((entry) => entry ?? []);
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (
      files.length !== meta.fileCount ||
      files.length > BULK_MAX_FILES ||
      totalBytes !== meta.totalBytes ||
      totalBytes > BULK_MAX_TOTAL_BYTES
    ) {
      return "rejected";
    }
    const names = uniqueSafeNames(files.map((file) => file.name));
    this.#manifest = {
      files: files.map((file, index) => ({
        name: names[index] ?? "file",
        size: file.size,
        type: safeMediaType(file.type),
      })),
      totalBytes,
    };
    this.#pages = [];
    this.#states = new Uint8Array(files.length);
    this.#options.onManifest?.(this.#manifest);
    this.#emit(true);
    return "ok";
  }

  async #onData(bytes: Uint8Array, maxFrame: number): Promise<void> {
    const active = this.#active;
    if (!active) return;
    const frame = decodeBulkDataFrame(bytes, maxFrame);
    if (!frame) {
      await this.#rerequest(active);
      return;
    }
    // Frames from before a rewind or for another file are stale, not hostile.
    if (frame.file !== active.file || frame.block !== active.nextBlock) return;
    if (frame.fragment === 0) {
      this.#fragments = frame.fragments;
      this.#assembled = 0;
      this.#nextFragment = 0;
    }
    if (
      frame.fragment !== this.#nextFragment ||
      frame.fragments !== this.#fragments ||
      this.#assembled + frame.payload.byteLength > this.#assembly.byteLength
    ) {
      await this.#rerequest(active);
      return;
    }
    this.#assembly.set(frame.payload, this.#assembled);
    this.#assembled += frame.payload.byteLength;
    this.#nextFragment += 1;
    if (this.#nextFragment < this.#fragments) return;

    const sealed = this.#assembly.subarray(0, this.#assembled);
    this.#fragments = 0;
    this.#nextFragment = 0;
    let plaintext: Uint8Array;
    try {
      plaintext = await openBulkBlock(
        await this.#keyFor(active.file),
        this.#options.keys,
        { file: active.file, block: active.nextBlock, blockCount: active.blockCount },
        sealed,
      );
    } catch {
      await this.#rerequest(active);
      return;
    }
    if (plaintext.byteLength !== bulkBlockPlaintextBytes(active.size, active.nextBlock)) {
      await this.#rerequest(active);
      return;
    }
    try {
      await active.sink.write(plaintext);
    } catch {
      plaintext.fill(0);
      await this.#failActive("storage");
      await this.#advance();
      return;
    }
    plaintext.fill(0);
    const block = active.nextBlock;
    active.nextBlock += 1;
    active.retries = 0;
    this.#doneBytes += bulkBlockPlaintextBytes(active.size, block);
    this.#send?.({ t: "ack", file: active.file, block });
    this.#emit();

    if (active.nextBlock === active.blockCount) {
      await this.#completeActive();
      await this.#advance();
    }
  }

  async #rerequest(active: Active): Promise<void> {
    this.#fragments = 0;
    this.#nextFragment = 0;
    active.retries += 1;
    if (active.retries > MAX_BLOCK_RETRIES) {
      await this.#failActive("damaged");
      await this.#advance();
      return;
    }
    this.#send?.({ t: "want", file: active.file, from: active.nextBlock });
  }

  async #completeActive(): Promise<void> {
    const active = this.#active;
    if (!active) return;
    let outcome: BulkFileOutcome;
    try {
      outcome = await active.sink.finish();
    } catch {
      await this.#failActive("storage");
      return;
    }
    this.#active = null;
    this.#states[active.file] = outcomeCode(outcome);
    this.#send?.({ t: "done", file: active.file, outcome });
    this.#emit(true);
  }

  async #failActive(reason: FailureReason): Promise<void> {
    const active = this.#active;
    if (!active) return;
    this.#active = null;
    await active.sink.abort().catch(() => undefined);
    for (let block = 0; block < active.nextBlock; block += 1) {
      this.#doneBytes -= bulkBlockPlaintextBytes(active.size, block);
    }
    this.#markFailed(active.file, reason);
  }

  #markFailed(file: number, reason: FailureReason): void {
    this.#states[file] = FILE_STATE.failed;
    this.#failures.set(file, reason);
    this.#send?.({ t: "done", file, outcome: "failed" });
    this.#emit(true);
  }

  async #abortActive(): Promise<void> {
    const active = this.#active;
    if (!active) return;
    this.#active = null;
    await active.sink.abort().catch(() => undefined);
    for (let block = 0; block < active.nextBlock; block += 1) {
      this.#doneBytes -= bulkBlockPlaintextBytes(active.size, block);
    }
    this.#states[active.file] = FILE_STATE.pending;
  }

  /** Opens the next file that fits and asks for it, or reports why it cannot. */
  async #advance(): Promise<void> {
    const target = this.#target;
    const manifest = this.#manifest;
    if (!target || !manifest || this.#active || this.#cancelled || this.#storageFull) return;
    while (this.#queue.length > 0) {
      const file = this.#queue[0] ?? 0;
      const entry = manifest.files[file];
      if (!entry || this.#states[file] !== FILE_STATE.pending) {
        this.#queue.shift();
        continue;
      }
      const room = target.reserve(entry);
      if (room === "full") {
        this.#storageFull = true;
        this.#emit(true);
        this.#options.onStorageFull?.();
        return;
      }
      this.#queue.shift();
      if (room === "too-large") {
        this.#markFailed(file, "tooLarge");
        continue;
      }
      let sink: BulkFileSink;
      try {
        sink = await target.open(entry, file);
      } catch {
        this.#markFailed(file, "storage");
        continue;
      }
      this.#active = {
        file,
        blockCount: bulkBlockCount(entry.size),
        size: entry.size,
        sink,
        nextBlock: 0,
        retries: 0,
      };
      this.#states[file] = FILE_STATE.active;
      this.#send?.({ t: "want", file, from: 0 });
      this.#emit(true);
      return;
    }
    if (!this.#finishedSent && this.#states.every((state) => state >= FILE_STATE.saved)) {
      this.#finishedSent = true;
      this.#send?.({ t: "finished" });
      this.#emit(true);
    }
  }

  #keyFor(file: number): Promise<CryptoKey> {
    if (this.#fileKey?.file !== file) {
      this.#fileKey = { file, key: deriveBulkFileKey(this.#options.keys, file) };
    }
    return this.#fileKey.key;
  }

  #pauseReason(): PauseReason | null {
    if (this.#storageFull) return "storage";
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
