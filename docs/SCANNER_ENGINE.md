# Print-cess document scanner

The scanner is a local-first browser document pipeline. Source photos are not uploaded for image correction.

## Processing pipeline

1. Decode the source photo in the browser and downscale a copy for detection.
2. Load OpenCV.js only when scanning is used.
3. Convert the detection image to grayscale, blur noise, run Canny edge detection, and close small gaps.
4. Find contours and approximate polygons. Prefer a large convex four-corner document candidate with near-right-angle geometry.
5. Fall back to a near-full-frame crop when a reliable document contour is not found. The UI marks that page for review.
6. Let the user drag all four crop corners or request automatic detection again.
7. Apply a true four-point perspective transform with `getPerspectiveTransform` and `warpPerspective`.
8. Apply the selected document treatment: auto clean, color, grayscale, or adaptive black-and-white.
9. Generate the multi-page PDF locally and hand it to the existing Print-cess share, download, print, or encrypted kiosk-upload flow.

## Privacy and performance

- OpenCV is dynamically imported so normal Print-cess pages do not pay the computer-vision startup cost.
- Detection uses a smaller working image; final processing caps the longest source edge to control mobile memory use.
- Camera/gallery photos and corrected image bytes stay in the browser unless the user explicitly shares, downloads, prints, or sends the completed PDF through Print-cess.

## Verification

- Geometry unit tests cover corner ordering, normalized area, and manual crop clamping.
- Browser E2E uploads a synthetic skewed document, requires automatic edge detection, opens the four-corner editor, switches to black-and-white processing, and verifies that a PDF is produced without page errors.
