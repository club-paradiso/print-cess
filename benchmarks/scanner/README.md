# Scanner quality benchmark

This directory defines a measurable quality contract for Print-cess document scanning.

The benchmark has two deliberately separate tiers:

1. `synthetic-ci` keeps the scoring engine, thresholds, privacy invariants, and report format deterministic in CI.
2. `real-device` records observations from actual phones and paper documents. Only this tier may be used to make claims about real-world scanner quality or comparisons with other scanning products.

A green synthetic fixture is **not** evidence that Print-cess matches Adobe Scan, CamScanner, Apple Notes, or any other product in real-world image quality.

## Metrics

The scorer currently reports:

- mean document-edge polygon IoU
- p95 corner RMSE as a percentage of source-image diagonal
- mean OCR character error rate (CER)
- mean OCR word error rate (WER)
- auto-capture precision and recall
- p95 per-case processing latency
- p95 PDF KiB per page
- searchable-PDF success rate when OCR was requested
- privacy / document-integrity violations

Default gates live in `scripts/scanner-benchmark/metrics.mjs`. A benchmark input may override them, but any override used for a release decision must be reviewed explicitly rather than silently weakening a failing gate.

## Privacy and integrity invariants

Every observation must record both of these fields:

- `externalOcrUpload`: must remain `false`. Print-cess OCR is browser-local; page pixels must not be uploaded to an OCR API.
- `generativeReconstructionUsed`: must remain `false`. The scanner must not invent or inpaint text or document content that was hidden, blurred, folded, occluded, or lost to glare.

The scorer fails if either invariant is violated.

Do not use live immigration records, passports, IDs, certificates, financial records, medical records, or any other real personal document as a public benchmark fixture. Use purpose-made test sheets or documents containing synthetic data only.

## Real-device collection protocol

For a meaningful release benchmark, collect at least the following matrix on each target device class:

- flat A4/Letter page, even indoor light
- moderate perspective angle
- low light
- overexposure
- localized glare
- uneven side lighting / shadow
- dense small text
- mixed Korean and English
- at least one additional supported non-Latin OCR language
- two-page and multi-page PDF flows

Record both cases that should auto-capture and cases that should be rejected. A dataset containing only clean successful captures cannot measure false-positive behavior.

Recommended minimum for a release comparison is 30 observations per device, with at least 10 negative auto-capture cases and at least 10 OCR cases. Keep the raw camera originals outside the repository when they are large; commit only synthetic/public-safe fixtures and the resulting observation JSON when appropriate.

## Observation format

Each JSON file uses `version: 1` and a `cases` array. A representative case is:

```json
{
  "id": "iphone-perspective-ko-001",
  "image": { "width": 3024, "height": 4032 },
  "expectedQuad": [
    { "x": 0.12, "y": 0.08 },
    { "x": 0.9, "y": 0.12 },
    { "x": 0.88, "y": 0.91 },
    { "x": 0.1, "y": 0.88 }
  ],
  "detectedQuad": [
    { "x": 0.13, "y": 0.09 },
    { "x": 0.89, "y": 0.13 },
    { "x": 0.87, "y": 0.9 },
    { "x": 0.11, "y": 0.87 }
  ],
  "groundTruthText": "Synthetic benchmark text",
  "ocrText": "Synthetic benchmark text",
  "shouldAutoCapture": true,
  "didAutoCapture": true,
  "processingMs": 930,
  "pdfBytes": 350000,
  "pages": 1,
  "ocrRequested": true,
  "searchablePdf": true,
  "externalOcrUpload": false,
  "generativeReconstructionUsed": false
}
```

Coordinates are normalized to the source image (`0` to `1`). The expected quadrilateral should be manually annotated from the visible paper boundary, not derived from the scanner output being evaluated.

## Running the benchmark

From the repository root:

```bash
pnpm test:scanner-benchmark
pnpm benchmark:scanner:smoke
```

To score a real-device observation file directly:

```bash
node scripts/scanner-benchmark/score.mjs path/to/observations.json artifacts/scanner-benchmark/report.json
```

The process exits non-zero when any configured gate fails. The JSON report is suitable for CI artifacts and later trend comparison.
