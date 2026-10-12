// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  createPrintArtifact,
  printArtifact,
  printArtifacts,
  revokePrintArtifact,
  type PrintArtifact,
} from "@/lib/kiosk-print";

type PickerWindow = Window & {
  showSaveFilePicker?: unknown;
  showDirectoryPicker?: unknown;
  showOpenFilePicker?: unknown;
};

function artifactOf(fileKind: "pdf" | "png" | "jpeg", url = `blob:print-cess-${fileKind}`) {
  const metadata = {
    pdf: ["print-cess-document.pdf", "application/pdf"],
    png: ["print-cess-document.png", "image/png"],
    jpeg: ["print-cess-document.jpg", "image/jpeg"],
  }[fileKind];
  return { url, filename: metadata[0], mimeType: metadata[1], fileKind } satisfies PrintArtifact;
}

/** Replaces the print frame's `focus` and `print` so a test can observe them. */
function spyOnFrame(frame: HTMLIFrameElement, calls: string[], label: string) {
  const printableWindow = frame.contentWindow;
  Object.defineProperty(printableWindow, "focus", { configurable: true, value: () => undefined });
  Object.defineProperty(printableWindow, "print", {
    configurable: true,
    value: () => calls.push(label),
  });
}

/**
 * Lets the pending print reach its next step: the frame is appended and its
 * load handler registered only after the microtask queue has run.
 */
async function nextFrame(): Promise<HTMLIFrameElement> {
  await vi.advanceTimersByTimeAsync(0);
  const frames = document.querySelectorAll("iframe");
  const frame = frames[frames.length - 1];
  if (!frame) throw new Error("no print frame");
  return frame;
}

/** Finishes loading whichever document the frame holds. */
async function loadFrame(frame: HTMLIFrameElement) {
  const image = frame.contentDocument?.querySelector("img");
  if (image) image.dispatchEvent(new Event("load"));
  else frame.dispatchEvent(new Event("load"));
  // A PDF frame waits a short settle delay after its load event.
  await vi.advanceTimersByTimeAsync(250);
}

