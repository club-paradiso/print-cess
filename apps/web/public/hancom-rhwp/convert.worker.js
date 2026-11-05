/* Browser-only, isolated HWP/HWPX -> PDF conversion. Never sends document bytes
 * to a conversion API. The renderer, WASM and OFL fonts are served same-origin.
 * Source asset: sanguneo/rhwptopdf v0.2.2; see docs/HANCOM_BROWSER_RENDERING.md.
 */
const BASE = "/hancom-rhwp";
let ready;

async function initialize() {
  importScripts(BASE + "/rhwptopdf.umd.js");
  const engine = self.RhwpToPdf;
  if (typeof engine !== "function") throw new Error("Hancom renderer was not loaded");
  await engine({ module_or_path: BASE + "/rhwptopdf.umd_bg.wasm" });

  // Bundle real redistributable Korean TTF faces so iOS Safari, Firefox and
  // managed PCs need no local-font permission or installed Hancom software.
  const fonts = ["NanumGothic-Regular.ttf", "NanumMyeongjo-Regular.ttf"];
  engine.clearPdfFonts();
  for (const name of fonts) {
    const response = await fetch(BASE + "/" + name, { cache: "force-cache" });
    if (!response.ok) throw new Error("The Korean print font is unavailable");
    const font = new Uint8Array(await response.arrayBuffer());
    try {
      engine.registerPdfFont(font);
    } finally {
      font.fill(0);
    }
  }
  return engine;
}

self.addEventListener("message", async (event) => {
  const { id, input } = event.data || {};
  if (typeof id !== "number" || !(input instanceof ArrayBuffer)) return;
  const bytes = new Uint8Array(input);
  try {
    ready ||= initialize().catch((error) => {
      ready = undefined;
      throw error;
    });
    const engine = await ready;
    const analysis = engine.analyzeHwp(bytes);
    if (!Number.isSafeInteger(analysis.pageCount) || analysis.pageCount < 1) {
      throw new Error("The Hangul file has no printable pages");
    }
    const result = engine.hwpToPdf(bytes);
    if (!(result instanceof Uint8Array) || result.byteLength === 0) {
      throw new Error("The Hangul renderer returned no printable PDF");
    }
    // The returned view may be owned by WebAssembly memory. Copy before
    // transferring, or transfer would detach the WASM heap.
    const pdf = Uint8Array.from(result);
    self.postMessage({ id, ok: true, pdf: pdf.buffer, pageCount: analysis.pageCount }, [pdf.buffer]);
  } catch {
    // Avoid leaking document contents or parser details to the UI or logs.
    self.postMessage({ id, ok: false });
  } finally {
    bytes.fill(0);
  }
});
