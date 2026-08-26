# Royal promo — Figma handoff

The production implementation is the source of truth for behavior and accessibility. Figma is the editable visual and token reference; any deliberate divergence should be documented here before either side changes independently.

- Campaign route: `/promo`
- Service CTA route: `/`
- Figma file: `Print-cess by Club Paradiso — Royal Promo`
- Figma URL: <https://www.figma.com/design/tqEGayhvXtIhAC1WQ89fps>
- File key: `tqEGayhvXtIhAC1WQ89fps`

## Pages and top-level nodes

| Page                     | Node                                                          |
| ------------------------ | ------------------------------------------------------------- |
| Cover                    | `5:8`                                                         |
| Foundations              | `2:58`                                                        |
| Components               | Button set `8:21`, artwork set `9:17`, quota gate set `11:60` |
| Desktop                  | `14:2` — 1440 px                                              |
| Tablet                   | `15:2` — 768 px                                               |
| Mobile                   | `16:2` — 390 px                                               |
| Campaign Assets          | `6:44`; artwork nodes `6:48`, `6:51`, `6:50`, `6:49`          |
| Implementation Reference | `17:2`                                                        |

The design file contains editable layout, text, navigation, CTA, quota states, responsive frames, components, and variables. Only the four supplied campaign illustrations remain raster artwork.

## Tokens

- `Royal / Primitives`: 20 variables
- `Royal / Semantic Color`: 17 variables
- `Royal / Dimensions`: 9 variables

CSS code syntax is configured for the documented variables. The campaign CSS is route-scoped in `apps/web/src/app/promo/promo.module.css`; it must not be moved into the global service styles.

## Code mapping

| Figma concept             | Code                                                                    |
| ------------------------- | ----------------------------------------------------------------------- |
| Desktop / Tablet / Mobile | `apps/web/src/app/promo/page.tsx` and `promo.module.css`                |
| Promo primary CTA         | Links to `/`                                                            |
| Campaign artwork          | `apps/web/public/promo/royal/`                                          |
| Quota gate / fake paywall | `apps/web/src/components/mobile/print-quota-dialog.tsx`                 |
| Quota variables           | `packages/protocol/src/print-quota.ts` and native `PrintQuotaPolicy.cs` |

Code Connect was attempted, but the connected Figma account requires a Dev or Full seat on an Organization or Enterprise plan. This seat limitation does not affect editing the file, components, variables, or responsive frames.
