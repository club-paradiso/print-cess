import { z } from "zod";

import { DIGEST_PATTERN } from "./canonical.js";

/**
 * Bulk Transfer 2.0: a direct, browser-to-browser hand-off of up to a few
 * thousand files, with the service acting only as a short-lived mailbox for
 * two encrypted connection descriptions.
 *
 * It is a separate protocol from the version 1 drop, not an extension of it.
 * A drop is store-and-forward: ciphertext lives in blob storage and either
 * phone can leave. A bulk transfer is live: both browsers stay open, and the
 * file bytes travel over a WebRTC data channel that the service never sees.
 * Nothing here reinterprets a drop record, and a drop never becomes a bulk
 * room or the other way round.
 */
export const BULK_PROTOCOL_VERSION = 2 as const;

/** Same canonical 16-byte base64url shape as a drop identifier. */
export const BULK_ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{21}[AQgw]$/u;

/**
 * Product ceilings. They are protocol constants rather than configuration
 * because the receiving browser has to enforce them before it believes a
 * manifest, and a receiver cannot ask the sender's server what they were.
 *
 * 3,000 files is the validated target. The manifest is paged, so raising it is
 * a matter of re-running the large-manifest tests, not of redesigning a record.
 */
export const BULK_MAX_FILES = 3000;
/** One file may be large (a long video), but never larger than this. */
export const BULK_MAX_FILE_BYTES = 64 * 1024 ** 3;
/** The whole hand-off. The receiving device is the practical limit long before this. */
export const BULK_MAX_TOTAL_BYTES = 128 * 1024 ** 3;
export const BULK_MAX_FILE_NAME_BYTES = 180;
export const BULK_MAX_MIME_LENGTH = 128;

/**
 * Encryption framing. A block is the unit that is sealed, acknowledged, and
 * resumed from. It is deliberately much smaller than a v1 storage part (8 MiB):
 * a block in flight costs memory on both phones, and a lost connection costs at
 * most one block of rework per file.
 */
export const BULK_BLOCK_BYTES = 256 * 1024;
export const BULK_IV_BYTES = 12;
export const BULK_TAG_BYTES = 16;
export const BULK_BLOCK_OVERHEAD_BYTES = BULK_IV_BYTES + BULK_TAG_BYTES;
export const BULK_MAX_SEALED_BLOCK_BYTES = BULK_BLOCK_BYTES + BULK_BLOCK_OVERHEAD_BYTES;

/**
 * Transport framing. A sealed block is cut into data-channel messages no larger
 * than this. 16 KiB is the size every browser pair has interoperated with since
 * the first SCTP implementations; larger messages stall the channel behind
 * them (head-of-line blocking) and some stacks still refuse them. The sender
 * may go smaller if the negotiated maximum message size is smaller.
 */
export const BULK_FRAME_BYTES = 16 * 1024;
export const BULK_MIN_FRAME_BYTES = 1024;
export const BULK_DATA_HEADER_BYTES = 13;
export const BULK_DATA_FRAME_TYPE = 0x01;

/** Files per sealed manifest page, chosen so a page of long names stays well under 64 KiB. */
export const BULK_MANIFEST_PAGE_FILES = 150;
export const BULK_MAX_MANIFEST_PAGES = Math.ceil(BULK_MAX_FILES / BULK_MANIFEST_PAGE_FILES);
/** Any control message larger than this is refused unread. */
export const BULK_MAX_CONTROL_BYTES = 96 * 1024;

/** Encrypted connection description, base64url. Non-trickle SDP with candidates fits easily. */
export const BULK_MAX_SIGNAL_BYTES = 24 * 1024;
/** A waiting room lives this long after its last offer, then disappears. */
export const BULK_ROOM_TTL_SECONDS = 30 * 60;
/** Reconnections extend a room, but never past this from its creation. */
export const BULK_ROOM_MAX_LIFETIME_SECONDS = 12 * 60 * 60;
/** Reconnection attempts a room may record. Each one is a new offer. */
export const BULK_MAX_GENERATIONS = 200;

