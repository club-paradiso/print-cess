export const SCANNER_QUALITY_TARGETS = {
  minimumAutoCaptureScore: 0.62,
  minimumDetectionConfidence: 0.48,
  minimumDocumentCoverage: 0.28,
  minimumSharpness: 0.14,
  minimumBrightness: 0.2,
  maximumBrightness: 0.96,
  maximumLocalizedGlare: 0.72,
  stableFrameCount: 3,
  stableQuadDrift: 0.018,
} as const;
