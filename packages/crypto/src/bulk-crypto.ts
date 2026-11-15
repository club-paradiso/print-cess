import {
  BULK_BLOCK_BYTES,
  BULK_CODE_KDF_SALT,
  BULK_HKDF_INFO,
  BULK_IV_BYTES,
  BULK_MAX_FILES,
  BULK_ROOM_ID_PATTERN,
  BULK_TAG_BYTES,
  DROP_CODE_KDF_ITERATIONS,
  DROP_CODE_PATTERN,
  normalizeDropCode,
  type BulkRole,
} from "@print-cess/protocol";

import { DropCodeError } from "./drop-crypto.js";
import { fromBase64Url, toBase64Url } from "./encoding.js";
import { asArrayBuffer, cryptoRuntime } from "./runtime.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

const SIGNAL_AAD_DOMAIN = "print-cess-by-paradiso:bulk-signal:v2";
const PROOF_DOMAIN = "print-cess-by-paradiso:bulk-proof:v2";
const MANIFEST_AAD_DOMAIN = "print-cess-by-paradiso:bulk-manifest:v2";
const BLOCK_AAD_DOMAIN = "print-cess-by-paradiso:bulk-block:v2";

/**
 * Everything a bulk transfer derives from its twelve-character code. The code
 * uses the same alphabet and work factor as a v1 drop code, but a different
 * salt, so the same characters can never name both a drop and a room.
 */
export type BulkKeys = {
  /** Names the signalling mailbox. Reveals nothing about the code. */
  roomId: string;
  roomIdBytes: Uint8Array;
  /** Seals the connection descriptions the mailbox carries. */
  signalKey: CryptoKey;
  /** Proves, over the open channel, that the peer holds the same code. */
  proofKey: CryptoKey;
  /** Seals the file list, which travels only over the direct channel. */
  manifestKey: CryptoKey;
  rootKey: CryptoKey;
};

export async function deriveBulkKeys(rawCode: string): Promise<BulkKeys> {
  const code = normalizeDropCode(rawCode);
  if (!DROP_CODE_PATTERN.test(code)) {
    throw new DropCodeError("A transfer code is twelve characters long");
  }
  const subtle = cryptoRuntime().subtle;
  const codeBytes = encoder.encode(code);
  const material = await subtle.importKey("raw", asArrayBuffer(codeBytes), "PBKDF2", false, [
    "deriveBits",
  ]);
  const stretched = new Uint8Array(
    await subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: asArrayBuffer(encoder.encode(BULK_CODE_KDF_SALT)),
        iterations: DROP_CODE_KDF_ITERATIONS,
      },
      material,
      384,
    ),
  );
  codeBytes.fill(0);
  const roomIdBytes = stretched.slice(0, 16);
  const secret = stretched.slice(16, 48);
  stretched.fill(0);
  try {
    const rootKey = await subtle.importKey("raw", asArrayBuffer(secret), "HKDF", false, [
      "deriveKey",
      "deriveBits",
    ]);
    const [signalKey, manifestKey, proofKey] = await Promise.all([
      deriveAes(rootKey, roomIdBytes, "signal"),
      deriveAes(rootKey, roomIdBytes, "manifest"),
      subtle.deriveKey(
        hkdf(roomIdBytes, "proof"),
        rootKey,
        { name: "HMAC", hash: "SHA-256", length: 256 },
        false,
        ["sign", "verify"],
      ),
    ]);
    return {
      roomId: toBase64Url(roomIdBytes),
      roomIdBytes,
      signalKey,
      proofKey,
      manifestKey,
      rootKey,
    };
  } finally {
    secret.fill(0);
  }
}

export function assertBulkRoomId(roomId: string): void {
  if (!BULK_ROOM_ID_PATTERN.test(roomId)) throw new Error("Invalid room identifier");
}

