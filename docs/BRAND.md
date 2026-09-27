# Brand and content guide

## Name and descriptors

The formal product name is **Print-cess by Paradiso**. Use the full name in screen titles,
metadata, README-level descriptions, installers, and first mention. “Print-cess” is acceptable in
compact repeated UI after the full-name context is visible.

- English descriptor: **Secure self-service document printing**
- Korean descriptor: **휴대전화에서 보내고 바로 출력하는 안전한 셀프 인쇄**
- Windows display name: **Print-cess Kiosk**

Do not imply a relationship with the unrelated “Printess” service. Paradiso is the parent brand.
No prior parent brand or repository name may remain in content or metadata.

## Visual language

The product is calm civic-service infrastructure: clear, steady, accessible, and neutral. The
name's wordplay may appear once in the primary mark through a compact tiara-shaped paper edge,
but it must remain readable first as a printer. Do not add castles, princess characters, ornate
scripts, glitter effects, luxury motifs, or an excess of pink. Decoration never competes with the
next action.

### Palette

The palette comes from the Print-cess mark. Five brand colours, each with one job:

| Name         | Value     | Job                                                            |
| ------------ | --------- | -------------------------------------------------------------- |
| Royal Indigo | `#4f46e5` | The one primary action per screen, work in progress, the mark  |
| Ink Navy     | `#1e1b4b` | Headings and strong text, QR modules, the camera viewfinder    |
| Paper White  | `#f8fafc` | Page background everywhere                                     |
| Soft Lilac   | `#e9e5ff` | Selected and informational surfaces, icon tiles                |
| Mint Teal    | `#14b8a6` | Success and "safe" only: printed, saved, deleted, ready to use |

Mint Teal is 2.5:1 on white, so it is a fill and an accent and never the colour of text; success
text uses its deeper step `#0f766e` (5.5:1). Success is never the colour of a primary button.
Amber is reserved for "look twice" (a lost connection, a limited browser) and red for errors and
destructive actions. Nothing else gets a colour.

### Tokens

`packages/ui/src/styles.css` is the single source. It has two layers: the palette
(`--pc-indigo-600`, `--pc-navy-900`, …) and a semantic layer that components read. Components and
app styles use only the semantic layer, never a raw hue or hex:

| Group   | Tokens                                                                                                                                                     |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Surface | `--pc-background`, `--pc-surface`, `--pc-surface-raised`, `--pc-surface-sunken`, `--pc-surface-brand`, `--pc-surface-brand-subtle`, `--pc-surface-inverse` |
| Text    | `--pc-text-primary`, `--pc-text-secondary`, `--pc-text-muted`, `--pc-text-brand`, `--pc-text-on-brand`, `--pc-text-on-inverse`                             |
| Line    | `--pc-border`, `--pc-border-strong`                                                                                                                        |
| Action  | `--pc-brand`, `--pc-brand-hover`, `--pc-brand-active`, `--pc-selected`, `--pc-disabled-*`                                                                  |
| State   | `--pc-success*`, `--pc-warning*`, `--pc-destructive*`, `--pc-upload-active`, `--pc-transfer-active`, `--pc-printing`, `--pc-completed`                     |
| Focus   | `--pc-focus-ring` (indigo, 3px, 3px offset), `--pc-focus-ring-on-inverse`                                                                                  |
| Shape   | `--pc-radius-sm` 10, `-md` 14, `-lg` 20, `-xl` 28, `-pill`                                                                                                 |
| Depth   | `--pc-shadow-sm`, `--pc-shadow-md`, `--pc-shadow-lg`, `--pc-scrim`                                                                                         |
| Type    | `--pc-font-sans`, `--pc-font-mono`, `--pc-text-display` … `--pc-text-helper`                                                                               |
| Motion  | `--pc-ease-out`, `--pc-duration-fast` / `-base` / `-slow`                                                                                                  |

Every text pairing in the semantic layer is measured against WCAG 2.2 AA; the table sits at the
top of the token file. QR codes are drawn on a canvas and cannot read CSS, so their two colours
live in `apps/web/src/lib/qr-style.ts` (Ink Navy on white; a tinted code scans worse).

Gradients belong to the app icon only. Buttons, cards, navigation, forms, kiosk controls, and
error messages are solid colour. Rounded corners are moderate and follow the radius scale; pills
are for small chips and the language/help controls, not for panels.

The product is light-only by decision, not omission: the kiosk is a controlled public display,
managed workstations run fixed themes, and the phone visit is a few minutes in a lit office. The
camera viewfinder is the one dark surface. A dark theme, if the phone flow ever earns one, is a
redefinition of the semantic layer and nothing else.

### Type

A system sans-serif stack led by Pretendard and Inter where they are installed, then the
platform's own Korean and Latin faces (`--pc-font-sans`). No web font is downloaded: the kiosk and
managed workstations may block font hosts, and a first paint that swaps typeface is worse than a
good system face. Headings are heavy and tightly tracked; body copy is 18 px at 1.55 line height;
Korean text breaks between words (`word-break: keep-all`). Identifiers such as transfer codes use
`--pc-font-mono`.