export const BULK_CODE_KDF_SALT = "print-cess-by-paradiso:bulk-code:v2";
export const BULK_HKDF_INFO = "print-cess-by-paradiso:bulk:v2";

export const BULK_ROLES = ["sender", "receiver"] as const;
export type BulkRole = (typeof BULK_ROLES)[number];

export function bulkBlockCount(size: number): number {
  // An empty file still costs one (empty) block, so its arrival is authenticated
  // exactly like any other file's last block.
  return Math.max(1, Math.ceil(size / BULK_BLOCK_BYTES));
}

export function bulkBlockPlaintextBytes(size: number, block: number): number {
  const offset = block * BULK_BLOCK_BYTES;
  return Math.max(0, Math.min(BULK_BLOCK_BYTES, size - offset));
}

const base64UrlSignal = z
  .string()
  .regex(/^[A-Za-z0-9_-]+$/u)
  .min(16)
  .max(BULK_MAX_SIGNAL_BYTES);

/* ------------------------------------------------------------------------ */
/* Signalling records and HTTP bodies                                        */
/* ------------------------------------------------------------------------ */

export const bulkRoomRecordSchema = z
  .object({
    protocolVersion: z.literal(BULK_PROTOCOL_VERSION),
    roomId: z.string().regex(BULK_ROOM_ID_PATTERN),
    ownerTokenHash: z.string().regex(DIGEST_PATTERN),
    /** Increments with every new offer, so a stale answer can never be paired with a fresh offer. */
    generation: z.number().int().min(1).max(BULK_MAX_GENERATIONS),
    offer: base64UrlSignal,
    answer: base64UrlSignal.nullable(),
    createdAt: z.number().int().nonnegative(),
    expiresAt: z.number().int().positive(),
    revision: z.number().int().nonnegative(),
  })
  .strict()
  .refine((room) => room.expiresAt > room.createdAt, {
    message: "Room expiry must be later than creation.",
    path: ["expiresAt"],
  });

export type BulkRoomRecord = z.infer<typeof bulkRoomRecordSchema>;

export const createBulkRoomRequestSchema = z
  .object({
    protocolVersion: z.literal(BULK_PROTOCOL_VERSION),
    roomId: z.string().regex(BULK_ROOM_ID_PATTERN),
    ownerTokenHash: z.string().regex(DIGEST_PATTERN),
    offer: base64UrlSignal,
  })
  .strict();

export const bulkOfferRequestSchema = z
  .object({
    protocolVersion: z.literal(BULK_PROTOCOL_VERSION),
    generation: z.number().int().min(2).max(BULK_MAX_GENERATIONS),
    offer: base64UrlSignal,
  })
  .strict();

export const bulkAnswerRequestSchema = z
  .object({
    protocolVersion: z.literal(BULK_PROTOCOL_VERSION),
    generation: z.number().int().min(1).max(BULK_MAX_GENERATIONS),
    answer: base64UrlSignal,
  })
  .strict();

/** What a receiver learns from the mailbox: one opaque blob and a counter. */
export type BulkRoomReceiverView = {
  protocolVersion: typeof BULK_PROTOCOL_VERSION;
  generation: number;
  offer: string;
  answered: boolean;
  expiresAt: number;
};

/** What the owner learns: whether the current offer has been answered, and the answer. */
export type BulkRoomOwnerView = {
  protocolVersion: typeof BULK_PROTOCOL_VERSION;
  generation: number;
  answer: string | null;
  expiresAt: number;
};

export type BulkIceServer = { urls: string[]; username?: string; credential?: string };

export type BulkCapabilities = {
  protocolVersion: typeof BULK_PROTOCOL_VERSION;
  maximumFileCount: number;
  maximumTotalBytes: number;
  maximumFileBytes: number;
  iceServers: BulkIceServer[];
  /** True only when an operator configured a relay. It is off by default. */
  relayConfigured: boolean;
  /**
   * The v1 encrypted cloud hand-off, offered only with the visitor's explicit
   * consent when a direct connection fails. Its limits are the drop limits.
   */
  cloudFallback: { available: boolean; maximumFileCount: number; maximumTotalBytes: number };
};

