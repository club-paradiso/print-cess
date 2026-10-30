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

`/promo#support` points a visitor to support destinations, after the TAPSO site's support hub,
but Print-cess never takes a payment itself: no card form, no amount field, no name. The
destinations come from the server environment and are public by design (see `.env.example`); the
recipient is never written into source code.

- `PRINT_CESS_SUPPORT_URL`: an `https` support page (Buy Me a Coffee, GitHub Sponsors, ...).
  Links with credentials, other schemes or a host without a dot are ignored. The page shows the
  host so the visitor sees where the button goes.
- `PRINT_CESS_SUPPORT_BANK_NAME`, `PRINT_CESS_SUPPORT_BANK_ACCOUNT`: bank transfer, with a copy
  button. `PRINT_CESS_SUPPORT_BANK_HOLDER` is optional, as on TAPSO; the bank app shows the
  recipient before the visitor confirms.
- `PRINT_CESS_SUPPORT_TOSS_SEND_URL`: a `supertoss://send` link to the same account. It is used
  only when its `bank` and `accountNo` match the two values above and it pre-fills no amount
  (`amount` absent or `0`), the same check TAPSO applies. The page draws its QR on the server for
  visitors on a computer.

The values the TAPSO site uses (Club Paradiso's Buy Me a Coffee page and its 제주은행 account and
Toss link) are what `/promo` is meant to show. Set them in the Vercel project's environment
variables; with none set, the section says the window is not open yet and offers free ways to
help. Support never changes a feature or a quota. Before enabling it in Production, the owner
should confirm that soliciting support is permitted for Club Paradiso.
