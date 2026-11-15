/**
 * The slice of `RTCDataChannel` the transfer engine depends on. Keeping the
 * engine behind this interface is what lets the same code run over a real
 * WebRTC channel in a browser and over an in-memory pair in unit tests and
 * benchmarks, where a peer connection does not exist.
 */
export interface BulkChannel {
  send(data: string | Uint8Array): void;
  readonly bufferedAmount: number;
  bufferedAmountLowThreshold: number;
  /** Largest message the peer will accept, from SCTP negotiation. */
  readonly maxMessageSize: number;
  readonly isOpen: boolean;
  onMessage(listener: (data: string | Uint8Array) => void): () => void;
  onBufferedAmountLow(listener: () => void): () => void;
  onClose(listener: () => void): () => void;
  close(): void;
}

export class ChannelClosedError extends Error {
  public constructor() {
    super("The data channel closed");
    this.name = "ChannelClosedError";
  }
}

/**
 * Resolves once the channel's send buffer has drained below its low-water
 * threshold. This is the sender's half of backpressure: nothing is queued
 * above the high-water mark, so a slow link costs a bounded amount of memory
 * instead of an ever-growing browser buffer.
 */
export function waitForDrain(channel: BulkChannel, signal?: AbortSignal): Promise<void> {
  if (channel.bufferedAmount <= channel.bufferedAmountLowThreshold) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      offLow();
      offClose();
      signal?.removeEventListener("abort", onAbort);
    };
    const offLow = channel.onBufferedAmountLow(() => {
      cleanup();
      resolve();
    });
    const offClose = channel.onClose(() => {
      cleanup();
      reject(new ChannelClosedError());
    });
    const onAbort = () => {
      cleanup();
      reject(new ChannelClosedError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Adapts a real `RTCDataChannel`. */
export function wrapDataChannel(channel: RTCDataChannel, pc: RTCPeerConnection): BulkChannel {
  channel.binaryType = "arraybuffer";
  return {
    send(data) {
      if (typeof data === "string") channel.send(data);
      else channel.send(data as Uint8Array<ArrayBuffer>);
    },
    get bufferedAmount() {
      return channel.bufferedAmount;
    },
    get bufferedAmountLowThreshold() {
      return channel.bufferedAmountLowThreshold;
    },
    set bufferedAmountLowThreshold(value: number) {
      channel.bufferedAmountLowThreshold = value;
    },
    get maxMessageSize() {
      const negotiated = pc.sctp?.maxMessageSize;
      return typeof negotiated === "number" && negotiated > 0 ? negotiated : 64 * 1024;
    },
    get isOpen() {
      return channel.readyState === "open";
    },
    onMessage(listener) {
      const handler = (event: MessageEvent) => {
        const { data } = event;
        if (typeof data === "string") listener(data);
        else if (data instanceof ArrayBuffer) listener(new Uint8Array(data));
      };
      channel.addEventListener("message", handler);
      return () => channel.removeEventListener("message", handler);
    },
    onBufferedAmountLow(listener) {
      channel.addEventListener("bufferedamountlow", listener);
      return () => channel.removeEventListener("bufferedamountlow", listener);
    },
    onClose(listener) {
      const handler = () => listener();
      channel.addEventListener("close", handler);
      channel.addEventListener("error", handler);
      return () => {
        channel.removeEventListener("close", handler);
        channel.removeEventListener("error", handler);
      };
    },
    close() {
      channel.close();
    },
  };
}
