import type { BulkFileOutcome } from "@print-cess/protocol";

/** Anything with a size and a byte-range reader: a `File`, or a synthetic test source. */
export type BulkSource = {
  readonly name: string;
  readonly size: number;
  readonly type: string;
  slice(start: number, end: number): { arrayBuffer(): Promise<ArrayBuffer> };
};

/**
 * Per-file state, stored as one byte per file so 3,000 files cost 3 KB and a
 * progress update never copies an array of objects.
 */
export const FILE_STATE = {
  pending: 0,
  active: 1,
  saved: 2,
  stored: 3,
  downloadStarted: 4,
  failed: 5,
} as const;
export type FileStateCode = (typeof FILE_STATE)[keyof typeof FILE_STATE];
export type FileStateName = keyof typeof FILE_STATE;

export const FILE_STATE_NAMES: readonly FileStateName[] = [
  "pending",
  "active",
  "saved",
  "stored",
  "downloadStarted",
  "failed",
];

export function outcomeCode(outcome: BulkFileOutcome): FileStateCode {
  return FILE_STATE[outcome];
}

export type StateCounts = Record<FileStateName, number>;

export function countStates(states: Uint8Array): StateCounts {
  const counts: StateCounts = {
    pending: 0,
    active: 0,
    saved: 0,
    stored: 0,
    downloadStarted: 0,
    failed: 0,
  };
  for (const code of states) {
    const name = FILE_STATE_NAMES[code];
    if (name) counts[name] += 1;
  }
  return counts;
}

export type PauseReason = "local" | "remote" | "storage";

export type TransferSnapshot = {
  fileCount: number;
  totalBytes: number;
  /** Plaintext bytes the receiver has confirmed writing (sender: acknowledged). */
  doneBytes: number;
  counts: StateCounts;
  currentFile: number | null;
  paused: PauseReason | null;
  /** Receiver has reported an outcome for every file. */
  finished: boolean;
};
