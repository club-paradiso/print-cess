export type ScanPoint = { x: number; y: number };
export type ScanPixelData = { data: Uint8ClampedArray; width: number; height: number };
export type DocumentQuad = [ScanPoint, ScanPoint, ScanPoint, ScanPoint];
export type ScanFilter = "auto" | "color" | "grayscale" | "bw";
export type CaptureIssue =
  "ready" | "no-document" | "move-closer" | "too-dark" | "too-bright" | "glare" | "blurry";

export type DocumentDetection = {
  quad: DocumentQuad;
  confidence: number;
  detected: boolean;
};

export type CaptureQuality = {
  issue: CaptureIssue;
  score: number;
  ready: boolean;
  brightness: number;
  sharpness: number;
  glare: number;
  coverage: number;
};

export type FrameInspection = {
  detection: DocumentDetection;
  quality: CaptureQuality;
};

export type ProcessedDocument = {
  blob: Blob;
  width: number;
  height: number;
};

const DETECTION_EDGE = 900;
const PROCESS_EDGE = 2400;
const PREVIEW_EDGE = 1200;
const JPEG_QUALITY = 0.92;

export const FULL_FRAME_QUAD: DocumentQuad = [
  { x: 0.02, y: 0.02 },
  { x: 0.98, y: 0.02 },
  { x: 0.98, y: 0.98 },
  { x: 0.02, y: 0.98 },
];

type CvRuntime = Awaited<ReturnType<(typeof import("@opencvjs/web"))["loadOpenCV"]>>;

let cvPromise: Promise<CvRuntime> | undefined;

async function getOpenCv(): Promise<CvRuntime> {
  if (!cvPromise) {
    cvPromise = import("@opencvjs/web").then(({ loadOpenCV }) => loadOpenCV());
  }
  return cvPromise;
}

export function orderDocumentQuad(points: readonly ScanPoint[]): DocumentQuad {
  if (points.length !== 4) throw new Error("documentQuadRequiresFourPoints");
  const topLeft = points.reduce((best, point) =>
    point.x + point.y < best.x + best.y ? point : best,
  );
  const bottomRight = points.reduce((best, point) =>
    point.x + point.y > best.x + best.y ? point : best,
  );
  const topRight = points.reduce((best, point) =>
    point.x - point.y > best.x - best.y ? point : best,
  );
  const bottomLeft = points.reduce((best, point) =>
    point.y - point.x > best.y - best.x ? point : best,
  );
  return [topLeft, topRight, bottomRight, bottomLeft];
}

export function quadArea(quad: DocumentQuad): number {
  let total = 0;
  for (let index = 0; index < 4; index += 1) {
    const current = quad[index]!;
    const next = quad[(index + 1) % 4]!;
    total += current.x * next.y - next.x * current.y;
  }
  return Math.abs(total) / 2;
}

export function clampQuad(quad: DocumentQuad): DocumentQuad {
  return quad.map((point) => ({
    x: Math.min(1, Math.max(0, point.x)),
    y: Math.min(1, Math.max(0, point.y)),
  })) as DocumentQuad;
}

export function quadDrift(first: DocumentQuad, second: DocumentQuad): number {
  return (
    first.reduce((total, point, index) => total + distance(point, second[index]!), 0) / first.length
  );
}

