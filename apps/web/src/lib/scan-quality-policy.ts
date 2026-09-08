export const SCANNER_QUALITY_POLICY = {
  autoCapture: {
    minimumScore: 0.62,
    stableFrameCount: 3,
    stableQuadDrift: 0.018,
    newPageQuadDrift: 0.055,
  },
  frame: {
    minimumDetectionConfidence: 0.48,
    minimumDocumentCoverage: 0.28,
    minimumBrightness: 0.2,
    maximumBrightness: 0.96,
    minimumSharpness: 0.14,
    maximumLocalizedGlare: 0.72,
  },
} as const;