/** One content key per file. Callers cache these; deriving is cheap but not free. */
export async function deriveBulkFileKey(keys: BulkKeys, fileIndex: number): Promise<CryptoKey> {
  if (!Number.isInteger(fileIndex) || fileIndex < 0 || fileIndex >= BULK_MAX_FILES) {
    throw new Error("Invalid file index");
  }
  return deriveAes(keys.rootKey, keys.roomIdBytes, `file:${fileIndex}`);
}

/* ------------------------------------------------------------------------ */
/* Signalling envelopes                                                      */
/* ------------------------------------------------------------------------ */

/**
 * Seals one connection description for the mailbox. The additional data binds
 * it to this room, to the role that wrote it, and to the offer generation, so
 * the mailbox (or anyone in front of it) cannot swap an answer into a different
 * room, reflect an offer back as an answer, or replay an old generation.
 *
 * The description carries the DTLS certificate fingerprint. Authenticating it
 * here is what binds the data channel to the transfer code: an attacker who
 * cannot open this envelope cannot substitute their own certificate.
 */
export async function sealBulkSignal(
  keys: BulkKeys,
  role: BulkRole,
  generation: number,
  payload: unknown,
): Promise<string> {
  const iv = cryptoRuntime().getRandomValues(new Uint8Array(BULK_IV_BYTES));
  const plaintext = encoder.encode(JSON.stringify(payload));
  const ciphertext = new Uint8Array(
    await cryptoRuntime().subtle.encrypt(
      {
        name: "AES-GCM",
        iv: asArrayBuffer(iv),
        additionalData: asArrayBuffer(signalAad(keys, role, generation)),
        tagLength: BULK_TAG_BYTES * 8,
      },
      keys.signalKey,
      asArrayBuffer(plaintext),
    ),
  );
  const out = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  out.set(iv, 0);
  out.set(ciphertext, iv.byteLength);
  return toBase64Url(out);
}

export async function openBulkSignal(
  keys: BulkKeys,
  role: BulkRole,
  generation: number,
  sealed: string,
): Promise<unknown> {
  const bytes = fromBase64Url(sealed);
  if (bytes.byteLength <= BULK_IV_BYTES + BULK_TAG_BYTES) throw new Error("Invalid signal");
  const plaintext = await cryptoRuntime().subtle.decrypt(
    {
      name: "AES-GCM",
      iv: asArrayBuffer(bytes.subarray(0, BULK_IV_BYTES)),
      additionalData: asArrayBuffer(signalAad(keys, role, generation)),
      tagLength: BULK_TAG_BYTES * 8,
    },
    keys.signalKey,
    asArrayBuffer(bytes.subarray(BULK_IV_BYTES)),
  );
  return JSON.parse(decoder.decode(plaintext)) as unknown;
}

/* ------------------------------------------------------------------------ */
/* Channel proof                                                             */
/* ------------------------------------------------------------------------ */

export type BulkProofContext = {
  role: BulkRole;
  generation: number;
  senderNonce: string;
  receiverNonce: string;
  /** DTLS certificate fingerprints, exactly as each side saw them in the SDP. */
  senderFingerprint: string;
  receiverFingerprint: string;
};

/**
 * A key-confirmation MAC exchanged as the first thing on an open channel.
 * Both fresh nonces and both certificate fingerprints are inside it, so a proof
 * cannot be replayed into another connection, and it fails if the channel ends
 * at a certificate other than the one the authenticated SDP named.
 */
export async function computeBulkProof(keys: BulkKeys, context: BulkProofContext): Promise<string> {
  const mac = await cryptoRuntime().subtle.sign(
    "HMAC",
    keys.proofKey,
    asArrayBuffer(proofInput(keys, context)),
  );
  return toBase64Url(new Uint8Array(mac));
}

