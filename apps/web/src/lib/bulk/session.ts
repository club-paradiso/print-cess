import {
  deriveBulkKeys,
  generateDropCode,
  generateToken,
  hashToken,
  type BulkKeys,
} from "@print-cess/crypto";
import { BULK_MAX_GENERATIONS, type BulkIceServer } from "@print-cess/protocol";

import { BulkReceiver, type ReceiverOptions } from "./receiver";
import { BulkSender, type SenderOptions } from "./sender";
import { deleteBulkRoom, pollBulkAnswer } from "./signal-client";
import {
  BulkConnectError,
  connectAsReceiver,
  connectAsSender,
  sleep,
  type PeerLink,
} from "./webrtc";

/**
 * What the network indicator shows. Each value is something the page actually
 * observed: `direct` and `relay` come from the selected ICE candidate pair,
 * `disconnected` from a closed channel, never from a timer guessing.
 */
export type LinkState =
  "preparing" | "waiting" | "connecting" | "direct" | "relay" | "disconnected" | "failed";

export type SessionFailure = "expired" | "taken" | "unsupported" | "notFound" | "tooManyRetries";

/**
 * Outside Production builds only, end-to-end tests can drop the live channel
 * to exercise reconnection, exactly as the send screen exposes its transfer
 * code to tests outside Production.
 */
function exposeTestSeam(link: PeerLink): void {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return;
  (window as unknown as { __printCessBulkDropLink?: () => void }).__printCessBulkDropLink = () =>
    link.pc.close();
}

/** Well inside the room's 30-minute sliding expiry. */
const KEEP_ALIVE_MS = 5 * 60_000;

/**
 * Waits for the send buffer to empty. A cancel message is queued behind any
 * data already buffered; closing at once would discard it with the data, and
 * the other device would see a lost connection instead of a cancellation.
 */
async function drained(link: PeerLink, limitMs = 3000): Promise<void> {
  for (let waited = 0; waited < limitMs; waited += 50) {
    if (!link.channel.isOpen || link.channel.bufferedAmount === 0) break;
    await sleep(50).catch(() => undefined);
  }
  // One more beat for the last message to leave the SCTP queue.
  await sleep(150).catch(() => undefined);
}

export function buildBulkLink(origin: string, code: string): string {
  return `${origin}/bulk/receive#c=${code}`;
}

/** Drives one sender through first connection, transfer, and any reconnections. */
type SendSessionOptions = Omit<SenderOptions, "keys"> & {
  iceServers: BulkIceServer[];
  /** The other device cancelled. */
  onRemoteCancel?: () => void;
  onLinkState: (state: LinkState) => void;
  onFailure: (failure: SessionFailure) => void;
};

export class BulkSendSession {
  public readonly engine: BulkSender;
  readonly #controller = new AbortController();
  readonly #keys: BulkKeys;
  readonly #ownerToken = generateToken(32);
  #link: PeerLink | null = null;
  #stopped = false;

  private constructor(
    public readonly code: string,
    keys: BulkKeys,
    private readonly options: SendSessionOptions,
  ) {
    this.#keys = keys;
    this.engine = new BulkSender({ ...options, keys });
  }

  /** Draws a fresh transfer code and stretches it; the code never leaves this browser except in the QR. */
  public static async create(options: SendSessionOptions, code = generateDropCode()) {
    return new BulkSendSession(code, await deriveBulkKeys(code), options);
  }

