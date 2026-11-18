# iPhone/iPad, iCloud Drive and native file-picker acceptance

Automated WebKit and Chromium tests check our app's behavior, not the real iOS Files
provider or the institution's physical printer. The tests in this document
**must be run on actual devices** before anyone claims that the file-selection
path is proven in production. Keep the existing
[`WINDOWS_PRINTER_ACCEPTANCE.md`](./WINDOWS_PRINTER_ACCEPTANCE.md) as the
separate physical-output and Windows kiosk acceptance gate.

## Scope and test environment

Record each device's **model, iOS/iPadOS version, browser and version, available
storage**, connectivity (Wi-Fi/cellular), Files-provider type, kiosk release/commit,
Windows build, printer model/driver, and date. At a minimum, test:

- A currently supported iPhone with Safari and iCloud Drive enabled.
- The oldest supported iPhone/iPad and iOS/iPadOS version, including an iPad mini
  4 if that device remains in actual service. Do not infer compatibility from
  its hardware generation; record the installed OS and browser.
- Chrome on iOS/iPadOS if offered to users (it uses the iOS browser platform).
- iPhone **On My iPhone**, iCloud Drive (both local and cloud-only files), and
  at least one installed third-party Files provider if supported.
- The target Windows kiosk app and its approved printer, not only the browser
  kiosk simulator.

Test only generated/synthetic PDFs and photographs. Never use a real visitor's
passport, visa application, photograph, or other sensitive paperwork.

## File selection and iCloud hydration

For each supported device/browser/provider combination:

1. Start a **fresh kiosk QR session**, tap **Files**, and verify the *native*
   file chooser opens with a single tap. If it does not, record device, OS,
   browser, and whether the app is inside an in-app browser.
2. Pick a local one-page synthetic PDF. Verify the preview matches the input,
   then choose a different file and choose the **same PDF again**. The second
   choice must fire and reach the preview. Repeat after deliberately cancelling
   the picker.
3. Pick one synthetic PDF from iCloud Drive already downloaded. Verify the same
   result as the local copy, including the displayed file name and page count.
4. Remove only the **local downloaded copy** of another synthetic PDF from
   iCloud Drive (do not delete its cloud copy). Select it before download,
   wait for iCloud to hydrate it, and verify one of two *safe* outcomes:
   the correct preview, or a bounded "download first and choose again"
   instruction. No blank screen, endless spinner, or partial print submission.
5. Disable connectivity while selecting a cloud-only synthetic PDF, then
   reconnect. The attempt must either recover correctly or give the same
   actionable download instruction. Returning to Files and choosing the file
   after full download must work.
6. Pick multiple supported files (including local + iCloud). Verify the
   selected order, counts, aggregate-size limit, and that all pages appear in
   exactly one print job. Cancel or reject a multi-selection and immediately
   retry with a supported single file.
7. Switch to **Photos** and choose a large JPG and an HEIC/HEIF image if the
   device supports it. Verify orientation and preview pixels (not just a file
   name). Select the same image again. Confirm that an iCloud Photos download
   has either completed or failed with an instruction rather than a crash.
8. Use **Files** to select an unsupported DOCX or other format, a PDF with a
   misleading extension, a deliberately damaged PDF, a password-protected PDF,
   and a file exceeding the per-file limit. Verify each case is accepted for
   *selection* but is **not silently transmitted** unless the app's conversion,
   password and validation policy explicitly permits it. Messages must name
   the actionable next step.
9. Switch the UI language and repeat an unsuccessful cloud selection. Verify
   the notice, source-picker buttons, and retry action remain accessible.
10. Repeat the flow at minimum supported viewport widths, after backgrounding
    and resuming Safari, and after the QR session expires. Never claim success
    for an already expired session.

## Automatic regression coverage

The GitHub CI suite provides **simulations**, not real iCloud provider access:

- `apps/web/test/e2e/print-flow.spec.ts`: native chooser button, cloud-style
  PDFs, same-file reselection, cancellation, unsupported cloud documents,
  iCloud-style read retries, and validated-image preview pixels.
- `apps/web/src/lib/file-validation.test.ts`: empty/partial/stalled provider
  reads, FileReader fallback, stale size metadata, file signatures, and local
  image-byte decoding.
- `apps/web/test/e2e/drop-flow.spec.ts`: four-slot pairing keypad at 320 px,
  thumb input, backspace, restart and horizontal overflow (this covers the
  separately tracked WebKit/pairing gap).

To run the automated checks, use the repository's pinned package manager and
dependencies, then `pnpm --filter @print-cess/web test:e2e -- --project=iphone`
if your pnpm/Playwright setup supports passing arguments that way, or run
`pnpm --filter @print-cess/web exec playwright test --project=iphone` directly.
A passing automated WebKit run **does not close this physical acceptance gate**.

## Printer and evidence gate

After choosing a synthetic file on an actual iPhone, print it at the approved
Windows kiosk and physically inspect A4 paper. Include a high-resolution photo
exceeding **3,508 pixels** on its long side, a one-page PDF, a multi-page PDF,
a rotated image, and a two-file batch. Observe paper count, ordering, clipping,
grayscale, orientation, driver defaults and no duplicate spool submissions.
Compare the high-resolution photo against a **previously approved baseline**
using the same printer, driver, paper and settings.

Record a pass/fail and precise reproduction steps for every case. Redact
filenames or paths that identify a person. Keep only synthetic fixture hashes,
OS/browser/provider versions, timestamps, release SHA, printer/driver versions,
and screenshots free of personal data. Store the signed result in the
institution's **private** acceptance records. Leave unresolved cases OPEN;
never substitute a successful simulated CI run for real hardware evidence.

**Exit criteria:** all supported local and iCloud file-selection scenarios
complete without an unrecoverable UI state; invalid/unavailable files fail with
an actionable and localized message; the bytes confirmed in preview match
what is submitted; and the separate physical printer matrix is approved.
Physical acceptance is **pending until signed evidence exists**.
