import { bulkNonce, openBulkSignal, sealBulkSignal, type BulkKeys } from "@print-cess/crypto";
import {
  bulkAnswerPayloadSchema,
  bulkOfferPayloadSchema,
  type BulkIceServer,
} from "@print-cess/protocol";

import { ApiClientError } from "../api-client";
import { wrapDataChannel, type BulkChannel } from "./channel";
import { runHandshake, sdpFingerprint, type HandshakeResult } from "./handshake";
import {
  createBulkRoom,
  pollBulkAnswer,
  postBulkAnswer,
  postBulkOffer,
  readBulkRoom,
} from "./signal-client";

/**
 * Establishes the direct channel. The mailbox only ever sees sealed SDP; the
 * SDP inside carries each browser's DTLS certificate fingerprint, so opening
 * the envelope successfully is what authenticates the certificate the channel
 * then terminates at. The handshake afterwards confirms it from inside.
 *
 * ICE candidates are gathered completely before the description is sealed
 * (no trickle), so a connection costs exactly one offer write and one answer
 * write — the cheapest possible use of the signalling store.
 */

export type LinkRoute = "direct" | "relay";

export type PeerLink = {
  pc: RTCPeerConnection;
  channel: BulkChannel;
  handshake: HandshakeResult;
  generation: number;
  route: () => Promise<LinkRoute>;
  close(): void;
};

export class BulkConnectError extends Error {
  public constructor(
    public readonly reason:
      | "notFound"
      | "taken"
      | "badAnswer"
      | "timeout"
      | "superseded"
      | "unsupported"
      | "network"
      | "handshake"
      | "aborted",
  ) {
    super(`Bulk connection failed: ${reason}`);
    this.name = "BulkConnectError";
  }
}

const CHANNEL_LABEL = "print-cess-bulk";

export function supportsDirectTransfer(): boolean {
  return typeof RTCPeerConnection === "function";
}

export async function connectAsSender(input: {
  keys: BulkKeys;
  ownerToken: string;
  ownerTokenHash: string;
  iceServers: BulkIceServer[];
  generation: number;
  signal: AbortSignal;
  onWaiting?: () => void;
}): Promise<PeerLink> {
  if (!supportsDirectTransfer()) throw new BulkConnectError("unsupported");
  const pc = new RTCPeerConnection({ iceServers: input.iceServers });
  const closeOnAbort = () => pc.close();
  input.signal.addEventListener("abort", closeOnAbort, { once: true });
  try {
    const dataChannel = pc.createDataChannel(CHANNEL_LABEL, { ordered: true });
    await pc.setLocalDescription(await pc.createOffer());
    await gatheringComplete(pc, input.signal);
    const localSdp = pc.localDescription?.sdp ?? "";
    const senderFingerprint = sdpFingerprint(localSdp);
    if (!senderFingerprint) throw new BulkConnectError("unsupported");

    const nonce = bulkNonce();
    const offer = await sealBulkSignal(input.keys, "sender", input.generation, {
      v: 2,
      kind: "offer",
      generation: input.generation,
      nonce,
      sdp: localSdp,
    });
    await withNetworkErrors(() =>
      input.generation === 1
        ? createBulkRoom(
            { roomId: input.keys.roomId, ownerTokenHash: input.ownerTokenHash, offer },
            input.signal,
          )
        : postBulkOffer(input.keys.roomId, input.ownerToken, input.generation, offer, input.signal),
    );
    input.onWaiting?.();

    // Wait for the receiving browser. No deadline: a person may take a minute
    // to open their camera. The room's own expiry bounds the wait.
    let sealedAnswer: string | null = null;
    for (let attempt = 0; sealedAnswer === null; attempt += 1) {
      await sleep(attempt < 30 ? 1000 : 2500, input.signal);
      const view = await withNetworkErrors(() =>
        pollBulkAnswer(input.keys.roomId, input.ownerToken, input.signal),
      ).catch((error: unknown) => {
        if (error instanceof BulkConnectError && error.reason === "network") return null;
        throw error;
      });
      if (!view) continue;
      if (view.generation !== input.generation) throw new BulkConnectError("superseded");
      sealedAnswer = view.answer;
    }

    let answer;
    try {
      answer = bulkAnswerPayloadSchema.parse(
        await openBulkSignal(input.keys, "receiver", input.generation, sealedAnswer),
      );
    } catch {
      // Someone without the code wrote into the mailbox. Start a new generation.
      throw new BulkConnectError("badAnswer");
    }
    if (answer.offerNonce !== nonce || answer.generation !== input.generation) {
      throw new BulkConnectError("badAnswer");
    }
    const receiverFingerprint = sdpFingerprint(answer.sdp);
    if (!receiverFingerprint) throw new BulkConnectError("badAnswer");
    await pc.setRemoteDescription({ type: "answer", sdp: answer.sdp });
    await channelOpen(dataChannel, input.signal);
    const channel = wrapDataChannel(dataChannel, pc);
    const handshake = await runHandshake(channel, {
      keys: input.keys,
      role: "sender",
      generation: input.generation,
      senderFingerprint,
      receiverFingerprint,
    }).catch(() => {
      throw new BulkConnectError("handshake");
    });
    return link(pc, channel, handshake, input.generation);
  } catch (error) {
    pc.close();
    if (input.signal.aborted) throw new BulkConnectError("aborted");
    throw error;
  } finally {
    input.signal.removeEventListener("abort", closeOnAbort);
  }
}

