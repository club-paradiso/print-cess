import {
  detectDocument,
  inspectDocumentFrame,
  orderDocumentQuad,
  processDocument,
  type DocumentQuad,
  type ScanFilter,
} from "@/lib/document-scan-engine";
import { buildScannedPdf } from "@/lib/scan-pdf";

import {
  A4_ASPECT,
  renderScanScene,
  SCAN_LAB_SCENES,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  type ScanLabScene,
} from "./scenes";

/** The live camera inspects frames at this size (`live-document-camera.tsx`). */
const CAMERA_ANALYSIS_EDGE = 820;

/**
 * One scene's result, in the benchmark observation format of
 * `benchmarks/scanner/README.md`, plus the extra facts this harness can check
 * because it knows the answer: whether a sheet was found at all, the corrected
 * page's proportions, and how much desk bled into its border.
 */
export type ScanLabObservation = {
  id: string;
  label: string;
  image: { width: number; height: number };
  expectedQuad?: DocumentQuad;
  detectedQuad?: DocumentQuad;
  expectDetect: boolean | null;
  detected: boolean;
  confidence: number;
  shouldAutoCapture: boolean;
  didAutoCapture: boolean;
  captureIssue: string;
  processingMs: number;
  pdfBytes: number;
  pages: number;
  ocrRequested: false;
  externalOcrUpload: false;
  generativeReconstructionUsed: false;
  /** min(w, h) / max(w, h) of the corrected page; A4 is 0.707. */
  outputAspect?: number;
  /** |outputAspect - A4| / A4, in percent. */
  aspectErrorPercent?: number;
  /** Share of the corrected page's outer 2% ring that is not paper. */
  borderBleed?: number;
};

export type ScanLabPreview = {
  id: string;
  sceneUrl: string;
  outputUrl?: string;
};

async function canvasToJpegFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("scanLabEncode"))),
      "image/jpeg",
      0.9,
    ),
  );
  return new File([blob], name, { type: "image/jpeg", lastModified: 0 });
}

function downscale(canvas: HTMLCanvasElement, maxEdge: number): HTMLCanvasElement {
  const scale = Math.min(1, maxEdge / Math.max(canvas.width, canvas.height));
  const output = document.createElement("canvas");
  output.width = Math.round(canvas.width * scale);
  output.height = Math.round(canvas.height * scale);
  const context = output.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("scanLabCanvasUnavailable");
  context.drawImage(canvas, 0, 0, output.width, output.height);
  return output;
}

/** Proportions and border cleanliness of the corrected page. */
async function measureOutput(blob: Blob) {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("scanLabCanvasUnavailable");
    context.drawImage(bitmap, 0, 0);
    const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
    const ring = Math.max(2, Math.round(Math.min(width, height) * 0.02));
    // Paper in the corrected output is light; the desks in these scenes are
    // all clearly darker than paper once the illumination is normalized.
    let samples = 0;
    let bleed = 0;
    const step = Math.max(1, Math.floor(Math.min(width, height) / 400));
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const inRing = x < ring || y < ring || x >= width - ring || y >= height - ring;
        if (!inRing) continue;
        const index = (y * width + x) * 4;
        const luma = data[index]! * 0.2126 + data[index + 1]! * 0.7152 + data[index + 2]! * 0.0722;
        samples += 1;
        if (luma < 150) bleed += 1;
      }
    }
    const aspect = Math.min(width, height) / Math.max(width, height);
    return {
      outputAspect: aspect,
      aspectErrorPercent: (Math.abs(aspect - A4_ASPECT) / A4_ASPECT) * 100,
      borderBleed: samples === 0 ? 0 : bleed / samples,
    };
  } finally {
    bitmap.close();
  }
}

export async function runScanLabScene(
  scene: ScanLabScene,
  options: { filter?: ScanFilter; previews?: boolean } = {},
): Promise<{ observation: ScanLabObservation; preview?: ScanLabPreview }> {
  const rendered = renderScanScene(scene);
  const file = await canvasToJpegFile(rendered.canvas, `${scene.id}.jpg`);

  // The gallery path: the same calls `scan-composer.tsx` makes for a picked photo.
  const started = performance.now();
  const detection = await detectDocument(file);
  const processed = await processDocument(file, {
    quad: detection.quad,
    filter: options.filter ?? "auto",
  });
  const bytes = new Uint8Array(await processed.blob.arrayBuffer());
  const pdf = buildScannedPdf([{ bytes, width: processed.width, height: processed.height }]);
  const processingMs = performance.now() - started;

  // The camera path: the frame the live viewfinder inspects before it fires.
  const inspection = await inspectDocumentFrame(downscale(rendered.canvas, CAMERA_ANALYSIS_EDGE));

  const geometryScored =
    scene.expect.detect === true && rendered.quad !== null && rendered.fullyInFrame;
  const output = detection.detected ? await measureOutput(processed.blob) : undefined;

  const observation: ScanLabObservation = {
    id: scene.id,
    label: scene.label,
    image: { width: SCENE_WIDTH, height: SCENE_HEIGHT },
    ...(geometryScored
      ? {
          expectedQuad: orderDocumentQuad(rendered.quad!),
          detectedQuad: detection.quad,
        }
      : {}),
    expectDetect: scene.expect.detect,
    detected: detection.detected,
    confidence: detection.confidence,
    shouldAutoCapture: scene.expect.autoCapture,
    didAutoCapture: inspection.quality.ready,
    captureIssue: inspection.quality.issue,
    processingMs: Math.round(processingMs),
    pdfBytes: pdf.byteLength,
    pages: 1,
    ocrRequested: false,
    externalOcrUpload: false,
    generativeReconstructionUsed: false,
    ...(output ?? {}),
  };

  if (!options.previews) return { observation };
  const sceneUrl = downscale(rendered.canvas, 480).toDataURL("image/jpeg", 0.8);
  const outputUrl = URL.createObjectURL(processed.blob);
  return { observation, preview: { id: scene.id, sceneUrl, outputUrl } };
}

export async function runScanLab(
  options: {
    filter?: ScanFilter;
    previews?: boolean;
    onResult?: (observation: ScanLabObservation, preview?: ScanLabPreview) => void;
  } = {},
): Promise<ScanLabObservation[]> {
  const observations: ScanLabObservation[] = [];
  for (const scene of SCAN_LAB_SCENES) {
    const { observation, preview } = await runScanLabScene(scene, options);
    observations.push(observation);
    options.onResult?.(observation, preview);
  }
  return observations;
}