export function analyzeCapturePixels(
  imageData: ScanPixelData,
  detection: DocumentDetection,
): CaptureQuality {
  const { data, width, height } = imageData;
  const pixelCount = width * height;
  if (pixelCount === 0) {
    return {
      issue: "no-document",
      score: 0,
      ready: false,
      brightness: 0,
      sharpness: 0,
      glare: 0,
      coverage: 0,
    };
  }

  const sampleStep = Math.max(1, Math.floor(Math.max(width, height) / 420));
  let luminanceTotal = 0;
  let samples = 0;
  let laplacianTotal = 0;
  let laplacianSquared = 0;
  let laplacianSamples = 0;
  const tileColumns = 8;
  const tileRows = 10;
  const clipped = new Uint32Array(tileColumns * tileRows);
  const tileSamples = new Uint32Array(tileColumns * tileRows);

  const lumaAt = (x: number, y: number) => {
    const index = (y * width + x) * 4;
    return data[index]! * 0.2126 + data[index + 1]! * 0.7152 + data[index + 2]! * 0.0722;
  };

  for (let y = sampleStep; y < height - sampleStep; y += sampleStep) {
    for (let x = sampleStep; x < width - sampleStep; x += sampleStep) {
      const center = lumaAt(x, y);
      luminanceTotal += center;
      samples += 1;
      const tileX = Math.min(tileColumns - 1, Math.floor((x / width) * tileColumns));
      const tileY = Math.min(tileRows - 1, Math.floor((y / height) * tileRows));
      const tileIndex = tileY * tileColumns + tileX;
      tileSamples[tileIndex] = (tileSamples[tileIndex] ?? 0) + 1;
      if (center >= 252) clipped[tileIndex] = (clipped[tileIndex] ?? 0) + 1;

      const laplacian =
        4 * center -
        lumaAt(x - sampleStep, y) -
        lumaAt(x + sampleStep, y) -
        lumaAt(x, y - sampleStep) -
        lumaAt(x, y + sampleStep);
      laplacianTotal += laplacian;
      laplacianSquared += laplacian * laplacian;
      laplacianSamples += 1;
    }
  }

  const brightness = samples === 0 ? 0 : luminanceTotal / samples / 255;
  const lapMean = laplacianSamples === 0 ? 0 : laplacianTotal / laplacianSamples;
  const lapVariance =
    laplacianSamples === 0
      ? 0
      : Math.max(0, laplacianSquared / laplacianSamples - lapMean * lapMean);
  const sharpness = Math.min(1, Math.sqrt(lapVariance) / 32);
  let glare = 0;
  for (let index = 0; index < clipped.length; index += 1) {
    const count = tileSamples[index]!;
    if (count === 0) continue;
    const ratio = clipped[index]! / count;
    // A fully clipped local tile is the strongest glare signal. Whole-frame
    // overexposure is classified earlier by the average brightness gate.
    if (ratio > 0.58) glare = Math.max(glare, ratio);
  }

  const coverage = detection.detected ? quadArea(detection.quad) : 0;
  let issue: CaptureIssue = "ready";
  if (!detection.detected || detection.confidence < 0.48) issue = "no-document";
  else if (coverage < 0.28) issue = "move-closer";
  else if (brightness < 0.2) issue = "too-dark";
  else if (brightness > 0.96) issue = "too-bright";
  else if (glare > 0.72) issue = "glare";
  else if (sharpness < 0.14) issue = "blurry";

  const exposureScore = Math.max(0, 1 - Math.abs(brightness - 0.62) / 0.62);
  const coverageScore = Math.min(1, coverage / 0.68);
  const glareScore = 1 - Math.min(1, glare);
  const score =
    detection.confidence * 0.34 +
    coverageScore * 0.22 +
    sharpness * 0.22 +
    exposureScore * 0.14 +
    glareScore * 0.08;

  return {
    issue,
    score: Math.min(1, Math.max(0, score)),
    ready: issue === "ready" && score >= 0.62,
    brightness,
    sharpness,
    glare,
    coverage,
  };
}

export async function inspectDocumentFrame(canvas: HTMLCanvasElement): Promise<FrameInspection> {
  const detection = await detectDocumentOnCanvas(canvas);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("scanImageError");
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  return { detection, quality: analyzeCapturePixels(imageData, detection) };
}

export async function detectDocument(file: File): Promise<DocumentDetection> {
  const loaded = await fileToCanvas(file, DETECTION_EDGE);
  try {
    return await detectDocumentOnCanvas(loaded.canvas);
  } finally {
    loaded.release();
  }
}