export async function connectAsReceiver(input: {
  keys: BulkKeys;
  iceServers: BulkIceServer[];
  /** Generations below this were already used; wait for a newer offer. */
  minGeneration: number;
  signal: AbortSignal;
  /** How long to wait for a room to appear before reporting it missing (first connection). */
  notFoundAfterMs?: number;
}): Promise<PeerLink> {
  if (!supportsDirectTransfer()) throw new BulkConnectError("unsupported");
  const started = Date.now();
  let view = null;
  for (let attempt = 0; ; attempt += 1) {
    view = await withNetworkErrors(() => readBulkRoom(input.keys.roomId, input.signal)).catch(
      (error: unknown) => {
        if (error instanceof BulkConnectError && error.reason === "network") return undefined;
        throw error;
      },
    );
    if (
      view === null &&
      input.notFoundAfterMs !== undefined &&
      Date.now() - started > input.notFoundAfterMs
    ) {
      throw new BulkConnectError("notFound");
    }
    if (view && view.generation >= input.minGeneration) {
      if (!view.answered) break;
      // The first connection was answered by someone else: this code is taken.
      if (input.minGeneration === 1 && view.generation === 1) throw new BulkConnectError("taken");
    }
    await sleep(attempt < 20 ? 1000 : 2500, input.signal);
  }
  const generation = view.generation;

  let offer;
  try {
    offer = bulkOfferPayloadSchema.parse(
      await openBulkSignal(input.keys, "sender", generation, view.offer),
    );
  } catch {
    throw new BulkConnectError("notFound");
  }
  if (offer.generation !== generation) throw new BulkConnectError("notFound");
  const senderFingerprint = sdpFingerprint(offer.sdp);
  if (!senderFingerprint) throw new BulkConnectError("notFound");

  const pc = new RTCPeerConnection({ iceServers: input.iceServers });
  const closeOnAbort = () => pc.close();
  input.signal.addEventListener("abort", closeOnAbort, { once: true });
  try {
    const incoming = new Promise<RTCDataChannel>((resolve) => {
      pc.addEventListener("datachannel", (event) => {
        if (event.channel.label === CHANNEL_LABEL) resolve(event.channel);
      });
    });
    await pc.setRemoteDescription({ type: "offer", sdp: offer.sdp });
    await pc.setLocalDescription(await pc.createAnswer());
    await gatheringComplete(pc, input.signal);
    const localSdp = pc.localDescription?.sdp ?? "";
    const receiverFingerprint = sdpFingerprint(localSdp);
    if (!receiverFingerprint) throw new BulkConnectError("unsupported");
    const answer = await sealBulkSignal(input.keys, "receiver", generation, {
      v: 2,
      kind: "answer",
      generation,
      offerNonce: offer.nonce,
      nonce: bulkNonce(),
      sdp: localSdp,
    });
    try {
      await postBulkAnswer(input.keys.roomId, generation, answer, input.signal);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 409) {
        throw new BulkConnectError(generation === 1 ? "taken" : "superseded");
      }
      if (error instanceof ApiClientError && error.status === 404) {
        throw new BulkConnectError("notFound");
      }
      throw new BulkConnectError("network");
    }
    const dataChannel = await raceTimeout(incoming, 30_000, input.signal);
    await channelOpen(dataChannel, input.signal);
    const channel = wrapDataChannel(dataChannel, pc);
    const handshake = await runHandshake(channel, {
      keys: input.keys,
      role: "receiver",
      generation,
      senderFingerprint,
      receiverFingerprint,
    }).catch(() => {
      throw new BulkConnectError("handshake");
    });
    return link(pc, channel, handshake, generation);
  } catch (error) {
    pc.close();
    if (input.signal.aborted) throw new BulkConnectError("aborted");
    throw error;
  } finally {
    input.signal.removeEventListener("abort", closeOnAbort);
  }
}

