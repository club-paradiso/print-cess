# /promo marketing page

`/promo` is a separate, Korean-first page that introduces Print-cess. It is not part of
the product flow: no product route links to it, and the film and scroll effects stay on
this page only. Copy lives in `apps/web/src/app/promo/promo-copy.ts`; every product claim
there comes from the phone strings in `packages/i18n`, `PRIVACY.md`, `PRINT_QUOTA.md`,
`FILE_TRANSFER.md` and the scanner README. Change both together.

The page is `noindex` like the rest of the site and says it is a development and demo
build. It must not imply an installation, certification or official operation.

## Patterns taken from the TAPSO site

Read from the live TAPSO marketing site's source (`apps/web/src` in the TAPSO repository), adapted
to Print-cess and its rules: a hero film with a scene picker, progress and a screen-preview scene
(`hero-film.tsx`); a motion switch that quiets every animation; the print flow as a story where
scrolling only tells a sticky screen and a step dock which step is being read, and nothing is
pinned or hijacked (`journey.tsx`); a status timeline with state pills; privacy rows that show what
is and is not collected; a FAQ of native disclosure widgets; a support modal that lists only
configured destinations (`support-action.tsx`). Not taken: the waitlist form (Print-cess collects no
contact details), a dark theme (the product is light-only, see `BRAND.md`) and native checkout.

## Typeface

`/promo` self-hosts Pretendard Variable v1.3.9 (SIL OFL 1.1, licence in
`public/promo/fonts/LICENSE.txt`) as the upstream dynamic subset: 92 `woff2` files split by
`unicode-range`, so a visitor downloads only the slices the page uses. `pretendard.css` is
imported by the promo page alone, `font-display: swap` keeps the first paint in the system face,
and nothing is fetched from a third-party host (the CSP keeps `font-src 'self'`). Product
screens keep the system font stack that `BRAND.md` asks for.

## Hero films

Two 10-second clips (a university library and an airport counter), generated with Gemini
and supplied by the project owner. They are demonstration footage, not real places.

| File                                        | Use                                        |
| ------------------------------------------- | ------------------------------------------ |
| `public/promo/{university,airport}-720.mp4` | Landscape and wide screens                 |
| `public/promo/*-portrait.mp4`               | Screens taller than 4:5                    |
| `public/promo/*-poster{,-portrait}.webp`    | Still shown before and instead of the film |

Encoding: H.264, 24 fps, no audio, `+faststart`. The portrait cut is a 9:16 crop that
follows the subject (the crop offset changes at each scene cut). The airport clip showed a
printer manufacturer's logo from 5.96 s; it is removed with ffmpeg's `delogo` filter over
that shot (`delogo=x=276:y=388:w=60:h=64:enable='gte(t,5.9)'` on the 1280x720 frame) before
the portrait crop. The posters come from the first shot of each clip, which has no logo.

The film is muted and inline, loads after hydration, plays only while visible, and can be
paused. Reduced motion, data saver and 2G keep the still until the visitor presses play. A
failed load keeps the still.

## Support section

`/promo#support` can point a visitor to a support destination, but Print-cess never takes a
payment itself: no card form, no amount field, no name. The destination comes from the server
environment and is public by design (see `.env.example`):

- `PRINT_CESS_SUPPORT_URL`: an `https` link (GitHub Sponsors, Buy Me a Coffee, ...). Links with
  credentials, other schemes or a host without a dot are ignored. The button shows the host so
  the visitor sees where it goes.
- `PRINT_CESS_SUPPORT_BANK_NAME`, `..._ACCOUNT`, `..._HOLDER`: optional bank transfer; all three
  must be set and the account holds only digits and hyphens.

With none set, the section says the window is not open yet and offers free ways to help. Support
never changes a feature or a quota. Before enabling it, the owner should confirm that soliciting
and receiving support is permitted for Club Paradiso (for example under Korean law on soliciting
donations) and that the notice about receipts and tax deduction in `promo-copy.ts` is true.