Primary controls are at least 64 px high and focus indication is obvious. Color never carries
meaning alone. Test contrast in every state.

### Components

`packages/ui` carries only what the screens use: `Wordmark` and `PrintcessMark`, `PrimaryButton`,
`SecondaryButton`, `TertiaryButton`, `DestructiveButton`, `ProgressSteps` (a segmented bar),
`StatusIcon` (info, success, warning, error), `ScanFrame` (the mark's four QR corners, drawn
around any code the service shows), `HandoffIllustration` (a sheet entering or leaving the
printer while the service is genuinely working), and `ScreenShell`. Icons are Lucide throughout;
the mark is the only custom drawing, and emoji are not used.

## Wordmark and icon

The mark is a printer. The sheet going in has a crown's three points and a small jewel above it;
the sheet coming out carries a four-corner scan frame; a mint status light sits on the body. The
crown is the name's only princess reference and must read as paper before it reads as a tiara.
Do not add castles, characters, glitter, or more crowns elsewhere in the interface.

The wordmark sets “Print-” in Ink Navy and “cess” in Royal Indigo, heavy and tightly tracked, with
“by Club Paradiso” as a quieter endorsement. On a phone header the endorsement stacks under the
name so the lockup stays narrow. The hyphen is part of the name and never a line break. The whole
group has the accessible name “Print-cess by Club Paradiso”; the split colours and the icon are
hidden from assistive technology. In running text the name is plain “Print-cess”, never
recoloured mid-word. Technical identifiers (`print-cess`, `@print-cess/*`) are unchanged.

Assets:

- `packages/ui/src/index.tsx` — the React mark, flat on the page (Royal Indigo body, lilac crown).
- `apps/web/src/app/icon.svg` — the app icon and favicon: the mark reversed out of an indigo tile,
  simplified so it survives 16 px (one central QR module instead of four).
- `docs/assets/print-cess-mark.svg` — the same tile for documentation and repository surfaces.

Keep the three geometrically synchronized. There is deliberately no web app manifest or
home-screen icon: a visit is meant to end with the browser's site data cleared, and an installed
app would work against that.

Do not use the Ministry of Justice, Jeju Immigration Office, another public agency, airline, or
travel-service logo without written permission.

## Layout and motion

- One screen, one clear decision; no more than two primary/secondary actions.
- Generous whitespace, short sentences, visible progress, and paired icon/text labels.
- A help control stays in the phone header on every step. It explains the current screen in the
  chosen language, can be read aloud, and never counts against the two-action limit.
- Kiosk QR and collection direction are the dominant elements at their respective stages.
- Avoid carousels, promotional panels, ornamental mascots, and marketing landing-page patterns.
- Honor `prefers-reduced-motion`. Animation explains state only and must not delay an action.

## Government neutrality

It is acceptable to describe the intended installation location factually in internal deployment
documentation. Public UI must not claim “official government service,” “Ministry service,”
certification, endorsement, or legal authority unless separately approved. Avoid seals, flags,
official-looking crests, government color imitation, and agency domain styling.

## Voice

Use direct, respectful, plain language. Say what happened and provide exactly one safe next action.
Do not blame the visitor, expose implementation detail, or promise more privacy than the system can
technically establish.

Write for a visitor who has never used a kiosk, may read slowly, and is standing in a queue. One
idea per sentence, one action per line, everyday words instead of product vocabulary. Say “the big
screen” rather than “the kiosk”, “locked” rather than “encrypted”, and name the button the visitor
must press using the exact words printed on it.

Preferred:

- “This PDF has a password. Open it on your phone and take a screenshot of the pages you need.”
- “You can print PDF, JPG and PNG only. Save your page as a PDF, or take a clear screenshot.”
- “Printing service is temporarily unavailable. Error code: P-01. Your uploaded file has been
  deleted.”

Avoid:

- “Fatal error,” raw provider responses, stack traces, paths, or retry loops.
- “Ask an employee for help” as the default or only failure action. It may appear as a closing
  line in the help sheet, after the screen has already given a concrete next step.
- Requests that staff log in to KakaoTalk/email, enter a password, or search the visitor's phone.
- “Completely erased everywhere” or “the server can never see anything.”
- Referring to a control by its color, position alone, or an English product term the visitor has
  no reason to know.

When the visitor has no document, explain that the service cannot search, buy, or issue it and give
one action: contact the reservation holder, airline, or travel agency.

## Translation

All copy lives in `packages/i18n` with English fallback, and English is the source of truth: a
locale that is missing a key fails the build. Supported locales are English, Korean, Simplified
Chinese, Bahasa Indonesia, Filipino, Vietnamese, Thai, Nepali, Khmer, Arabic, Russian, Mongolian,
and Ukrainian. No locale may keep its wording in a separate override layer; every language is
edited and reviewed in the same table so a change to one is visible against all the others.

Machine translation is a development placeholder only. Native-speaker review must cover accuracy,
politeness, line-breaking, screen-reader output, error instructions, the plain-
language help sheet, and privacy/security meaning before Production.

The shared kiosk display keeps Korean and English on screen permanently and rotates the single
scan instruction through the remaining eleven languages, so the display stays readable while every
supported visitor still sees their own language.