export async function detectDocumentOnCanvas(
  canvas: HTMLCanvasElement,
): Promise<DocumentDetection> {
  const cv = await getOpenCv();
  const src = cv.imread(canvas);
  const gray = new cv.Mat();
  const equalized = new cv.Mat();
  const blurred = new cv.Mat();
  const edges = new cv.Mat();
  const closed = new cv.Mat();
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.equalizeHist(gray, equalized);
    cv.GaussianBlur(equalized, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);

    const imageArea = src.cols * src.rows;
    let bestQuad: DocumentQuad | undefined;
    let bestScore = 0;
    const thresholds: Array<[number, number]> = [
      [35, 115],
      [55, 165],
      [80, 220],
    ];

    for (const [low, high] of thresholds) {
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      try {
        cv.Canny(blurred, edges, low, high, 3, false);
        cv.morphologyEx(edges, closed, cv.MORPH_CLOSE, kernel);
        cv.findContours(closed, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

        for (let index = 0; index < contours.size(); index += 1) {
          const contour = contours.get(index);
          const approx = new cv.Mat();
          try {
            const perimeter = cv.arcLength(contour, true);
            cv.approxPolyDP(contour, approx, 0.018 * perimeter, true);
            if (approx.rows !== 4 || !cv.isContourConvex(approx)) continue;

            const area = Math.abs(cv.contourArea(approx));
            const coverage = area / imageArea;
            if (coverage < 0.14 || coverage > 0.99) continue;

            const raw = approx.data32S;
            const points: ScanPoint[] = [];
            for (let pointIndex = 0; pointIndex < 4; pointIndex += 1) {
              points.push({
                x: raw[pointIndex * 2]! / src.cols,
                y: raw[pointIndex * 2 + 1]! / src.rows,
              });
            }
            const quad = orderDocumentQuad(points);
            if (!isUsableQuad(quad)) continue;

            const score = detectionScore(quad, coverage);
            if (score > bestScore) {
              bestScore = score;
              bestQuad = quad;
            }
          } finally {
            approx.delete();
            contour.delete();
          }
        }
      } finally {
        hierarchy.delete();
        contours.delete();
      }
    }

    if (!bestQuad || bestScore < 0.4) {
      return { quad: FULL_FRAME_QUAD, confidence: 0, detected: false };
    }

    return {
      quad: clampQuad(bestQuad),
      confidence: Math.min(1, bestScore),
      detected: true,
    };
  } finally {
    kernel.delete();
    closed.delete();
    edges.delete();
    blurred.delete();
    equalized.delete();
    gray.delete();
    src.delete();
  }
}

export async function processDocument(
  file: File,
  options: {
    quad: DocumentQuad;
    filter: ScanFilter;
    rotation?: number;
    preview?: boolean;
  },
): Promise<ProcessedDocument> {
  const loaded = await fileToCanvas(file, options.preview ? PREVIEW_EDGE : PROCESS_EDGE);
  try {
    return await processCanvas(loaded.canvas, options);
  } finally {
    loaded.release();
  }
}

async function processCanvas(
  sourceCanvas: HTMLCanvasElement,
  options: {
    quad: DocumentQuad;
    filter: ScanFilter;
    rotation?: number;
  },
): Promise<ProcessedDocument> {
  const cv = await getOpenCv();
  const src = cv.imread(sourceCanvas);
  const quad = clampQuad(options.quad);
  const sourcePoints = quad.map((point) => ({
    x: point.x * src.cols,
    y: point.y * src.rows,
  })) as DocumentQuad;
  const dimensions = documentDimensions(sourcePoints, src.cols, src.rows);
  const srcCorners = cv.matFromArray(4, 1, cv.CV_32FC2, [
    sourcePoints[0].x,
    sourcePoints[0].y,
    sourcePoints[1].x,
    sourcePoints[1].y,
    sourcePoints[2].x,
    sourcePoints[2].y,
    sourcePoints[3].x,
    sourcePoints[3].y,
  ]);
  const dstCorners = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0,
    0,
    dimensions.width - 1,
    0,
    dimensions.width - 1,
    dimensions.height - 1,
    0,
    dimensions.height - 1,
  ]);
  const transform = cv.getPerspectiveTransform(srcCorners, dstCorners);
  const warped = new cv.Mat();

  try {
    cv.warpPerspective(
      src,
      warped,
      transform,
      new cv.Size(dimensions.width, dimensions.height),
      cv.INTER_CUBIC,
      cv.BORDER_REPLICATE,
      new cv.Scalar(),
    );

    const filtered = applyFilter(cv, warped, options.filter);
    try {
      const rendered = document.createElement("canvas");
      rendered.width = filtered.cols;
      rendered.height = filtered.rows;
      cv.imshow(rendered, filtered);
      const rotated = rotateCanvas(rendered, options.rotation ?? 0);
      const blob = await canvasBlob(rotated, JPEG_QUALITY);
      return { blob, width: rotated.width, height: rotated.height };
    } finally {
      filtered.delete();
    }
  } finally {
    warped.delete();
    transform.delete();
    dstCorners.delete();
    srcCorners.delete();
    src.delete();
  }
}

