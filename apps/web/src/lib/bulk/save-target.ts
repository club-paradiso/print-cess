import type { BulkFileOutcome } from "@print-cess/protocol";

export type BulkFileSink = {
  write(chunk: Uint8Array): Promise<void>;
  /** Completes the file and reports only what the destination actually confirmed. */
  finish(): Promise<BulkFileOutcome>;
  abort(): Promise<void>;
};

export type ReserveResult = "ok" | "full" | "too-large";

/**
 * Where received files go. A folder the visitor picked can take everything; a
 * batch held in the browser can take only what fits, and then has to be handed
 * to the visitor (share sheet or download) and emptied before more arrive.
 */
export interface BulkSaveTarget {
  readonly kind: "folder" | "batch" | "discard";
  /** Synchronous capacity check for the next file, against the target's current budget. */
  reserve(file: { size: number }): ReserveResult;
  open(file: { name: string; type: string; size: number }, index: number): Promise<BulkFileSink>;
  /**
   * A write failed (typically the browser's real quota was smaller than its
   * estimate). Returns true when emptying the current batch would make room,
   * in which case the file is retried after the visitor saves the batch
   * instead of being reported as failed.
   */
  handleWriteFailure?(): boolean;
}