describe("browser kiosk printing", () => {
  const createObjectURL = vi.fn(() => "blob:print-cess-test");
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.useRealTimers();
  });

  test.each([
    ["pdf", "application/pdf", "print-cess-document.pdf"],
    ["jpeg", "image/jpeg", "print-cess-document.jpg"],
    ["png", "image/png", "print-cess-document.png"],
  ] as const)("creates and revokes a %s download", (fileKind, mimeType, filename) => {
    const artifact = createPrintArtifact(new Uint8Array([1, 2, 3]), fileKind);

    expect(artifact).toEqual({
      url: "blob:print-cess-test",
      filename,
      mimeType,
      fileKind,
    });
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(createObjectURL.mock.calls[0]?.[0]).toBeInstanceOf(Blob);

    revokePrintArtifact(artifact);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:print-cess-test");
  });

  test("prints an image from an isolated A4 frame", async () => {
    vi.useFakeTimers();
    const artifact: PrintArtifact = {
      url: "blob:print-cess-image",
      filename: "print-cess-document.png",
      mimeType: "image/png",
      fileKind: "png",
    };

    const pending = printArtifact(artifact);
    const frame = document.querySelector("iframe");
    const printableWindow = frame?.contentWindow;
    const image = frame?.contentDocument?.querySelector("img");
    expect(frame).toBeInstanceOf(HTMLIFrameElement);
    expect(image?.src).toBe("blob:print-cess-image");
    expect(frame?.contentDocument?.querySelector("style")?.textContent).toContain("@page");

    const focus = vi.fn();
    const print = vi.fn();
    Object.defineProperty(printableWindow, "focus", { configurable: true, value: focus });
    Object.defineProperty(printableWindow, "print", { configurable: true, value: print });
    image?.dispatchEvent(new Event("load"));
    await pending;

    expect(focus).toHaveBeenCalledOnce();
    expect(print).toHaveBeenCalledOnce();
    await vi.runAllTimersAsync();
    expect(document.querySelector("iframe")).toBeNull();
  });

  test("prints a PDF only after its frame has loaded", async () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    const pending = printArtifact(artifactOf("pdf"));
    const frame = await nextFrame();
    expect(frame.getAttribute("src")).toBe("blob:print-cess-pdf");
    spyOnFrame(frame, calls, "pdf");

    expect(calls).toEqual([]);
    await loadFrame(frame);
    await pending;

    expect(calls).toEqual(["pdf"]);
  });

  test.each([
    ["error", (frame: HTMLIFrameElement) => frame.dispatchEvent(new Event("error"))],
    ["timeout", () => vi.advanceTimersByTimeAsync(15_000)],
  ] as const)(
    "rejects without opening a print dialog when the PDF frame fails (%s)",
    async (_, fail) => {
      vi.useFakeTimers();
      const calls: string[] = [];
      const pending = printArtifact(artifactOf("pdf"));
      const outcome = pending.then(
        () => "printed",
        () => "rejected",
      );
      const frame = await nextFrame();
      spyOnFrame(frame, calls, "pdf");

      await fail(frame);

      // A caller must never turn this into a completed session.
      await expect(outcome).resolves.toBe("rejected");
      expect(calls).toEqual([]);
      await vi.runAllTimersAsync();
      expect(document.querySelector("iframe")).toBeNull();
    },
  );

  test("rejects without opening a print dialog when an image fails to load", async () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    const pending = printArtifact(artifactOf("png"));
    const outcome = pending.then(
      () => "printed",
      () => "rejected",
    );
    const frame = await nextFrame();
    spyOnFrame(frame, calls, "png");

    frame.contentDocument?.querySelector("img")?.dispatchEvent(new Event("error"));

    await expect(outcome).resolves.toBe("rejected");
    expect(calls).toEqual([]);
  });

  test("refuses Hancom formats before touching the page", async () => {
    await expect(
      printArtifact({ ...artifactOf("pdf"), fileKind: "hwpx", mimeType: "application/hwp+zip" }),
    ).rejects.toThrow(/native Windows kiosk/u);
    expect(document.querySelector("iframe")).toBeNull();
  });

  test("prints a batch in the visitor's order and stops at the first failure", async () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    const pending = printArtifacts([
      artifactOf("png", "blob:first"),
      artifactOf("pdf", "blob:second"),
      artifactOf("jpeg", "blob:third"),
      artifactOf("pdf", "blob:fourth"),
    ]);
    const outcome = pending.then(
      () => "printed",
      () => "rejected",
    );

    const first = await nextFrame();
    spyOnFrame(first, calls, "first");
    await loadFrame(first);

    const second = await nextFrame();
    expect(second.getAttribute("src")).toBe("blob:second");
    spyOnFrame(second, calls, "second");
    await loadFrame(second);

    const third = await nextFrame();
    spyOnFrame(third, calls, "third");
    third.contentDocument?.querySelector("img")?.dispatchEvent(new Event("error"));

    await expect(outcome).resolves.toBe("rejected");
    // The fourth document is never sent once the third could not be.
    expect(calls).toEqual(["first", "second"]);
    expect(document.querySelectorAll("iframe")).toHaveLength(3);
  });

  test("never asks for file-system access while printing", async () => {
    // Chromium titles the native dialog opened by `showSaveFilePicker` "Warning:
    // this site can see edits you make". Printing must never reach any picker.
    vi.useFakeTimers();
    const pickers = {
      showSaveFilePicker: vi.fn(),
      showDirectoryPicker: vi.fn(),
      showOpenFilePicker: vi.fn(),
    };
    Object.assign(window as PickerWindow, pickers);
    try {
      const calls: string[] = [];
      const pending = printArtifacts([artifactOf("pdf"), artifactOf("png"), artifactOf("jpeg")]);
      for (const label of ["pdf", "png", "jpeg"]) {
        const frame = await nextFrame();
        spyOnFrame(frame, calls, label);
        await loadFrame(frame);
      }
      await pending;

      expect(calls).toEqual(["pdf", "png", "jpeg"]);
      for (const picker of Object.values(pickers)) expect(picker).not.toHaveBeenCalled();
    } finally {
      for (const name of Object.keys(pickers))
        delete (window as PickerWindow)[name as keyof typeof pickers];
    }
  });

  test("repeated printing leaves no print frames or object URLs behind", async () => {
    vi.useFakeTimers();
    for (let round = 0; round < 3; round += 1) {
      const artifact = createPrintArtifact(new Uint8Array([1, 2, 3]), "png");
      const pending = printArtifact(artifact);
      const frame = await nextFrame();
      spyOnFrame(frame, [], "png");
      await loadFrame(frame);
      await pending;
      revokePrintArtifact(artifact);
    }

    // The frame outlives `print()` long enough for the dialog to read it, then goes.
    expect(document.querySelectorAll("iframe")).toHaveLength(3);
    await vi.runAllTimersAsync();
    expect(document.querySelectorAll("iframe")).toHaveLength(0);
    expect(createObjectURL).toHaveBeenCalledTimes(3);
    expect(revokeObjectURL).toHaveBeenCalledTimes(3);
  });
});