function illuminationNormalizedGray(
  cv: CvRuntime,
  source: InstanceType<CvRuntime["Mat"]>,
): InstanceType<CvRuntime["Mat"]> {
  const gray = new cv.Mat();
  const background = new cv.Mat();
  const normalized = new cv.Mat();
  const minimum = Math.min(source.cols, source.rows);
  const kernel = Math.max(31, Math.min(101, Math.floor(minimum / 18) | 1));
  cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY);
  cv.GaussianBlur(gray, background, new cv.Size(kernel, kernel), 0);
  cv.divide(gray, background, normalized, 245);
  gray.delete();
  background.delete();
  return normalized;
}

function applyFilter(cv: CvRuntime, source: InstanceType<CvRuntime["Mat"]>, filter: ScanFilter) {
  if (filter === "color") {
    const gray = new cv.Mat();
    const background = new cv.Mat();
    const color = new cv.Mat();
    const backgroundColor = new cv.Mat();
    const normalized = new cv.Mat();
    const blurred = new cv.Mat();
    const sharpened = new cv.Mat();
    const minimum = Math.min(source.cols, source.rows);
    const kernel = Math.max(31, Math.min(101, Math.floor(minimum / 18) | 1));
    cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, background, new cv.Size(kernel, kernel), 0);
    cv.cvtColor(source, color, cv.COLOR_RGBA2RGB);
    cv.cvtColor(background, backgroundColor, cv.COLOR_GRAY2RGB);
    cv.divide(color, backgroundColor, normalized, 238);
    cv.GaussianBlur(normalized, blurred, new cv.Size(0, 0), 1.15);
    cv.addWeighted(normalized, 1.28, blurred, -0.28, 3, sharpened);
    gray.delete();
    background.delete();
    color.delete();
    backgroundColor.delete();
    normalized.delete();
    blurred.delete();
    return sharpened;
  }

  const normalized = illuminationNormalizedGray(cv, source);

  if (filter === "grayscale") {
    const output = new cv.Mat();
    cv.equalizeHist(normalized, output);
    normalized.delete();
    return output;
  }

  if (filter === "bw") {
    const output = new cv.Mat();
    const minimum = Math.min(normalized.cols, normalized.rows);
    let blockSize = Math.max(31, Math.min(71, Math.floor(minimum / 32) | 1));
    if (blockSize % 2 === 0) blockSize += 1;
    cv.adaptiveThreshold(
      normalized,
      output,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY,
      blockSize,
      10,
    );
    normalized.delete();
    return output;
  }

  const equalized = new cv.Mat();
  const blurred = new cv.Mat();
  const output = new cv.Mat();
  cv.equalizeHist(normalized, equalized);
  cv.GaussianBlur(equalized, blurred, new cv.Size(0, 0), 0.9);
  cv.addWeighted(equalized, 1.18, blurred, -0.18, 2, output);
  normalized.delete();
  equalized.delete();
  blurred.delete();
  return output;
}

