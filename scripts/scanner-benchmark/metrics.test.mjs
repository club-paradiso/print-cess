import assert from "node:assert/strict";
import test from "node:test";

import {
  characterErrorRate,
  cornerErrorPercent,
  polygonIou,
  scoreBenchmark,
  wordErrorRate,
} from "./metrics.mjs";

const UNIT_SQUARE = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

test("polygon IoU is one for identical document quads", () => {
  assert.equal(polygonIou(UNIT_SQUARE, UNIT_SQUARE), 1);
});

test("polygon IoU measures partial overlap", () => {
  const shifted = [
    { x: 0.5, y: 0 },
    { x: 1.5, y: 0 },
    { x: 1.5, y: 1 },
    { x: 0.5, y: 1 },
  ];
  assert.ok(Math.abs(polygonIou(UNIT_SQUARE, shifted) - 1 / 3) < 1e-9);
});

test("corner error is normalized by source image diagonal", () => {
  const actual = UNIT_SQUARE.map((point) => ({ x: point.x + 0.01, y: point.y }));
  const error = cornerErrorPercent(UNIT_SQUARE, actual, { width: 3000, height: 4000 });
  assert.ok(error !== null);
  assert.ok(Math.abs(error - 0.6) < 1e-9);
});

test("OCR rates handle Unicode text after normalization", () => {
  assert.equal(characterErrorRate("제주 출입국", "제주 출입국"), 0);
  assert.equal(wordErrorRate("hello world", "hello word"), 0.5);
});

test("benchmark fails closed on external OCR upload or generative reconstruction", () => {
  const report = scoreBenchmark({
    version: 1,
    suite: "privacy-test",
    gates: {
      minCases: 1,
      minGeometryCases: 0,
      minOcrCases: 0,
      minCaptureCases: 0,
      meanEdgeIou: 0,
      p95CornerErrorPercent: 100,
      meanCer: 1,
      meanWer: 1,
      autoCapturePrecision: 0,
      autoCaptureRecall: 0,
      p95ProcessingMs: Number.MAX_SAFE_INTEGER,
      p95PdfKibPerPage: Number.MAX_SAFE_INTEGER,
      searchablePdfRate: 0,
    },
    cases: [
      {
        id: "unsafe",
        externalOcrUpload: true,
        generativeReconstructionUsed: true,
      },
    ],
  });

  assert.equal(report.passed, false);
  assert.equal(report.metrics.privacyIntegrityViolations, 2);
  assert.equal(report.violations.length, 2);
});

test("benchmark rejects missing privacy attestations instead of assuming they are safe", () => {
  const report = scoreBenchmark({
    version: 1,
    suite: "missing-attestations",
    cases: [
      {
        id: "legacy-case",
        image: { width: 3000, height: 4000 },
        expectedQuad: UNIT_SQUARE,
        detectedQuad: UNIT_SQUARE,
        groundTruthText: "privacy evidence",
        ocrText: "privacy evidence",
        shouldAutoCapture: true,
        didAutoCapture: true,
        processingMs: 500,
        pdfBytes: 200 * 1024,
        pages: 1,
        ocrRequested: true,
        searchablePdf: true,
      },
      {
        id: "safe-2",
        image: { width: 3000, height: 4000 },
        expectedQuad: UNIT_SQUARE,
        detectedQuad: UNIT_SQUARE,
        groundTruthText: "privacy evidence",
        ocrText: "privacy evidence",
        shouldAutoCapture: true,
        didAutoCapture: true,
        processingMs: 500,
        pdfBytes: 200 * 1024,
        pages: 1,
        ocrRequested: true,
        searchablePdf: true,
        externalOcrUpload: false,
        generativeReconstructionUsed: false,
      },
      {
        id: "safe-3",
        image: { width: 3000, height: 4000 },
        expectedQuad: UNIT_SQUARE,
        detectedQuad: UNIT_SQUARE,
        groundTruthText: "privacy evidence",
        ocrText: "privacy evidence",
        shouldAutoCapture: false,
        didAutoCapture: false,
        processingMs: 500,
        pdfBytes: 200 * 1024,
        pages: 1,
        ocrRequested: true,
        searchablePdf: true,
        externalOcrUpload: false,
        generativeReconstructionUsed: false,
      },
      {
        id: "safe-4",
        image: { width: 3000, height: 4000 },
        expectedQuad: UNIT_SQUARE,
        detectedQuad: UNIT_SQUARE,
        groundTruthText: "privacy evidence",
        ocrText: "privacy evidence",
        shouldAutoCapture: false,
        didAutoCapture: false,
        processingMs: 500,
        pdfBytes: 200 * 1024,
        pages: 1,
        ocrRequested: true,
        searchablePdf: true,
        externalOcrUpload: false,
        generativeReconstructionUsed: false,
      },
    ],
  });

  assert.equal(report.passed, false);
  assert.equal(report.metrics.privacyIntegrityViolations, 2);
  assert.deepEqual(report.violations, [
    "legacy-case: external OCR upload attestation must be explicitly false",
    "legacy-case: generative reconstruction attestation must be explicitly false",
  ]);
});

test("benchmark produces a passing release-style verdict when all gates are met", () => {
  const cases = Array.from({ length: 4 }, (_, index) => ({
    id: `case-${index + 1}`,
    image: { width: 3000, height: 4000 },
    expectedQuad: UNIT_SQUARE,
    detectedQuad: UNIT_SQUARE,
    groundTruthText: "Print-cess scanner quality",
    ocrText: "Print-cess scanner quality",
    shouldAutoCapture: index < 2,
    didAutoCapture: index < 2,
    processingMs: 700 + index * 20,
    pdfBytes: 300 * 1024,
    pages: 1,
    ocrRequested: true,
    searchablePdf: true,
    externalOcrUpload: false,
    generativeReconstructionUsed: false,
  }));

  const report = scoreBenchmark({ version: 1, suite: "passing-test", cases });
  assert.equal(report.passed, true);
  assert.equal(report.metrics.autoCapturePrecision, 1);
  assert.equal(report.metrics.autoCaptureRecall, 1);
});
