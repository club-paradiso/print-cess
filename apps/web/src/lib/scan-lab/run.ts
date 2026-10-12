import {
  detectDocument,
  inspectDocumentFrame,
  orderDocumentQuad,
  processDocument,
  type DocumentQuad,
  type ScanFilter,
  type ScanPoint,
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
  /** Share of the detected crop that lies outside the true page (desk in the PDF). */
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

/** Proportions of the corrected page. */
async function measureAspect(blob: Blob) {
  const bitmap = await createImageBitmap(blob);
  try {
    const aspect = Math.min(bitmap.width, bitmap.height) / Math.max(bitmap.width, bitmap.height);
    return {
      outputAspect: aspect,
      aspectErrorPercent: (Math.abs(aspect - A4_ASPECT) / A4_ASPECT) * 100,
    };
  } finally {
    bitmap.close();
  }
}

/** True when `point` is inside the convex quad (either winding). */
function insideConvex(quad: readonly ScanPoint[], point: ScanPoint): boolean {
  let sign = 0;
  for (let index = 0; index < quad.length; index += 1) {
    const a = quad[index]!;
    const b = quad[(index + 1) % quad.length]!;
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    if (cross === 0) continue;
    const current = Math.sign(cross);
    if (sign === 0) sign = current;
    else if (current !== sign) return false;
  }
  return true;
}

/**
 * Share of the detected crop that lies outside the true page, measured on a
 * pixel-space grid against the quad the scene was drawn with. A colour or
 * brightness test cannot do this: a beige desk is as light as paper once the
 * illumination is normalized, so desk inside the crop would pass unseen.
 */
function cropBleed(truth: DocumentQuad, detected: DocumentQuad): number {
  const toPixels = (quad: DocumentQuad) =>
    quad.map((point) => ({ x: point.x * SCENE_WIDTH, y: point.y * SCENE_HEIGHT }));
  const truthPixels = toPixels(truth);
  const detectedPixels = toPixels(detected);
  const xs = detectedPixels.map((point) => point.x);
  const ys = detectedPixels.map((point) => point.y);
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  const step = Math.max(1, Math.max(maxX - minX, maxY - minY) / 300);
  let inCrop = 0;
  let outsidePage = 0;
  for (let y = minY; y <= maxY; y += step) {
    for (let x = minX; x <= maxX; x += step) {
      const point = { x, y };
      if (!insideConvex(detectedPixels, point)) continue;
      inCrop += 1;
      if (!insideConvex(truthPixels, point)) outsidePage += 1;
    }
  }
  return inCrop === 0 ? 0 : outsidePage / inCrop;
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
  const output = detection.detected ? await measureAspect(processed.blob) : undefined;
  const borderBleed =
    geometryScored && detection.detected
      ? cropBleed(orderDocumentQuad(rendered.quad!), detection.quad)
      : undefined;

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
    ...(borderBleed === undefined ? {} : { borderBleed }),
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
