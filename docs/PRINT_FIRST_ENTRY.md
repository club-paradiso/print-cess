# Print-first entry: finding the screen

The Print-cess home page used to present Print, Share and Scan as three near-equal sheets. Print
was the only one without a button, so the feature most visitors came for looked like the least
actionable one. This document records why Print now leads the page, what the Beacon is, how a
visitor who arrived by the wrong door recovers, and how to test whether any of it works.

`PRODUCT_V2.md` still describes the three-capability model. That model is unchanged. What changed
is the order of attention.

---

## The failure being fixed

Observed in real use, not inferred: visitors reach the home page, cannot tell where the large
Print-cess screen is or how printing starts, and ask staff.

Why the old page produced that:

1. **"The screen" had no referent.** The page said printing "starts at the screen next to the
   printer". A first-time visitor does not know which object that is, and nothing on the page
   showed them what to look for.
2. **Print had no action.** Share and Scan carried buttons. Print carried a numbered list, which
   reads as information, not as something to do.
3. **The three sheets ranked equally.** A visitor had to understand the product's architecture
   (three capabilities, one of which only starts elsewhere) before they could find their own task.
4. **There was no way back.** A visitor who opened the home page without scanning had nothing to
   try except reading again.

The page should not need to explain Print-cess. It should make the next physical action
recognisable in a few seconds.

## Hierarchy

```text
Print-cess identity
PRINT  (first section, most of the first screen)
  heading, one instruction, the Beacon, two buttons, four steps
SHARE  SCAN   (two smaller sheets)
Workplace entrances   (links under a hairline)
```

- **Print is the page's `h1`.** "Here to print?" is the question most visitors arrive with. The
  `h2`s are Share, Scan and the workplace group.
- **Share and Scan keep their buttons and routes.** They are smaller, not hidden. A visitor who
  wants them finds them below Print without scrolling past anything else.
- **Print still links nowhere.** A print session can only begin at the screen's QR code, so no
  control on the page points at a print route. Its two buttons open sheets on the same page.
- **No device-specific page.** Phone and computer visitors see one page. The layout changes with
  width (a side-by-side Print section from 900 px up), but no copy or action differs by device.
  A computer visitor with a file on that computer is not given a different promise: the
  managed-workstation entry stays where it was, and Share remains the way to move a file to a
  phone. Adding a "this computer" branch would be a second product, so it was not built.

## The Beacon

One marker, shown in two places: on the phone's home page and on the shared display.

- **Look:** the Print-cess mark on a white sheet, inside a solid Royal Indigo rounded tile, wrapped
  in the mark's own four scan-frame corners. No gradient, no shadow, no animation.
- **Why this shape:** it reuses existing brand parts (the printer mark, the scan frame, Royal
  Indigo, the white sheet). A visitor matches indigo tile plus corner brackets to the same tile on
  the display, so finding the display is a recognition task, not a reading one.
- **Where:** `Beacon` in `packages/ui` (`pc-beacon` in `packages/ui/src/styles.css`). Home:
  `print-entry__beacon`, with "Look for the screen with this mark." Display: `kiosk-beacon` in the
  header, with "여기서 인쇄 시작 / Start printing here". The rescue sheet repeats it on step 2.
- **Never near the QR code.** It sits in the display's header, away from the code, so the QR keeps
  its full quiet zone and colours (`apps/web/src/lib/qr-style.ts`).
- **Never the only carrier of meaning.** It is `aria-hidden`. The words beside it say the same
  thing, so the page works with a screen reader and in forced-colours mode.

## Terminology: why consumer copy says "화면", not "키오스크"

"키오스크" is an installer's category word. A first-time visitor gains nothing from learning it and
may not recognise it. The consumer page and the QR scanner use concrete descriptions instead:
"프린터 옆 큰 화면" and "Print-cess 화면" (English: "the Print-cess screen", "the big screen").
This follows `BRAND.md` (Voice), which already asked for "the big screen" over "the kiosk".

"Kiosk" stays in administrator, installation and developer surfaces, and in code identifiers, where
the category genuinely matters. The one home-page link that opens the display on the current device
now reads "이 기기를 Print-cess 화면으로 쓰기" / "Use this device as the print screen", because
that is what it does and it sits in the workplace group, not in the visitor's path.

Other languages' strings were updated for meaning, not re-edited for style. See "Review
needed" below.

## Rescue paths

Both open as a native `<dialog>`: a bottom sheet on a phone, centred above 640 px. Focus is
trapped, Escape closes, and the page behind keeps its place.

### "QR 코드 스캔하기" (Scan QR code)

The phone's own camera app stays the primary route and needs no page. This button is for a visitor
who opened the home page first.

1. Opens the rear camera and looks for a QR code with the browser's `BarcodeDetector` (no added
   dependency; the existing receive flow already scans this way).