export async function verifyBulkProof(
  keys: BulkKeys,
  context: BulkProofContext,
  mac: string,
): Promise<boolean> {
  let bytes: Uint8Array;
  try {
    bytes = fromBase64Url(mac);
  } catch {
    return false;
  }
  if (bytes.byteLength !== 32) return false;
  // `verify` compares in constant time inside the platform.
  return cryptoRuntime().subtle.verify(
    "HMAC",
    keys.proofKey,
    asArrayBuffer(bytes),
    asArrayBuffer(proofInput(keys, context)),
  );
}

/* ------------------------------------------------------------------------ */
/* Manifest pages                                                            */
/* ------------------------------------------------------------------------ */

export async function sealBulkManifestPage(
  keys: BulkKeys,
  page: number,
  pages: number,
  fileCount: number,
  payload: unknown,
): Promise<string> {
  const iv = cryptoRuntime().getRandomValues(new Uint8Array(BULK_IV_BYTES));
  const ciphertext = new Uint8Array(
    await cryptoRuntime().subtle.encrypt(
      {
        name: "AES-GCM",
        iv: asArrayBuffer(iv),
        additionalData: asArrayBuffer(manifestAad(keys, page, pages, fileCount)),
        tagLength: BULK_TAG_BYTES * 8,
      },
      keys.manifestKey,
      asArrayBuffer(encoder.encode(JSON.stringify(payload))),
    ),
  );
  const out = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  out.set(iv, 0);
  out.set(ciphertext, iv.byteLength);
  return toBase64Url(out);
}

export async function openBulkManifestPage(
  keys: BulkKeys,
  page: number,
  pages: number,
  fileCount: number,
  sealed: string,
): Promise<unknown> {
  const bytes = fromBase64Url(sealed);
  if (bytes.byteLength <= BULK_IV_BYTES + BULK_TAG_BYTES) throw new Error("Invalid manifest");
  const plaintext = await cryptoRuntime().subtle.decrypt(
    {
      name: "AES-GCM",
      iv: asArrayBuffer(bytes.subarray(0, BULK_IV_BYTES)),
      additionalData: asArrayBuffer(manifestAad(keys, page, pages, fileCount)),
      tagLength: BULK_TAG_BYTES * 8,
    },
    keys.manifestKey,
    asArrayBuffer(bytes.subarray(BULK_IV_BYTES)),
  );
  return JSON.parse(decoder.decode(plaintext)) as unknown;
}

/* ------------------------------------------------------------------------ */
/* Content blocks                                                            */
/* ------------------------------------------------------------------------ */

export type BulkBlockContext = { file: number; block: number; blockCount: number };

/**
 * Seals one block as `iv | ciphertext | tag`.
 *
 * The IV is random rather than the block counter. A resumed transfer re-reads
 * and re-seals blocks it already sent; if the source file changed on disk in
 * between, a counter IV would encrypt two different plaintexts under the same
 * key and IV. A random 96-bit IV per block costs twelve bytes in 256 KiB and
 * removes that failure mode entirely.
 */
export async function sealBulkBlock(
  fileKey: CryptoKey,
  keys: BulkKeys,
  context: BulkBlockContext,
  plaintext: Uint8Array,
): Promise<Uint8Array> {
  if (plaintext.byteLength > BULK_BLOCK_BYTES) throw new Error("A block is too large");
  const iv = cryptoRuntime().getRandomValues(new Uint8Array(BULK_IV_BYTES));
  const ciphertext = new Uint8Array(
    await cryptoRuntime().subtle.encrypt(
      {
        name: "AES-GCM",
        iv: asArrayBuffer(iv),
        additionalData: asArrayBuffer(blockAad(keys, context)),
        tagLength: BULK_TAG_BYTES * 8,
      },
      fileKey,
      plaintext.byteOffset === 0 && plaintext.byteLength === plaintext.buffer.byteLength
        ? (plaintext.buffer as ArrayBuffer)
        : asArrayBuffer(plaintext),
    ),
  );
  const out = new Uint8Array(BULK_IV_BYTES + ciphertext.byteLength);
  out.set(iv, 0);
  out.set(ciphertext, BULK_IV_BYTES);
  return out;
}

