# /promo marketing page

`/promo` is a separate, Korean-first page that introduces Print-cess. It is not part of
the product flow: no product route links to it, and the film and scroll effects stay on
this page only. Copy lives in `apps/web/src/app/promo/promo-copy.ts`; every product claim
there comes from the phone strings in `packages/i18n`, `PRIVACY.md`, `PRINT_QUOTA.md`,
`FILE_TRANSFER.md` and the scanner README. Change both together.

The page is `noindex` like the rest of the site and says it is a development and demo
build. It must not imply an installation, certification or official operation.

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