2. Accepts a code **only** if `parsePrintSessionQr` (`apps/web/src/lib/print-qr.ts`) passes it: the
   same origin as this page, no credentials or query string, path exactly `/s/<session id>` with a
   canonical session id, and a fragment `parseSessionFragment` accepts. The navigation target is
   rebuilt from the checked parts. The scanned text is never navigated to.
3. A QR code that fails (a menu, another site, another Print-cess deployment, a lookalike domain)
   shows "여기서 인쇄할 수 있는 QR 코드가 아니에요…" and goes nowhere. The scan continues.
4. Camera refused: says so and points to the phone's camera app.
5. No `BarcodeDetector` (see below): says the browser cannot scan here and points to the phone's
   camera app, with the rescue sheet one tap away.

**Expired or already-used codes** cannot be detected in the browser. Only the server knows. A valid
looking code opens the session page, which already explains an expired or used code.

**Browser support, stated honestly.** `BarcodeDetector` support varies by browser and platform
(Chromium on Android has it; Chromium on Linux does not). Support on iOS Safari was **not verified
on a device** for this change. Wherever it is missing, the visitor reaches step 5 and is told to use
the camera app. That is the intended fallback, not a defect, and it is why the phone's camera app
remains the documented primary route. A bundled decoder
(jsQR or a WASM decoder) would close the iOS gap at the cost of a new dependency and download; it
was not added without a decision to accept that cost. Physical iPhone testing is still required.

### "화면을 못 찾겠어요" (I can't find the screen)

Three drawn steps, in order: find the printer, find the big screen beside it (shown with the
Beacon), scan the QR code on that screen. The scan button is repeated at the bottom. There is one
line of text after it, no FAQ and no accordions.

## Kiosk display

`/kiosk` and `/demo/kiosk` show the Beacon in the header with "여기서 인쇄 시작 / Start printing
here". The QR column is unchanged apart from a 20 px larger height reservation for the taller
header (`--kiosk-qr-size` subtracts 380 px instead of 360 px), so on short displays the QR is
about 20 px smaller (about 354 px wide at 1366×768). At 1920×1080 the QR is capped by its maximum
size and does not change.

## Languages

All thirteen locales have every new key; the type of `Translation` enforces parity. Korean and
English had a full editorial pass. The other eleven were written for meaning and plain register,
not polished, and **need native-speaker review** before being treated as final: `zh-CN`, `id`,
`fil`, `vi`, `th`, `ne`, `km`, `ar`, `ru`, `mn`, `uk`.

Keys added: `homePrintHeading`, `homePrintLead`, `homePrintLead2`, `homeBeaconCaption`,
`homeScanQrCta`, `homeLostCta`, `homePrintStepFind`, `homeStepsLabel`, `homeLostTitle`,
`homeLostStep1`–`3`, `homeLostHint`, `homeDialogClose`, `qrScanTitle`, `qrScanHint`,
`qrScanStarting`, `qrScanDenied`, `qrScanUnsupported`, `qrScanInvalid`, `kioskStartHere`.
Removed: `homeTitle`, `homeLead`, `homePrintBody`. Reworded: `homeKioskCta`.

Spelling note: existing Korean strings write "QR코드" without a space; the new strings write
"QR 코드", which is the standard spacing. They have not been unified.

---

## Usability test protocol

Run this with people who match real visitors: unfamiliar with computers, not briefed. Nothing here
is a result. Targets are goals; no figure in this repository claims to have been achieved until
sessions have been run and recorded.

**Setup.** A working Print-cess display and printer in their normal place. The participant has a
phone with a PDF on it. The facilitator does not stand near the display.

**Instruction, verbatim:** "휴대폰에 이 PDF가 있습니다. 여기서 한 장 출력해보세요."

**Do not** explain Print-cess, point at the display, say "QR", or say which website to open. Answer
nothing about how. If the participant asks for help, note the time and the question, then give the
minimum help.

**Record per participant:**

| Measure                                              | How                                                      |
| ---------------------------------------------------- | -------------------------------------------------------- |
| Time to identify the correct display                 | Seconds from instruction to the participant facing it    |
| Staff help requested                                 | Yes/no, and the question asked                           |
| Entered Share or Scan by mistake                     | Yes/no                                                   |
| Scanned the correct QR code                          | Yes/no, and by phone camera app or by the page's scanner |
| Print session started                                | Yes/no                                                   |
| Which door they used (home page, camera app, direct) | Observation                                              |

**Targets (goals, not results):**

- Median time to identify the QR display: 10 seconds or less.
- Display discovery success: 95% or more.
- Sessions started without staff help: 90% or more.
- Accidental Share or Scan entry: under 5%.

Record device and browser, and run on at least one iPhone and one Android phone. Compare the
Beacon on the phone against the display only after the participant has identified it unprompted:
do not ask "do you see this mark?".
