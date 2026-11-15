import type { BulkFileOutcome } from "@print-cess/protocol";

import {
  downloadOptions,
  downloadTarget,
  pickDirectoryTarget,
  saveCapabilities,
} from "../drop-save";
import type { BulkFileSink, BulkSaveTarget, ReserveResult } from "./save-target";

/**
 * Receiving-side destinations for a bulk transfer, chosen by feature detection.
 *
 * - **Folder** (`showDirectoryPicker`, desktop Chromium): every file is written
 *   straight into a folder the visitor chose. The outcome is `saved`, because
 *   the browser confirms the file closed at that path.
 * - **Batch** (everything else, including iOS and iPadOS Safari): files are held
 *   in browser storage — the origin-private file system where it can be
 *   written, otherwise memory — up to a budget. When the budget is reached the
 *   transfer pauses and the visitor hands the batch to the share sheet or the
 *   download machinery, then the batch is emptied and the transfer continues.
 *   The outcome is `stored`: held by this browser, not yet in Photos or Files.
 * - **Downloads** (small transfers only): each file is handed to a regular
 *   download as it completes, `downloadStarted`, exactly like the v1 hand-off.
 *   It is offered only for a handful of files: a page that fires thousands of
 *   downloads is broken, whatever the browser allows.
 */

export const DIRECT_DOWNLOAD_MAX_FILES = 20;
/** What a memory batch may hold. Phones have far less headroom than their RAM suggests. */
export const MEMORY_BATCH_BYTES = 256 * 1024 * 1024;
/** No single file is assembled in memory above this. */
export const MEMORY_FILE_LIMIT_BYTES = 512 * 1024 * 1024;
/** Left free in browser storage, so the page and the system keep working. */
export const STORAGE_MARGIN_BYTES = 512 * 1024 * 1024;
/** A storage batch never grows past this, so one export stays manageable. */
export const STORAGE_BATCH_CAP_BYTES = 4 * 1024 ** 3;
const STAGING_DIRECTORY = "print-cess-bulk";

export type BulkSaveOptions = {
  folder: boolean;
  batch: "storage" | "memory";
  directDownloads: boolean;
  share: boolean;
};

export function bulkSaveOptions(fileCount: number): BulkSaveOptions {
  const capabilities = saveCapabilities();
  return {
    folder: capabilities.canPickDirectory,
    batch: capabilities.canStage ? "storage" : "memory",
    directDownloads: fileCount <= DIRECT_DOWNLOAD_MAX_FILES,
    share: capabilities.canShareFiles,
  };
}

/** Must be called from the tap that asked for it: the picker needs the user activation. */
export async function pickFolderTarget(): Promise<BulkSaveTarget | null> {
  const directory = await pickDirectoryTarget();
  if (!directory) return null;
  return {
    kind: "folder",
    reserve: () => "ok",
    async open(file) {
      const sink = await directory.open(file);
      return {
        write: (chunk) => sink.write(chunk),
        finish: async () => ((await sink.finish()) === "saved" ? "saved" : "downloadStarted"),
        abort: () => sink.abort(),
      };
    },
  };
}

export function directDownloadTarget(): BulkSaveTarget {
  return {
    kind: "batch",
    reserve: (file) => {
      try {
        downloadTarget(file.size);
        return "ok";
      } catch {
        return "too-large";
      }
    },
    async open(file) {
      const sink = await downloadTarget(file.size).open(file);
      return {
        write: (chunk) => sink.write(chunk),
        finish: async (): Promise<BulkFileOutcome> => sink.finish(),
        abort: () => sink.abort(),
      };
    },
  };
}

export type BatchItem = {
  index: number;
  name: string;
  type: string;
  size: number;
  file(): Promise<File>;
};

/**
 * A batch held in this browser. `items` is what the visitor still has to save;
 * `clear()` deletes it from browser storage and frees the budget.
 */
export class BatchTarget implements BulkSaveTarget {
  public readonly kind = "batch" as const;
  public readonly items: BatchItem[] = [];
  #used = 0;
  #budget: number;
  #maxFile: number;
  #directory: FileSystemDirectoryHandle | null;
  #counter = 0;

  private constructor(
    directory: FileSystemDirectoryHandle | null,
    budget: number,
    maxFile: number,
  ) {
    this.#directory = directory;
    this.#budget = budget;
    this.#maxFile = maxFile;
  }

  public get mode(): "storage" | "memory" {
    return this.#directory ? "storage" : "memory";
  }

  public get usedBytes(): number {
    return this.#used;
  }

  public get budgetBytes(): number {
    return this.#budget;
  }

  /**
   * Prefers the origin-private file system, which keeps file bytes off the
   * JavaScript heap. Feature detection is not permission: a browser can expose
   * it and still refuse to write (private modes, older Safari without
   * `createWritable`), so the probe actually writes before trusting it.
   */
  public static async create(): Promise<BatchTarget> {
    const directory = await openStagingDirectory();
    if (directory) {
      const free = await freeStorageBytes();
      const budget = Math.max(0, Math.min(STORAGE_BATCH_CAP_BYTES, free - STORAGE_MARGIN_BYTES));
      if (budget >= 64 * 1024 * 1024) return new BatchTarget(directory, budget, budget);
    }
    return new BatchTarget(null, MEMORY_BATCH_BYTES, MEMORY_FILE_LIMIT_BYTES);
  }