function documentDimensions(quad: DocumentQuad, sourceWidth: number, sourceHeight: number) {
  const top = distance(quad[0], quad[1]);
  const bottom = distance(quad[3], quad[2]);
  const left = distance(quad[0], quad[3]);
  const right = distance(quad[1], quad[2]);
  const rawWidth = Math.max(top, bottom);
  const rawHeight = Math.max(left, right);
  const maximum = Math.max(rawWidth, rawHeight);
  const sourceMaximum = Math.max(sourceWidth, sourceHeight);
  const scale = Math.min(1, PROCESS_EDGE / maximum, PROCESS_EDGE / sourceMaximum);
  return {
    width: Math.max(240, Math.round(rawWidth * scale)),
    height: Math.max(240, Math.round(rawHeight * scale)),
  };
}

function detectionScore(quad: DocumentQuad, coverage: number): number {
  const angleScore =
    quad.reduce((total, point, index) => {
      const previous = quad[(index + 3) % 4]!;
      const next = quad[(index + 1) % 4]!;
      return total + rightAngleScore(previous, point, next);
    }, 0) / 4;
  const coverageScore = Math.min(1, Math.max(0, (coverage - 0.14) / 0.66));
  const borderPenalty = quad.some(
    (point) => point.x < 0.004 || point.x > 0.996 || point.y < 0.004 || point.y > 0.996,
  )
    ? 0.06
    : 0;
  return coverageScore * 0.56 + angleScore * 0.44 - borderPenalty;
}

function rightAngleScore(previous: ScanPoint, center: ScanPoint, next: ScanPoint): number {
  const ax = previous.x - center.x;
  const ay = previous.y - center.y;
  const bx = next.x - center.x;
  const by = next.y - center.y;
  const denominator = Math.hypot(ax, ay) * Math.hypot(bx, by);
  if (denominator === 0) return 0;
  const cosine = Math.abs((ax * bx + ay * by) / denominator);
  return Math.max(0, 1 - cosine / 0.6);
}

function isUsableQuad(quad: DocumentQuad): boolean {
  const area = quadArea(quad);
  if (area < 0.13) return false;
  const sides = [
    distance(quad[0], quad[1]),
    distance(quad[1], quad[2]),
    distance(quad[2], quad[3]),
    distance(quad[3], quad[0]),
  ];
  return Math.min(...sides) > 0.1;
}

function distance(first: ScanPoint, second: ScanPoint): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

async function fileToCanvas(file: File, maxEdge: number) {
  let image: CanvasImageSource;
  let width: number;
  let height: number;
  let release = () => {};

  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      image = bitmap;
      width = bitmap.width;
      height = bitmap.height;
      release = () => bitmap.close();
    } catch {
      const loaded = await loadHtmlImage(file);
      image = loaded.image;
      width = loaded.image.naturalWidth;
      height = loaded.image.naturalHeight;
      release = loaded.release;
    }
  } else {
    const loaded = await loadHtmlImage(file);
    image = loaded.image;
    width = loaded.image.naturalWidth;
    height = loaded.image.naturalHeight;
    release = loaded.release;
  }

  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    release();
    throw new Error("scanImageError");
  }
  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return { canvas, release };
}

async function loadHtmlImage(file: File) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
    return { image, release: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function rotateCanvas(canvas: HTMLCanvasElement, rotation: number): HTMLCanvasElement {
  const normalized = ((rotation % 360) + 360) % 360;
  if (normalized === 0) return canvas;
  const sideways = normalized === 90 || normalized === 270;
  const output = document.createElement("canvas");
  output.width = sideways ? canvas.height : canvas.width;
  output.height = sideways ? canvas.width : canvas.height;
  const context = output.getContext("2d", { alpha: false });
  if (!context) throw new Error("scanImageError");
  context.fillStyle = "white";
  context.fillRect(0, 0, output.width, output.height);
  context.translate(output.width / 2, output.height / 2);
  context.rotate((normalized * Math.PI) / 180);
  context.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return output;
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("scanImageError"))),
      "image/jpeg",
      quality,
    );
  });
}