function link(
  pc: RTCPeerConnection,
  channel: BulkChannel,
  handshake: HandshakeResult,
  generation: number,
): PeerLink {
  // ICE "failed" never recovers; "disconnected" sometimes does. Give it a
  // moment, then close the channel so the engine detaches and a new
  // generation is negotiated.
  let disconnectTimer: ReturnType<typeof setTimeout> | undefined;
  pc.addEventListener("connectionstatechange", () => {
    if (pc.connectionState === "failed" || pc.connectionState === "closed") {
      channel.close();
    } else if (pc.connectionState === "disconnected") {
      disconnectTimer ??= setTimeout(() => {
        if (pc.connectionState !== "connected") channel.close();
      }, 8000);
    } else if (pc.connectionState === "connected" && disconnectTimer !== undefined) {
      clearTimeout(disconnectTimer);
      disconnectTimer = undefined;
    }
  });
  return {
    pc,
    channel,
    handshake,
    generation,
    route: () => selectedRoute(pc),
    close() {
      if (disconnectTimer !== undefined) clearTimeout(disconnectTimer);
      channel.close();
      pc.close();
    },
  };
}

/** Whether the selected candidate pair runs through a TURN relay. */
async function selectedRoute(pc: RTCPeerConnection): Promise<LinkRoute> {
  try {
    const stats = await pc.getStats();
    let pairId: string | undefined;
    stats.forEach((report: { type: string; selectedCandidatePairId?: string }) => {
      if (report.type === "transport" && report.selectedCandidatePairId) {
        pairId = report.selectedCandidatePairId;
      }
    });
    let localId: string | undefined;
    let remoteId: string | undefined;
    stats.forEach(
      (report: {
        type: string;
        id: string;
        selected?: boolean;
        nominated?: boolean;
        state?: string;
        localCandidateId?: string;
        remoteCandidateId?: string;
      }) => {
        if (report.type !== "candidate-pair") return;
        if (report.id === pairId || (!pairId && report.selected)) {
          localId = report.localCandidateId;
          remoteId = report.remoteCandidateId;
        }
      },
    );
    let relay = false;
    stats.forEach((report: { id: string; candidateType?: string }) => {
      if ((report.id === localId || report.id === remoteId) && report.candidateType === "relay") {
        relay = true;
      }
    });
    return relay ? "relay" : "direct";
  } catch {
    return "direct";
  }
}

function gatheringComplete(
  pc: RTCPeerConnection,
  signal: AbortSignal,
  timeoutMs = 5000,
): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      pc.removeEventListener("icegatheringstatechange", check);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const check = () => {
      if (pc.iceGatheringState === "complete") done();
    };
    // A slow STUN server must not hold the page hostage: whatever candidates
    // exist after a few seconds are enough to try.
    const timer = setTimeout(done, timeoutMs);
    pc.addEventListener("icegatheringstatechange", check);
    signal.addEventListener("abort", done, { once: true });
  });
}

function channelOpen(channel: RTCDataChannel, signal: AbortSignal): Promise<void> {
  if (channel.readyState === "open") return Promise.resolve();
  return raceTimeout(
    new Promise<void>((resolve, reject) => {
      channel.addEventListener("open", () => resolve(), { once: true });
      channel.addEventListener("close", () => reject(new BulkConnectError("timeout")), {
        once: true,
      });
    }),
    30_000,
    signal,
  );
}

function raceTimeout<T>(promise: Promise<T>, ms: number, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new BulkConnectError("timeout")), ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new BulkConnectError("aborted"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

async function withNetworkErrors<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof ApiClientError) {
      if (error.status === 404 || error.status === 410) throw new BulkConnectError("notFound");
      if (error.status === 409) throw new BulkConnectError("superseded");
      if (error.status === 429) throw new BulkConnectError("network");
      if (error.status === 401) throw new BulkConnectError("notFound");
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new BulkConnectError("aborted");
    }
    throw new BulkConnectError("network");
  }
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new BulkConnectError("aborted"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new BulkConnectError("aborted"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
