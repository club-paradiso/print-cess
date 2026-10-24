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
PRINT  (first visitor section, most of the first screen)
  heading, two short instructions, the Beacon on a drawn screen, two buttons
HOW PRINTING WORKS  (three steps on one perforated strip: scan, pick, take your paper)
MORE YOU CAN DO HERE
  SHARE  SCAN   (two smaller sheets)
No account needed   (true of every tool; Print's own deletion promise sits in the Print section)
At work or on a public computer   (use this device as the print screen, work computer)
```

- **Print remains the page's `h1` and primary visitor task.** The `h2`s are the three steps,
  "More you can do here" and the workplace group; Share and Scan are `h3`s inside the second.
- **The Beacon comes before the buttons.** On a phone it sits in a compact row (a small drawing
  of the screen with the Beacon and a QR code, beside "Look for the screen with this mark.") so
  the two buttons stay on the first screen. From 900 px up it moves to its own card beside the
  copy.
- **Three steps, once, after the Beacon.** The old four-step list competed with the first action
  and repeated the rescue sheet. The new strip has three steps (scan, pick, take your paper), no
  "find the screen" step (the Beacon and the rescue sheet do that job), and sits below the Print
  section so it never competes with the first thing to do.
- **Setup entrances close the page.** "Use this device as the print screen" used to be a
  full-width CTA above Print, and a visitor standing in a queue read it as one more choice. It now
  sits with the work-computer link in the workplace group at the bottom: still a plain, labelled
  link, still hidden when the browser kiosk is disabled in Production.
- **One primary button per screen.** "Scan QR code" is the only primary button. Share and Scan
  use secondary buttons.
- **Share and Scan keep their buttons and routes.** They are smaller, not hidden.
- **Print still links nowhere.** A print session can only begin at the screen's QR code, so no
  control on the page points at a print route. Its two buttons open sheets on the same page.
- **No device-specific page.** Phone and computer visitors see one page. The layout changes with
  width, but no copy or action differs by device.

Korean copy follows `docs/BRAND.md` (Voice): everyday verbs over product words ("찍기" rather
than "스캔하기" for pointing the camera at the code), sentences that end in the action, and no
promise beyond what the system does.

## The Beacon

One marker, shown in two places: on the phone's home page and on the shared display.

- **Look:** the Print-cess mark on a white sheet, inside a solid Royal Indigo rounded tile, wrapped
  in the mark's own four scan-frame corners. No gradient, no shadow, no animation.
- **Why this shape:** it reuses existing brand parts (the printer mark, the scan frame, Royal
  Indigo, the white sheet). A visitor matches indigo tile plus corner brackets to the same tile on
  the display, so finding the display is a recognition task, not a reading one.
- **Where:** `Beacon` in `packages/ui` (`pc-beacon` in `packages/ui/src/styles.css`). Home:
  `print-entry__beacon`, with "Look for the screen with this mark." Display: `kiosk-beacon` above
  the headline, with no label of its own (see "Kiosk copy" below). The rescue sheet repeats it on
  step 2.
- **Never near the QR code.** It sits in the display's header, away from the code, so the QR keeps
  its full quiet zone and colours (`apps/web/src/lib/qr-style.ts`).
- **Never the only carrier of meaning.** It is `aria-hidden`. The words around it say the same
  thing, so the page works with a screen reader and in forced-colours mode.

## Terminology: why consumer copy says "화면", not "키오스크"

"키오스크" is an installer's category word. A first-time visitor gains nothing from learning it and
may not recognise it. The consumer page and the QR scanner use concrete descriptions instead:
"프린터 옆 큰 화면" and "Print-cess 화면" (English: "the Print-cess screen", "the big screen").
This follows `BRAND.md` (Voice), which already asked for "the big screen" over "the kiosk".

"Kiosk" stays in administrator, installation and developer surfaces, and in code identifiers, where
the category genuinely matters. The one home-page link that opens the display on the current device
now reads "이 기기를 Print-cess 화면으로 쓰기" / "Use this device as the print screen", because
that is what it does. It sits in the workplace group at the bottom of the page, with the
work-computer link (see Hierarchy).

Other languages' strings were updated for meaning, not re-edited for style. See "Review
needed" below.

## Rescue paths

Both open as a native `<dialog>`: a bottom sheet on a phone, centred above 640 px. Focus is
trapped, Escape closes, and the page behind keeps its place.

### "QR 코드 스캔하기" (Scan QR code)

The phone's own camera app stays the primary route and needs no page. This button is for a visitor
who opened the home page first.

1. Opens the rear camera and looks for a QR code with the browser's `BarcodeDetector`. Where that
   API is missing (iOS Safari among others) it first loads jsQR 1.4.0 once, before the camera
   opens so a stalled download can never leave the camera on, from
   `cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js` with a pinned SRI hash, and decodes frames drawn
   to a canvas capped at 960 px (`apps/web/src/lib/drop-scanner.ts`). Camera frames stay in the
   browser; only the decoder script is fetched. The receive flow shares this scanner.
2. Accepts a code **only** if `parsePrintSessionQr` (`apps/web/src/lib/print-qr.ts`) passes it: the
   same origin as this page or the deployment's `PUBLIC_BASE_URL` origin (the kiosk builds its QR
   from that, and in Production it is the host that redirects here), no credentials or query
   string, path exactly `/s/<session id>` with a canonical session id, and a fragment
   `parseSessionFragment` accepts. The navigation target is
   rebuilt from the checked parts. The scanned text is never navigated to.
3. A QR code that fails (a menu, another site, another Print-cess deployment, a lookalike domain)
   shows "여기서 인쇄할 수 있는 QR 코드가 아니에요…" and goes nowhere. The scan continues.
4. Camera refused: says so and points to the phone's camera app.
5. No camera API, or the jsQR fallback could not load (offline, blocked CDN, integrity mismatch):
   says the browser cannot scan here and points to the phone's camera app, with the rescue sheet one
   tap away. A decoder that failed to load is never reported as a refused camera.

**Expired or already-used codes** cannot be detected in the browser. Only the server knows. A valid
looking code opens the session page, which already explains an expired or used code.

**Browser support, stated honestly.** `BarcodeDetector` support varies by browser and platform
(Chromium on Android has it; Chromium on Linux and iOS Safari do not). The jsQR fallback was first
written on #117 and lost when that branch was resolved against `main`; it was restored with the
pinned SRI hash on 2026-10-12. Automated coverage: `drop-scanner.test.ts` (native path, fallback
decode, loader URL and integrity, load failure) and the Chromium and WebKit (iPhone 15 profile) e2e in
`v2-experience.spec.ts` with a stand-in decoder. **Not yet verified on a physical iPhone**: decoding
the live kiosk QR in Safari, the time to first read, and heat on older phones. Until that check, the
phone's camera app remains the documented primary route.

### "화면을 못 찾겠어요" (I can't find the screen)

Three drawn steps, in order: find the printer, find the big screen beside it (shown with the
Beacon), scan the QR code on that screen. The scan button is repeated at the bottom. There is one
line of text after it, no FAQ and no accordions.

## Kiosk display

Since 2026-10-13 the root URL `/` opens the shared display itself (the same screen and
`?printing=auto` / `?sound=off` switches as `/kiosk`), so a station can simply be pointed at the
domain. The visitor's guide described in the sections above moved to `/start`, and every "home"
link (the header name, the 404 page and the workstation page) now points
there. When the browser kiosk is switched off in Production, `/` redirects to `/start` instead of
returning 404.

`/kiosk` (and `/demo/kiosk`, which shares its screens through
`apps/web/src/components/kiosk/kiosk-screens.tsx`) is the primary screen of the service, so it was
redesigned on 2026-10-13 to be read from a few steps away in a few seconds:

- **Waiting.** Left: the Beacon (unlabelled), one headline
  ("휴대전화 카메라로 QR 코드를 비추세요"), English beneath it, the rotating language line, and the
  whole visit as three steps (point the camera, choose files on the phone, take the paper), with
  the first drawn as current. Right: the QR code on a solid Royal Indigo panel, the largest block
  of colour on the screen, with "사진은 찍지 않아도 돼요" above the code and an emptying bar plus
  the countdown below it. A footer carries the small print (deletion, no sign-up, file types,
  languages). The old green "사용할 수 있어요" banner is gone; a small header pill appears only
  while the code is being made ("QR 코드를 준비하고 있어요").
- **Sizing.** On landscape displays from 961×700 the screen never scrolls: the code sits in a
  size container and is the largest square that fits (`min(100cqw, 100cqh)`), up to 600 px plus
  its padding. This fixes 1280×1024, where the old `height: 100%` rule pushed the code past its
  column. Portrait displays stack the words above the code and let the code grow with the width.
- **Phone connected.** A stage-specific headline and one-line hint (choose files on the phone /
  receiving / wait at the printer) above a four-station tracker (connected, arriving, checking,
  printing) that marks each station with a word and an icon as well as colour.
- **Done.** "프린터에서 종이를 가져가세요" on the indigo panel is the loudest thing on the screen; the
  staff download stays the quietest control, and an emptying bar shows when the next QR appears.
- **Unavailable.** The display retries on its own after 30 seconds, because a shared screen is
  usually unattended; the button stays for anyone who does not want to wait.

The Beacon still sits away from the code, so the QR keeps its full quiet zone and colours.

### Kiosk copy

Reviewed on 2026-10-13 for words a first-time visitor could misread. Each change, and why:

| Was                                    | Now                                                    | Why                                                                                     |
| -------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| 여기서 인쇄 시작 / Start printing here | (removed; the Beacon stays, unlabelled)                | Read as a button to press on a screen that takes no input; the headline already says it |
| 사용할 수 있어요 (header pill)         | shown only while preparing: QR 코드를 준비하고 있어요  | "Available" left visitors asking what was available                                     |
| 화면에 나타나는 링크를 누르세요        | 휴대전화에 뜨는 링크를 누르세요                        | "화면" could mean this display, which has no link                                       |
| QR 코드 변경까지                       | 새 QR 코드로 바뀌기까지                                | "변경" is an administrative word                                                        |
| 13개 언어 · languages                  | 휴대전화 화면은 13개 언어 지원                         | The display itself cannot change language; the phone can                                |
| [인쇄하기]를 누르세요                  | 휴대전화의 인쇄 버튼을 누르세요                        | The phone's button reads "파일 N개 인쇄", not "인쇄하기"                                |
| 작업 만료까지                          | 남은 시간                                              | "작업 만료" is system jargon                                                            |
| 선택한 파일 N개를 처리했습니다         | 파일 N개를 프린터로 보냈어요 (or 인쇄할 준비를 했어요) | "처리" says nothing about where the paper is                                            |
| 서버에 보관된 파일은 삭제됐습니다      | 보내신 파일은 모두 지웠어요                            | Visitors do not know or need "서버"                                                     |
| 새 QR 코드 만들기 (failure screen)     | 다시 시도하기                                          | The visitor's goal is to retry, not to make a code                                      |
| 보내신 파일은 삭제됐습니다 (failure)   | (removed)                                              | Often nothing had been sent yet, so it raised a question it did not answer              |

`kioskStartHere` was removed from all thirteen locales.

## Languages

All thirteen locales have every new key; the type of `Translation` enforces parity. Korean and
English had a full editorial pass. The other eleven were written for meaning and plain register,
not polished, and **need native-speaker review** before being treated as final: `zh-CN`, `id`,
`fil`, `vi`, `th`, `ne`, `km`, `ar`, `ru`, `mn`, `uk`.

Keys added: `homePrintHeading`, `homePrintLead`, `homePrintLead2`, `homeBeaconCaption`,
`homeScanQrCta`, `homeLostCta`, `homePrintStepFind`, `homeStepsLabel`, `homeLostTitle`,
`homeLostStep1`–`3`, `homeLostHint`, `homeDialogClose`, `qrScanTitle`, `qrScanHint`,
`qrScanStarting`, `qrScanDenied`, `qrScanUnsupported`, `qrScanInvalid`, and `kioskStartHere`
(removed again on 2026-10-13, see "Kiosk copy").
Removed: `homeTitle`, `homeLead`, `homePrintBody`. Reworded: `homeKioskCta`.

Spelling note: all Korean strings write "QR 코드" with a space, the standard spacing.

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