export async function openBulkBlock(
  fileKey: CryptoKey,
  keys: BulkKeys,
  context: BulkBlockContext,
  sealed: Uint8Array,
): Promise<Uint8Array> {
  if (sealed.byteLength < BULK_IV_BYTES + BULK_TAG_BYTES) throw new Error("A block is truncated");
  const plaintext = await cryptoRuntime().subtle.decrypt(
    {
      name: "AES-GCM",
      iv: asArrayBuffer(sealed.subarray(0, BULK_IV_BYTES)),
      additionalData: asArrayBuffer(blockAad(keys, context)),
      tagLength: BULK_TAG_BYTES * 8,
    },
    fileKey,
    asArrayBuffer(sealed.subarray(BULK_IV_BYTES)),
  );
  return new Uint8Array(plaintext);
}

/** A fresh 32-byte nonce, base64url (43 characters). */
export function bulkNonce(): string {
  return toBase64Url(cryptoRuntime().getRandomValues(new Uint8Array(32)));
}

/* ------------------------------------------------------------------------ */

function hkdf(salt: Uint8Array, label: string): HkdfParams {
  return {
    name: "HKDF",
    hash: "SHA-256",
    salt: asArrayBuffer(salt),
    info: asArrayBuffer(encoder.encode(`${BULK_HKDF_INFO}:${label}`)),
  };
}

function deriveAes(rootKey: CryptoKey, salt: Uint8Array, label: string): Promise<CryptoKey> {
  return cryptoRuntime().subtle.deriveKey(
    hkdf(salt, label),
    rootKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function withDomain(domain: string, keys: BulkKeys, tailBytes: number): [Uint8Array, DataView] {
  const domainBytes = encoder.encode(domain);
  const out = new Uint8Array(domainBytes.byteLength + 1 + keys.roomIdBytes.byteLength + tailBytes);
  out.set(domainBytes, 0);
  out.set(keys.roomIdBytes, domainBytes.byteLength + 1);
  const view = new DataView(out.buffer, domainBytes.byteLength + 1 + keys.roomIdBytes.byteLength);
  return [out, view];
}

function signalAad(keys: BulkKeys, role: BulkRole, generation: number): Uint8Array {
  const [aad, view] = withDomain(SIGNAL_AAD_DOMAIN, keys, 5);
  view.setUint8(0, role === "sender" ? 1 : 2);
  view.setUint32(1, generation, false);
  return aad;
}

function manifestAad(keys: BulkKeys, page: number, pages: number, fileCount: number): Uint8Array {
  const [aad, view] = withDomain(MANIFEST_AAD_DOMAIN, keys, 12);
  view.setUint32(0, page, false);
  view.setUint32(4, pages, false);
  view.setUint32(8, fileCount, false);
  return aad;
}

function blockAad(keys: BulkKeys, context: BulkBlockContext): Uint8Array {
  const [aad, view] = withDomain(BLOCK_AAD_DOMAIN, keys, 12);
  view.setUint32(0, context.file, false);
  view.setUint32(4, context.block, false);
  view.setUint32(8, context.blockCount, false);
  return aad;
}

function proofInput(keys: BulkKeys, context: BulkProofContext): Uint8Array {
  // Length-prefixed fields: no two different contexts can serialize alike.
  const fields = [
    PROOF_DOMAIN,
    keys.roomId,
    context.role,
    String(context.generation),
    context.senderNonce,
    context.receiverNonce,
    context.senderFingerprint,
    context.receiverFingerprint,
  ].map((field) => encoder.encode(field));
  const total = fields.reduce((sum, field) => sum + 4 + field.byteLength, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  let offset = 0;
  for (const field of fields) {
    view.setUint32(offset, field.byteLength, false);
    out.set(field, offset + 4);
    offset += 4 + field.byteLength;
  }
  return out;
}
