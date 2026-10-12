# Print-cess document scanner

The scanner is a local-first browser document pipeline. Source photos are not uploaded for image correction.

## Processing pipeline

1. Decode the source photo in the browser and downscale a copy for detection.
2. Load OpenCV.js only when scanning is used.
3. Convert the detection image to grayscale, blur noise, run Canny edge detection, and close small gaps.
4. Find contours and approximate polygons. Prefer a convex four-corner candidate that covers a
   plausible share of the frame and whose corners stay within a realistic perspective range
   (about 65–115° at a 40° tilt). A candidate with a side lying along the photo's own edge is
   rejected: that is the desk, a tablecloth or the frame, never the page, and it used to outscore
   the real page simply by being larger.
5. Fall back to a near-full-frame crop when a reliable document contour is not found. The UI marks that page for review.
6. Let the user drag all four crop corners or request automatic detection again.
7. Recover the page's real proportions from its foreshortening (Zhang & He, whiteboard scanning),
   with the principal point at the image centre. With two vanishing points the focal length comes
   from the page itself; a sheet tilted straight back has only one, so a typical phone focal length
   (0.8× the long edge) stands in. Then apply a true four-point perspective transform with
   `getPerspectiveTransform` and `warpPerspective` into a page of those proportions. Taking the
   longer of each pair of opposite sides instead made a tilted A4 sheet about a quarter too wide.
8. Apply the selected document treatment: auto clean, color, grayscale, or adaptive black-and-white.
   Auto clean and grayscale normalize illumination and then stretch levels so the paper is white;
   histogram equalization is not used, because on a page that is mostly paper it spreads the paper
   itself into grey and inflates the JPEG.
9. Generate the multi-page PDF locally and hand it to the existing Print-cess share, download, print, or encrypted kiosk-upload flow.

## Privacy and performance

- OpenCV is dynamically imported so normal Print-cess pages do not pay the computer-vision startup cost.
- Detection uses a smaller working image; final processing caps the longest source edge to control mobile memory use.
- Camera/gallery photos and corrected image bytes stay in the browser unless the user explicitly shares, downloads, prints, or sends the completed PDF through Print-cess.

## Verification

- Geometry unit tests cover corner ordering, normalized area, manual crop clamping, frame-edge
  rejection, and proportion recovery across camera angles and focal lengths
  (`apps/web/src/lib/scan-geometry.test.ts`).
- Browser E2E uploads a synthetic skewed document, requires automatic edge detection, opens the four-corner editor, switches to black-and-white processing, and verifies that a PDF is produced without page errors.
- **Accuracy against a known answer.** `/demo/scanner-lab` (development and CI only) draws sixteen
  synthetic phone photos of an A4 sheet placed in 3D, so the true corners and proportions are
  exact: flat, tilted, steep, turned, sideways, shadowed, cluttered, low-contrast, patterned, dim
  and noisy pages that must be found and auto-captured, and too-far, glare, too-dark, blurred,
  cut-off and empty scenes that must not be auto-captured. Each runs through the same detection,
  live-camera capture check, perspective correction and PDF steps as the scan screen.
  `apps/web/test/e2e/scanner-accuracy.spec.ts` scores the results with the benchmark gates in
  `scripts/scanner-benchmark/metrics.mjs` and holds every scene to its own floor (edge IoU ≥ 0.95,
  proportions within 10%, desk bleed in the crop ≤ 12%), and writes
  `artifacts/scanner-benchmark/synthetic-render-*.json` for CI. Opening the lab page and pressing
  **Run all scenes** shows each scene with the true edge (green) and the detected edge (orange).
- These are synthetic results. They catch regressions in the pipeline; claims about real phones
  still need the real-device tier in `benchmarks/scanner/README.md`.
