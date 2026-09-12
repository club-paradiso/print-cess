# Print-cess scanner quality gates

Print-cess treats a successful scan as a document capture problem, not merely an image-to-PDF conversion.

## Capture gate

Automatic capture is allowed only after the document quadrilateral remains stable across consecutive analyzed frames and the frame passes all of these checks:

- a plausible four-corner document is detected;
- document coverage is large enough to preserve useful resolution;
- mean exposure is neither dark nor clipped bright;
- local clipped-highlight concentration does not indicate strong glare;
- sampled Laplacian detail is high enough to reject obvious motion/focus blur.

A frame that fails a gate is not auto-captured. The UI asks the user to move closer, add/reduce light, reduce glare, or hold still instead.

## Geometry gate

- automatic detection evaluates multiple Canny thresholds rather than trusting one global threshold;
- detected quadrilaterals must be convex, cover a plausible portion of the frame, and have usable side lengths;
- perspective correction is a four-point projective transform;
- manual four-corner adjustment remains available when automatic detection is uncertain.

## Enhancement gate

Auto, grayscale, and black-and-white modes estimate low-frequency illumination and normalize it before contrast enhancement. This reduces ordinary desk shadows and uneven page lighting without inventing missing text. Color mode applies illumination normalization before sharpening.

## Searchability gate

When OCR is enabled, recognition runs in the browser. Page pixels are not posted to an OCR API. The OCR engine and language data are downloaded on first use. Recognized word bounding boxes are embedded as an invisible Unicode text layer in the generated PDF using a ToUnicode map.

If OCR initialization or recognition fails, Print-cess does not silently claim that the PDF is searchable. It offers an explicit image-only PDF fallback instead.

## Safety boundary

The scanner deliberately does not use generative inpainting to reconstruct text hidden by fingers, glare, folds, or other occlusion. Fabricating document content would be worse than asking for a retake. Severe capture defects should fail the capture gate or remain visible for user review.

## Verification

The repository must keep unit coverage for geometry, capture-quality classification, Unicode searchable-PDF generation, and OCR-language selection. Browser E2E must preserve both the deterministic image-only workflow and the searchable-PDF workflow with a local OCR mock, plus camera-permission fallback behavior.