/* ------------------------------------------------------------------------ */
/* Signal payloads (inside the encrypted envelope)                           */
/* ------------------------------------------------------------------------ */

const sdpSchema = z
  .string()
  .min(10)
  .max(16 * 1024);
const nonceSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/u);

export const bulkOfferPayloadSchema = z
  .object({
    v: z.literal(BULK_PROTOCOL_VERSION),
    kind: z.literal("offer"),
    generation: z.number().int().min(1).max(BULK_MAX_GENERATIONS),
    /** Fresh per offer; the answer must echo it, which binds the pair together. */
    nonce: nonceSchema,
    sdp: sdpSchema,
  })
  .strict();

export const bulkAnswerPayloadSchema = z
  .object({
    v: z.literal(BULK_PROTOCOL_VERSION),
    kind: z.literal("answer"),
    generation: z.number().int().min(1).max(BULK_MAX_GENERATIONS),
    offerNonce: nonceSchema,
    nonce: nonceSchema,
    sdp: sdpSchema,
  })
  .strict();

export type BulkOfferPayload = z.infer<typeof bulkOfferPayloadSchema>;
export type BulkAnswerPayload = z.infer<typeof bulkAnswerPayloadSchema>;

/* ------------------------------------------------------------------------ */
/* Data-channel control messages                                             */
/* ------------------------------------------------------------------------ */

const fileIndex = z
  .number()
  .int()
  .min(0)
  .max(BULK_MAX_FILES - 1);
const blockIndex = z.number().int().min(0).max(0xffff_ffff);

export const BULK_FILE_OUTCOMES = ["saved", "stored", "downloadStarted", "failed"] as const;
export type BulkFileOutcome = (typeof BULK_FILE_OUTCOMES)[number];

export const bulkControlSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("hello"), role: z.enum(BULK_ROLES), nonce: nonceSchema }).strict(),
  z
    .object({
      t: z.literal("proof"),
      mac: z.string().regex(/^[A-Za-z0-9_-]{43}$/u),
    })
    .strict(),
  z
    .object({
      t: z.literal("manifest"),
      page: z
        .number()
        .int()
        .min(0)
        .max(BULK_MAX_MANIFEST_PAGES - 1),
      pages: z.number().int().min(1).max(BULK_MAX_MANIFEST_PAGES),
      fileCount: z.number().int().min(1).max(BULK_MAX_FILES),
      totalBytes: z.number().int().nonnegative().max(BULK_MAX_TOTAL_BYTES),
      sealed: z
        .string()
        .regex(/^[A-Za-z0-9_-]+$/u)
        .max(BULK_MAX_CONTROL_BYTES - 512),
    })
    .strict(),
  /** Receiver → sender: send this file, starting at this block. */
  z.object({ t: z.literal("want"), file: fileIndex, from: blockIndex }).strict(),
  /** Receiver → sender: this block is written to its destination. */
  z.object({ t: z.literal("ack"), file: fileIndex, block: blockIndex }).strict(),
  /** Receiver → sender: what happened to a whole file. */
  z
    .object({
      t: z.literal("done"),
      file: fileIndex,
      outcome: z.enum(BULK_FILE_OUTCOMES),
    })
    .strict(),
  /** Receiver → sender: how many unacknowledged blocks it is willing to hold. */
  z
    .object({
      t: z.literal("window"),
      blocks: z.number().int().min(1).max(64),
    })
    .strict(),
  z.object({ t: z.literal("pause") }).strict(),
  z.object({ t: z.literal("resume") }).strict(),
  /** Receiver → sender: every file has an outcome; nothing more will be requested. */
  z.object({ t: z.literal("finished") }).strict(),
  z
    .object({
      t: z.literal("cancel"),
      reason: z.enum(["user", "error", "storage"]),
    })
    .strict(),
  /** Sender → receiver: the source file could not be read; the receiver should mark it failed. */
  z
    .object({
      t: z.literal("unreadable"),
      file: fileIndex,
    })
    .strict(),
]);