  public async run(): Promise<void> {
    const keys = this.#keys;
    const ownerTokenHash = await hashToken(this.#ownerToken, "bulk");
    const signal = this.#controller.signal;
    let generation = 1;
    let failures = 0;
    this.options.onLinkState("preparing");
    while (!this.#stopped && generation <= BULK_MAX_GENERATIONS) {
      try {
        this.options.onLinkState(generation === 1 ? "preparing" : "disconnected");
        const link = await connectAsSender({
          keys,
          ownerToken: this.#ownerToken,
          ownerTokenHash,
          iceServers: this.options.iceServers,
          generation,
          signal,
          onWaiting: () => this.options.onLinkState(generation === 1 ? "waiting" : "disconnected"),
        });
        this.#link = link;
        failures = 0;
        exposeTestSeam(link);
        this.options.onLinkState(await link.route());
        // A long transfer must still be able to reconnect: keep the room alive
        // (a cheap owner read that slides its expiry) while the channel is up.
        const keepAlive = setInterval(() => {
          void pollBulkAnswer(keys.roomId, this.#ownerToken, signal).catch(() => undefined);
        }, KEEP_ALIVE_MS);
        const outcome = await this.engine
          .attach(link.channel, link.handshake)
          .finally(() => clearInterval(keepAlive));
        if (outcome === "cancelled") await drained(link);
        link.close();
        this.#link = null;
        if (outcome === "cancelled") {
          if (!this.#stopped) this.options.onRemoteCancel?.();
          break;
        }
        this.options.onLinkState("disconnected");
      } catch (error) {
        if (!(error instanceof BulkConnectError)) throw error;
        if (error.reason === "aborted") break;
        if (error.reason === "unsupported") {
          this.options.onFailure("unsupported");
          this.options.onLinkState("failed");
          return;
        }
        if (error.reason === "notFound") {
          this.options.onFailure("expired");
          this.options.onLinkState("failed");
          return;
        }
        failures += 1;
        if (failures > 12) {
          this.options.onFailure("tooManyRetries");
          this.options.onLinkState("failed");
          return;
        }
        await sleep(Math.min(8000, 500 * 2 ** Math.min(failures, 4)), signal).catch(
          () => undefined,
        );
      }
      generation += 1;
    }
  }

  public cancel(): void {
    this.engine.cancel();
  }

  /** Ends the session and deletes the signalling room. */
  public async stop(): Promise<void> {
    this.#stopped = true;
    this.engine.cancel();
    if (this.#link) await drained(this.#link);
    this.#link?.close();
    this.#controller.abort();
    await deleteBulkRoom(this.#keys.roomId, this.#ownerToken);
  }
}

/** Drives one receiver through first connection, transfer, and any reconnections. */
export class BulkReceiveSession {
  public readonly engine: BulkReceiver;
  readonly #controller = new AbortController();
  #link: PeerLink | null = null;
  #stopped = false;

  public constructor(
    private readonly keys: BulkKeys,
    private readonly options: Omit<ReceiverOptions, "keys"> & {
      iceServers: BulkIceServer[];
      onRemoteCancel?: () => void;
      onLinkState: (state: LinkState) => void;
      onFailure: (failure: SessionFailure) => void;
    },
  ) {
    this.engine = new BulkReceiver({ ...options, keys });
    if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
      (window as unknown as { __printCessBulkReceiver?: BulkReceiver }).__printCessBulkReceiver =
        this.engine;
    }
  }

  public async run(): Promise<void> {
    const signal = this.#controller.signal;
    let minGeneration = 1;
    let failures = 0;
    while (!this.#stopped) {
      try {
        this.options.onLinkState(minGeneration === 1 ? "connecting" : "disconnected");
        const link = await connectAsReceiver({
          keys: this.keys,
          iceServers: this.options.iceServers,
          minGeneration,
          signal,
          ...(minGeneration === 1 ? { notFoundAfterMs: 20_000 } : {}),
        });
        this.#link = link;
        failures = 0;
        minGeneration = link.generation + 1;
        this.options.onLinkState(await link.route());
        const outcome = await this.engine.attach(link.channel, link.handshake);
        link.close();
        this.#link = null;
        if (outcome === "cancelled") {
          if (!this.#stopped && !this.#localCancel) this.options.onRemoteCancel?.();
          break;
        }
        if (outcome === "rejected") {
          this.options.onFailure("notFound");
          this.options.onLinkState("failed");
          return;
        }
        this.options.onLinkState("disconnected");
      } catch (error) {
        if (!(error instanceof BulkConnectError)) throw error;
        if (error.reason === "aborted") break;
        if (error.reason === "unsupported" || error.reason === "taken") {
          this.options.onFailure(error.reason);
          this.options.onLinkState("failed");
          return;
        }
        if (error.reason === "notFound" && minGeneration === 1) {
          this.options.onFailure("notFound");
          this.options.onLinkState("failed");
          return;
        }
        if (error.reason === "notFound") {
          // The sender closed or the room expired after a transfer began.
          this.options.onFailure("expired");
          this.options.onLinkState("failed");
          return;
        }
        failures += 1;
        if (failures > 12) {
          this.options.onFailure("tooManyRetries");
          this.options.onLinkState("failed");
          return;
        }
        await sleep(Math.min(8000, 500 * 2 ** Math.min(failures, 4)), signal).catch(
          () => undefined,
        );
      }
    }
  }

  #localCancel = false;

  /** Cancels from this side: the sender is told, the active file is discarded. */
  public async cancel(): Promise<void> {
    this.#localCancel = true;
    await this.engine.cancel();
  }

  public async stop(): Promise<void> {
    this.#stopped = true;
    this.#link?.close();
    this.#controller.abort();
  }
}
