import { afterEach, describe, expect, it, vi } from "vitest";

import { convertHangulInBrowser } from "./hangul-browser-conversion";

class FakeHangulWorker {
  public static latest: FakeHangulWorker | undefined;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onerror: (() => void) | null = null;
  public onmessageerror: (() => void) | null = null;
  public terminated = false;
  public posted: { id: number; input: ArrayBuffer } | undefined;

  constructor(public readonly url: string) {
    FakeHangulWorker.latest = this;
  }

  postMessage(message: { id: number; input: ArrayBuffer }) {
    this.posted = message;
  }

  terminate() {
    this.terminated = true;
  }

  reply(value: unknown) {
    this.onmessage?.({ data: value } as MessageEvent);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeHangulWorker.latest = undefined;
});

describe("same-origin HWP/HWPX PDF worker", () => {
  it("transfers a copy and accepts the converted PDF", async () => {
    vi.stubGlobal("Worker", FakeHangulWorker);
    const source = new Uint8Array([1, 2, 3, 4]);
    const pending = convertHangulInBrowser(source);
    const worker = FakeHangulWorker.latest!;
    expect(worker.url).toBe("/hancom-rhwp/convert.worker.js");
    expect([...new Uint8Array(worker.posted!.input)]).toEqual([1, 2, 3, 4]);
    expect([...source]).toEqual([1, 2, 3, 4]);
    const pdf = new TextEncoder().encode("%PDF-1.7");
    worker.reply({ id: 1, ok: true, pdf: pdf.buffer, pageCount: 1 });
    await expect(pending).resolves.toEqual(pdf);
    expect(worker.terminated).toBe(true);
  });

  it("rejects renderer failures instead of claiming printing succeeded", async () => {
    vi.stubGlobal("Worker", FakeHangulWorker);
    const pending = convertHangulInBrowser(new Uint8Array([1, 2]));
    const worker = FakeHangulWorker.latest!;
    worker.reply({ id: 1, ok: false });
    await expect(pending).rejects.toThrow("rejected");
    expect(worker.terminated).toBe(true);
  });

  it("refuses to start if Web Workers are unavailable", async () => {
    vi.stubGlobal("Worker", undefined);
    await expect(convertHangulInBrowser(new Uint8Array([1]))).rejects.toThrow(
      "Browser workers are unavailable",
    );
  });
});