  public reserve(file: { size: number }): ReserveResult {
    if (file.size > this.#maxFile) return "too-large";
    // A file larger than a whole batch (but under the file limit) gets a batch of its own.
    if (this.#used > 0 && this.#used + file.size > this.#budget) return "full";
    return "ok";
  }

  public async open(
    file: { name: string; type: string; size: number },
    index: number,
  ): Promise<BulkFileSink> {
    const item = { index, name: file.name, type: file.type, size: file.size };
    if (this.#directory) {
      const directory = this.#directory;
      this.#counter += 1;
      const stagingName = `${index}-${this.#counter}`;
      const handle = await directory.getFileHandle(stagingName, { create: true });
      const writable = await handle.createWritable();
      let written = 0;
      return {
        write: async (chunk) => {
          await writable.write(copyOf(chunk));
          written += chunk.byteLength;
          this.#used += chunk.byteLength;
        },
        finish: async () => {
          await writable.close();
          this.items.push({
            ...item,
            file: async () => new File([await handle.getFile()], file.name, typeOf(file.type)),
            // `stagingName` is kept implicitly through the handle for deletion.
          });
          this.#names.set(index, stagingName);
          return "stored";
        },
        abort: async () => {
          await writable.abort().catch(() => undefined);
          await directory.removeEntry(stagingName).catch(() => undefined);
          this.#used -= written;
        },
      };
    }
    let chunks: ArrayBuffer[] = [];
    let written = 0;
    return {
      write: async (chunk) => {
        chunks.push(copyOf(chunk));
        written += chunk.byteLength;
        this.#used += chunk.byteLength;
      },
      finish: async () => {
        const blob = new File(chunks, file.name, typeOf(file.type));
        chunks = [];
        this.items.push({ ...item, file: async () => blob });
        return "stored";
      },
      abort: async () => {
        chunks = [];
        this.#used -= written;
      },
    };
  }

  readonly #names = new Map<number, string>();

  public handleWriteFailure(): boolean {
    if (this.items.length === 0) return false;
    // The estimate was optimistic: treat what is held now as the real budget.
    this.#budget = Math.max(1, this.#used);
    return true;
  }

  /** Deletes the batch from browser storage once the visitor has saved it. */
  public async clear(): Promise<void> {
    if (this.#directory) {
      for (const name of this.#names.values()) {
        await this.#directory.removeEntry(name).catch(() => undefined);
      }
    }
    this.#names.clear();
    this.items.length = 0;
    this.#used = 0;
    if (this.#directory) {
      const free = await freeStorageBytes();
      this.#budget = Math.max(
        64 * 1024 * 1024,
        Math.min(STORAGE_BATCH_CAP_BYTES, free - STORAGE_MARGIN_BYTES),
      );
    }
  }

  /** Removes everything this page staged, including leftovers from a closed tab. */
  public async dispose(): Promise<void> {
    await this.clear();
    await removeStagingDirectory();
  }
}

async function openStagingDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (typeof navigator === "undefined" || typeof navigator.storage?.getDirectory !== "function") {
    return null;
  }
  try {
    // Anything left by an earlier tab is decrypted content nobody is watching.
    await removeStagingDirectory();
    const root = await navigator.storage.getDirectory();
    const directory = await root.getDirectoryHandle(STAGING_DIRECTORY, { create: true });
    const probe = await directory.getFileHandle("probe", { create: true });
    if (typeof probe.createWritable !== "function") return null;
    const writable = await probe.createWritable();
    await writable.write(new Uint8Array([1]));
    await writable.close();
    await directory.removeEntry("probe");
    await navigator.storage.persist?.().catch(() => false);
    return directory;
  } catch {
    return null;
  }
}

async function removeStagingDirectory(): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(STAGING_DIRECTORY, { recursive: true });
  } catch {
    // Nothing to remove, or storage is unavailable.
  }
}

async function freeStorageBytes(): Promise<number> {
  try {
    const estimate = await navigator.storage.estimate();
    if (typeof estimate.quota !== "number") return 0;
    return Math.max(0, estimate.quota - (estimate.usage ?? 0));
  } catch {
    return 0;
  }
}

function copyOf(chunk: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(chunk.byteLength);
  copy.set(chunk);
  return copy.buffer;
}

/**
 * Markup and script types are handed over as opaque bytes, exactly as the v1
 * hand-off does: a browser that opened such a file instead of saving it would
 * otherwise run it on this origin.
 */
function typeOf(type: string): FilePropertyBag {
  return downloadOptions(type);
}

/**
 * Offers a set of files to the system share sheet, which on iOS includes "Save
 * Images" / "Save to Files". Resolves `true` only when the sheet completed;
 * whether the files then reached Photos or Files is not observable from a page,
 * and the screen never claims it.
 */
export async function shareFiles(files: File[]): Promise<"shared" | "dismissed" | "unsupported"> {
  if (typeof navigator.canShare !== "function" || !navigator.canShare({ files })) {
    return "unsupported";
  }
  try {
    await navigator.share({ files });
    return "shared";
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === "AbortError" || error.name === "NotAllowedError")
    ) {
      return "dismissed";
    }
    throw error;
  }
}

export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
}
