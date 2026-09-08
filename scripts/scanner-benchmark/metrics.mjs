const EPSILON = 1e-9;

export const DEFAULT_GATES = Object.freeze({
  minCases: 4,
  minGeometryCases: 2,
  minOcrCases: 2,
  minCaptureCases: 4,
  meanEdgeIou: 0.88,
  p95CornerErrorPercent: 2.5,
  meanCer: 0.05,
  meanWer: 0.12,
  autoCapturePrecision: 0.98,
  autoCaptureRecall: 0.95,
  p95ProcessingMs: 1800,
  p95PdfKibPerPage: 1500,
  searchablePdfRate: 0.99,
});

function cross(a, b, p) {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}

function signedArea(points) {
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return sum / 2;
}

export function polygonArea(points) {
  return Math.abs(signedArea(points));
}

function lineIntersection(segmentStart, segmentEnd, clipStart, clipEnd) {
  const segmentX = segmentEnd.x - segmentStart.x;
  const segmentY = segmentEnd.y - segmentStart.y;
  const clipX = clipEnd.x - clipStart.x;
  const clipY = clipEnd.y - clipStart.y;
  const denominator = segmentX * clipY - segmentY * clipX;

  if (Math.abs(denominator) < EPSILON) {
    return segmentEnd;
  }

  const offsetX = clipStart.x - segmentStart.x;
  const offsetY = clipStart.y - segmentStart.y;
  const t = (offsetX * clipY - offsetY * clipX) / denominator;
  return {
    x: segmentStart.x + t * segmentX,
    y: segmentStart.y + t * segmentY,
  };
}

export function intersectConvexPolygons(subject, clip) {
  if (subject.length < 3 || clip.length < 3) return [];

  const orientation = signedArea(clip) >= 0 ? 1 : -1;
  let output = subject.map((point) => ({ ...point }));

  for (let edge = 0; edge < clip.length; edge += 1) {
    const clipStart = clip[edge];
    const clipEnd = clip[(edge + 1) % clip.length];
    const input = output;
    output = [];
    if (input.length === 0) break;

    let previous = input[input.length - 1];
    for (const current of input) {
      const currentInside = orientation * cross(clipStart, clipEnd, current) >= -EPSILON;
      const previousInside = orientation * cross(clipStart, clipEnd, previous) >= -EPSILON;

      if (currentInside) {
        if (!previousInside) {
          output.push(lineIntersection(previous, current, clipStart, clipEnd));
        }
        output.push(current);
      } else if (previousInside) {
        output.push(lineIntersection(previous, current, clipStart, clipEnd));
      }
      previous = current;
    }
  }

  return output;
}

export function polygonIou(expected, actual) {
  const expectedArea = polygonArea(expected);
  const actualArea = polygonArea(actual);
  const intersectionArea = polygonArea(intersectConvexPolygons(expected, actual));
  const unionArea = expectedArea + actualArea - intersectionArea;
  return unionArea <= EPSILON ? 0 : intersectionArea / unionArea;
}

export function cornerErrorPercent(expected, actual, image) {
  if (expected.length !== actual.length || expected.length === 0) return null;
  const diagonal = Math.hypot(image.width, image.height);
  if (diagonal <= EPSILON) return null;

  let squared = 0;
  for (let index = 0; index < expected.length; index += 1) {
    const dx = (expected[index].x - actual[index].x) * image.width;
    const dy = (expected[index].y - actual[index].y) * image.height;
    squared += dx * dx + dy * dy;
  }
  return (Math.sqrt(squared / expected.length) / diagonal) * 100;
}

export function levenshteinDistance(left, right) {
  const a = Array.from(left);
  const b = Array.from(right);
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let row = 1; row <= a.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= b.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1),
      );
    }
    previous = current;
  }

  return previous[b.length];
}

export function normalizeOcrText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();
}

export function characterErrorRate(expected, actual) {
  const reference = normalizeOcrText(expected);
  const candidate = normalizeOcrText(actual);
  if (reference.length === 0) return candidate.length === 0 ? 0 : 1;
  return levenshteinDistance(reference, candidate) / Array.from(reference).length;
}

export function wordErrorRate(expected, actual) {
  const reference = normalizeOcrText(expected).split(" ").filter(Boolean);
  const candidate = normalizeOcrText(actual).split(" ").filter(Boolean);
  if (reference.length === 0) return candidate.length === 0 ? 0 : 1;
  return levenshteinDistance(reference, candidate) / reference.length;
}

export function percentile(values, percentileValue) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil(percentileValue * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, rank))];
}

function mean(values) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function ratio(numerator, denominator) {
  return denominator === 0 ? null : numerator / denominator;
}

