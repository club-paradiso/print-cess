# Cross-platform HWP/HWPX printing (local WASM)

Print-cess accepts HWP 5.x and HWPX **on mobile browser print sessions regardless
of the target kiosk type**. When the target kiosk does not advertise a licensed
native Hancom renderer, the sending browser converts the source document to PDF
**locally, before encryption**. The kiosk receives an ordinary encrypted PDF
envelope and prints using the pre-existing PDF validation and printer policy.

This works in a browser-kiosk flow on Windows/macOS/Linux and in the native
Windows kiosk flow without sending plaintext to the application server. In a
supported Windows kiosk with an approved Hancom installation, the original
HWP/HWPX is still sent to the native renderer.

## Pipeline

1. User picks `.hwp` or `.hwpx` on the phone.
2. The mobile code checks file size and format markers, rejecting protected/
   scripted legacy HWP before invoking the renderer.
3. For browser kiosks the phone sends a **copy** of the bytes to a same-origin
   Web Worker. That worker loads the locally hosted, pinned `rhwptopdf` WebAssembly
   library, registers **bundled OFL-licensed Korean TTF fonts**, and converts the
   document into a multipage PDF. It cannot communicate document bytes to
   a third-party conversion service.
4. The phone validates the generated PDF again, including normal security and
   file-size limits, and encrypts it through the existing print protocol.
5. The kiosk validates and prints the PDF; the worker terminates and temporary
   source buffers are cleared best-effort.

Nothing in this path requires installing Hancom Office on a phone or browser kiosk.

## Deterministic build

`apps/web/scripts/fetch-hancom-renderer.mjs` is called by `prebuild` and
`predev` through `copy-pdf-worker.mjs`. It downloads **pinned** public release
artifacts and Google Fonts files at **build time** only:

- `sanguneo/rhwptopdf` **v0.2.2** UMD JavaScript + WebAssembly, SHA-256
  checked against GitHub's release digests.
- `google/fonts` at commit
  `bbda7253fc363238b05d97515ca71f8ae49c4fa9`:
  Nanum Gothic Regular and Nanum Myeongjo Regular plus each font's OFL license.
  Source bytes are verified against their known Git blob hashes.

The files are deployed under `/hancom-rhwp/` and loaded from **the Print-cess
origin only** when a local conversion is needed. No runtime CDN dependency.
Builds refuse changed checksums rather than silently using a different renderer.

- Renderer: https://github.com/sanguneo/rhwptopdf
- Renderer MIT license: `apps/web/public/hancom-rhwp/LICENSE-MIT.txt`
- Upstream Apache-2.0 notices: `apps/web/public/hancom-rhwp/NOTICE-rhwptopdf.txt`
- Font licenses: `/hancom-rhwp/OFL-NanumGothic.txt` and
  `/hancom-rhwp/OFL-NanumMyeongjo.txt`

## Testing and limitations

Automated tests cover the format-selection fallback, worker contract,
malformed-file rejection, build-time download integrity, and kiosk protocol.
Verify each release with **synthetic** HWP/HWPX documents in at least desktop
Chromium, Firefox, mobile Safari, and Android Chrome, against the institution's
real printer before production use.

**Not universal or guaranteed:** password/DRM/distribution documents, macro-
bearing HWP, damaged files, unsupported legacy format features, missing WASM or
Web Worker support, missing print permissions, insufficient memory, and
unavailable printers can still fail. Some HWP layouts and fonts may differ from
Hancom Office. The UI must report conversion errors instead of falsely claiming
successful printing. Native kiosk deployment and institutional approvals
remain separate requirements (see `docs/PRODUCTION_BLOCKERS.md`).
