const HANGUL_WORKER_URL = "/hancom-rhwp/convert.worker.js";
const HANGUL_CONVERSION_TIMEOUT_MS = 150_000;

type HangulWorkerResponse = {
  id?: number;
  ok?: boolean;
  pdf?: ArrayBuffer;
  pageCount?: number;
};

/**
 * Converts HWP/HWPX locally before the existing encrypted PDF print protocol.
 * All renderer/font assets are same-origin and pinned during deployment.
 * A dedicated worker bounds stalls and keeps synchronous WASM work off the UI.
 */
export async function convertHangulInBrowser(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof Worker === "undefined") throw new Error("Browser workers are unavailable");
  if (bytes.byteLength < 1) throw new Error("No Hangul document bytes");
  const worker = new Worker(HANGUL_WORKER_URL);
  return new Promise<Uint8Array>((resolve, reject) => {
    let finished = false;
    const close = () => {
      if (finished) return false;
      finished = true;
      clearTimeout(timeout);
      worker.terminate();
      return true;
    };
    const timeout = setTimeout(() => {
      if (close()) reject(new Error("Hangul rendering timed out"));
    }, HANGUL_CONVERSION_TIMEOUT_MS);
    worker.onmessage = (event: MessageEvent<HangulWorkerResponse>) => {
      const payload = event.data;
      if (payload?.id !== 1) return;
      if (
        !payload.ok ||
        !(payload.pdf instanceof ArrayBuffer) ||
        !Number.isSafeInteger(payload.pageCount) ||
        (payload.pageCount ?? 0) < 1
      ) {
        if (close()) reject(new Error("Hangul renderer rejected the document"));
        return;
      }
      if (close()) resolve(new Uint8Array(payload.pdf));
    };
    worker.onerror = () => {
      if (close()) reject(new Error("Hangul renderer did not start"));
    };
    worker.onmessageerror = () => {
      if (close()) reject(new Error("Hangul renderer returned an invalid response"));
    };

    try {
      // Retain a separate local source so the caller can clear sensitive bytes
      // even if the worker is killed or throws before it can wipe its copy.
      const input = Uint8Array.from(bytes);
      worker.postMessage({ id: 1, input: input.buffer }, [input.buffer]);
    } catch {
      if (close()) reject(new Error("Hangul renderer could not receive the document"));
    }
  });
}