export function scoreBenchmark(input) {
  if (input?.version !== 1 || !Array.isArray(input.cases)) {
    throw new Error("Scanner benchmark input must use version 1 and contain a cases array.");
  }

  const gates = { ...DEFAULT_GATES, ...(input.gates ?? {}) };
  const geometryIous = [];
  const cornerErrors = [];
  const cerValues = [];
  const werValues = [];
  const processingTimes = [];
  const pdfKibPerPage = [];
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  let searchableRequested = 0;
  let searchablePassed = 0;
  const violations = [];

  for (const benchmarkCase of input.cases) {
    if (benchmarkCase.expectedQuad && benchmarkCase.detectedQuad && benchmarkCase.image) {
      geometryIous.push(polygonIou(benchmarkCase.expectedQuad, benchmarkCase.detectedQuad));
      const cornerError = cornerErrorPercent(
        benchmarkCase.expectedQuad,
        benchmarkCase.detectedQuad,
        benchmarkCase.image,
      );
      if (cornerError !== null) cornerErrors.push(cornerError);
    }

    if (typeof benchmarkCase.groundTruthText === "string" && typeof benchmarkCase.ocrText === "string") {
      cerValues.push(characterErrorRate(benchmarkCase.groundTruthText, benchmarkCase.ocrText));
      werValues.push(wordErrorRate(benchmarkCase.groundTruthText, benchmarkCase.ocrText));
    }

    if (
      typeof benchmarkCase.shouldAutoCapture === "boolean" &&
      typeof benchmarkCase.didAutoCapture === "boolean"
    ) {
      if (benchmarkCase.shouldAutoCapture && benchmarkCase.didAutoCapture) truePositive += 1;
      if (!benchmarkCase.shouldAutoCapture && benchmarkCase.didAutoCapture) falsePositive += 1;
      if (benchmarkCase.shouldAutoCapture && !benchmarkCase.didAutoCapture) falseNegative += 1;
    }

    if (Number.isFinite(benchmarkCase.processingMs)) processingTimes.push(benchmarkCase.processingMs);
    if (Number.isFinite(benchmarkCase.pdfBytes) && Number.isFinite(benchmarkCase.pages) && benchmarkCase.pages > 0) {
      pdfKibPerPage.push(benchmarkCase.pdfBytes / 1024 / benchmarkCase.pages);
    }

    if (benchmarkCase.ocrRequested === true) {
      searchableRequested += 1;
      if (benchmarkCase.searchablePdf === true) searchablePassed += 1;
    }

    if (benchmarkCase.externalOcrUpload === true) {
      violations.push(`${benchmarkCase.id}: page pixels were uploaded to an external OCR service`);
    }
    if (benchmarkCase.generativeReconstructionUsed === true) {
      violations.push(`${benchmarkCase.id}: generative reconstruction modified source document content`);
    }
  }

  const captureSamples = truePositive + falsePositive + falseNegative + input.cases.filter(
    (item) => item.shouldAutoCapture === false && item.didAutoCapture === false,
  ).length;

  const metrics = {
    cases: input.cases.length,
    geometryCases: geometryIous.length,
    ocrCases: cerValues.length,
    captureCases: captureSamples,
    meanEdgeIou: mean(geometryIous),
    p95CornerErrorPercent: percentile(cornerErrors, 0.95),
    meanCer: mean(cerValues),
    meanWer: mean(werValues),
    autoCapturePrecision: ratio(truePositive, truePositive + falsePositive),
    autoCaptureRecall: ratio(truePositive, truePositive + falseNegative),
    p95ProcessingMs: percentile(processingTimes, 0.95),
    p95PdfKibPerPage: percentile(pdfKibPerPage, 0.95),
    searchablePdfRate: ratio(searchablePassed, searchableRequested),
    privacyIntegrityViolations: violations.length,
  };

  const checks = [
    ["minimum total cases", metrics.cases >= gates.minCases, metrics.cases, gates.minCases, ">="],
    ["minimum geometry cases", metrics.geometryCases >= gates.minGeometryCases, metrics.geometryCases, gates.minGeometryCases, ">="],
    ["minimum OCR cases", metrics.ocrCases >= gates.minOcrCases, metrics.ocrCases, gates.minOcrCases, ">="],
    ["minimum capture cases", metrics.captureCases >= gates.minCaptureCases, metrics.captureCases, gates.minCaptureCases, ">="],
    ["mean edge IoU", metrics.meanEdgeIou !== null && metrics.meanEdgeIou >= gates.meanEdgeIou, metrics.meanEdgeIou, gates.meanEdgeIou, ">="],
    ["p95 corner error (%)", metrics.p95CornerErrorPercent !== null && metrics.p95CornerErrorPercent <= gates.p95CornerErrorPercent, metrics.p95CornerErrorPercent, gates.p95CornerErrorPercent, "<="],
    ["mean OCR CER", metrics.meanCer !== null && metrics.meanCer <= gates.meanCer, metrics.meanCer, gates.meanCer, "<="],
    ["mean OCR WER", metrics.meanWer !== null && metrics.meanWer <= gates.meanWer, metrics.meanWer, gates.meanWer, "<="],
    ["auto-capture precision", metrics.autoCapturePrecision !== null && metrics.autoCapturePrecision >= gates.autoCapturePrecision, metrics.autoCapturePrecision, gates.autoCapturePrecision, ">="],
    ["auto-capture recall", metrics.autoCaptureRecall !== null && metrics.autoCaptureRecall >= gates.autoCaptureRecall, metrics.autoCaptureRecall, gates.autoCaptureRecall, ">="],
    ["p95 processing time (ms)", metrics.p95ProcessingMs !== null && metrics.p95ProcessingMs <= gates.p95ProcessingMs, metrics.p95ProcessingMs, gates.p95ProcessingMs, "<="],
    ["p95 PDF KiB/page", metrics.p95PdfKibPerPage !== null && metrics.p95PdfKibPerPage <= gates.p95PdfKibPerPage, metrics.p95PdfKibPerPage, gates.p95PdfKibPerPage, "<="],
    ["searchable PDF rate", metrics.searchablePdfRate !== null && metrics.searchablePdfRate >= gates.searchablePdfRate, metrics.searchablePdfRate, gates.searchablePdfRate, ">="],
    ["privacy/integrity violations", metrics.privacyIntegrityViolations === 0, metrics.privacyIntegrityViolations, 0, "=="],
  ].map(([name, passed, value, threshold, operator]) => ({
    name,
    passed,
    value,
    threshold,
    operator,
  }));

  return {
    version: 1,
    suite: input.suite ?? "scanner-benchmark",
    source: input.source ?? "unknown",
    device: input.device ?? null,
    metrics,
    checks,
    violations,
    passed: checks.every((check) => check.passed),
  };
}