export type BulkControl = z.infer<typeof bulkControlSchema>;

/** One entry of the sealed manifest. Names are sanitized again on arrival. */
export const bulkManifestFileSchema = z
  .object({
    name: z.string().min(1).max(BULK_MAX_FILE_NAME_BYTES),
    size: z.number().int().nonnegative().max(BULK_MAX_FILE_BYTES),
    type: z.string().max(BULK_MAX_MIME_LENGTH),
  })
  .strict();

export const bulkManifestPageSchema = z
  .object({
    v: z.literal(BULK_PROTOCOL_VERSION),
    first: z
      .number()
      .int()
      .min(0)
      .max(BULK_MAX_FILES - 1),
    files: z.array(bulkManifestFileSchema).min(1).max(BULK_MANIFEST_PAGE_FILES),
  })
  .strict();

export type BulkManifestFile = z.infer<typeof bulkManifestFileSchema>;
export type BulkManifestPage = z.infer<typeof bulkManifestPageSchema>;

export function parseBulkControl(raw: string): BulkControl | null {
  if (raw.length > BULK_MAX_CONTROL_BYTES) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = bulkControlSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/* ------------------------------------------------------------------------ */
/* Binary data frames                                                        */
/* ------------------------------------------------------------------------ */

export type BulkDataFrame = {
  file: number;
  block: number;
  fragment: number;
  fragments: number;
  payload: Uint8Array;
};

/**
 * `type:u8 | file:u32 | block:u32 | fragment:u16 | fragments:u16 | payload`.
 * Thirteen bytes of header on a 16 KiB message is under 0.1% overhead.
 */
export function encodeBulkDataFrame(frame: BulkDataFrame): Uint8Array {
  const out = new Uint8Array(BULK_DATA_HEADER_BYTES + frame.payload.byteLength);
  const view = new DataView(out.buffer);
  view.setUint8(0, BULK_DATA_FRAME_TYPE);
  view.setUint32(1, frame.file, false);
  view.setUint32(5, frame.block, false);
  view.setUint16(9, frame.fragment, false);
  view.setUint16(11, frame.fragments, false);
  out.set(frame.payload, BULK_DATA_HEADER_BYTES);
  return out;
}

/**
 * Decodes a data frame and rejects anything a well-behaved peer cannot send.
 * The payload is a view, not a copy: the caller copies it into its reassembly
 * buffer and then drops the message.
 */
export function decodeBulkDataFrame(
  bytes: Uint8Array,
  maxFrameBytes: number,
): BulkDataFrame | null {
  if (bytes.byteLength <= BULK_DATA_HEADER_BYTES || bytes.byteLength > maxFrameBytes) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint8(0) !== BULK_DATA_FRAME_TYPE) return null;
  const frame: BulkDataFrame = {
    file: view.getUint32(1, false),
    block: view.getUint32(5, false),
    fragment: view.getUint16(9, false),
    fragments: view.getUint16(11, false),
    payload: bytes.subarray(BULK_DATA_HEADER_BYTES),
  };
  if (frame.file >= BULK_MAX_FILES) return null;
  if (frame.fragments < 1 || frame.fragment >= frame.fragments) return null;
  const maximumFragments = Math.ceil(
    BULK_MAX_SEALED_BLOCK_BYTES / (BULK_MIN_FRAME_BYTES - BULK_DATA_HEADER_BYTES),
  );
  if (frame.fragments > maximumFragments) return null;
  return frame;
}

export function bulkFragmentCount(sealedBytes: number, frameBytes: number): number {
  return Math.max(1, Math.ceil(sealedBytes / (frameBytes - BULK_DATA_HEADER_BYTES)));
}
