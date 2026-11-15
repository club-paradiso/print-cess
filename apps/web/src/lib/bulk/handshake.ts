import {
  bulkNonce,
  computeBulkProof,
  verifyBulkProof,
  type BulkKeys,
  type BulkProofContext,
} from "@print-cess/crypto";
import { parseBulkControl, type BulkRole } from "@print-cess/protocol";

import type { BulkChannel } from "./channel";

export class BulkHandshakeError extends Error {
  public constructor(public readonly reason: "timeout" | "proof" | "protocol" | "closed") {
    super(`Bulk handshake failed: ${reason}`);
    this.name = "BulkHandshakeError";
  }
}

export type HandshakeInput = {
  keys: BulkKeys;
  role: BulkRole;
  generation: number;
  /** DTLS fingerprints from the authenticated SDP pair. */
  senderFingerprint: string;
  receiverFingerprint: string;
  timeoutMs?: number;
};

/**
 * Key confirmation over a freshly opened channel. Each side sends a fresh
 * nonce, then a MAC over both nonces, both certificate fingerprints, the room
 * and the generation. Neither side sends a file list or a byte of content until
 * the other's MAC verifies, so a channel that somehow ends at the wrong peer —
 * one that does not hold the transfer code — carries nothing.
 */
export type HandshakeResult = {
  /**
   * Hands the channel's message stream to the engine. Messages the peer sent
   * after its own proof verified — typically the first manifest page — arrive
   * before this side has necessarily finished verifying, so they are held and
   * replayed in order rather than dropped or mistaken for a protocol error.
   */
  takeOver(listener: (data: string | Uint8Array) => void): () => void;
};

export async function runHandshake(
  channel: BulkChannel,
  input: HandshakeInput,
): Promise<HandshakeResult> {
  const ownNonce = bulkNonce();
  const peerRole: BulkRole = input.role === "sender" ? "receiver" : "sender";
  let peerNonce: string | null = null;
  let peerMac: string | null = null;
  const held: (string | Uint8Array)[] = [];
  let forward: ((data: string | Uint8Array) => void) | null = null;
  let verified = false;
  let offMessage: () => void = () => {};

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: BulkHandshakeError) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      offClose();
      if (error) {
        offMessage();
        reject(error);
      } else {
        verified = true;
        resolve();
      }
    };
    const timer = setTimeout(
      () => finish(new BulkHandshakeError("timeout")),
      input.timeoutMs ?? 15_000,
    );
    const offClose = channel.onClose(() => finish(new BulkHandshakeError("closed")));

    const context = (): BulkProofContext => ({
      role: input.role,
      generation: input.generation,
      senderNonce: input.role === "sender" ? ownNonce : (peerNonce ?? ""),
      receiverNonce: input.role === "receiver" ? ownNonce : (peerNonce ?? ""),
      senderFingerprint: input.senderFingerprint,
      receiverFingerprint: input.receiverFingerprint,
    });

    const tryVerify = async () => {
      if (!peerNonce || !peerMac) return;
      const ok = await verifyBulkProof(input.keys, { ...context(), role: peerRole }, peerMac);
      finish(ok ? undefined : new BulkHandshakeError("proof"));
    };

    offMessage = channel.onMessage((data) => {
      if (verified) {
        if (forward) forward(data);
        else held.push(data);
        return;
      }
      if (settled) return;
      if (peerMac !== null) {
        // The peer has proved itself and moved on; keep what it sent next.
        held.push(data);
        return;
      }
      if (typeof data !== "string") {
        finish(new BulkHandshakeError("protocol"));
        return;
      }
      const message = parseBulkControl(data);
      if (message?.t === "hello" && message.role === peerRole && peerNonce === null) {
        peerNonce = message.nonce;
        void computeBulkProof(input.keys, context()).then((mac) => {
          if (!settled) channel.send(JSON.stringify({ t: "proof", mac }));
          return tryVerify();
        });
        return;
      }
      if (message?.t === "proof" && peerMac === null) {
        peerMac = message.mac;
        void tryVerify();
        return;
      }
      finish(new BulkHandshakeError("protocol"));
    });

    channel.send(JSON.stringify({ t: "hello", role: input.role, nonce: ownNonce }));
  });

  return {
    takeOver(listener) {
      forward = listener;
      for (const data of held.splice(0)) listener(data);
      return () => {
        forward = null;
        offMessage();
      };
    },
  };
}

/** Reads the first DTLS fingerprint an SDP declares, normalized. */
export function sdpFingerprint(sdp: string): string | null {
  const match = /^a=fingerprint:([A-Za-z0-9-]+) ([0-9A-Fa-f:]+)\s*$/mu.exec(sdp);
  if (!match?.[1] || !match[2]) return null;
  return `${match[1].toLowerCase()} ${match[2].toUpperCase()}`;
}
