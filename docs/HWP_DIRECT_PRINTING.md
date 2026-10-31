# HWP direct printing

Legacy `.hwp` files are accepted only by a native Windows kiosk that has the approved Hancom Office automation component and file-path security module configured. The public browser kiosk does not render or print HWP.

## Processing path

1. The mobile browser checks the legacy HWP compound-file signature and basic HWP 5.x identity.
2. The original HWP is encrypted inside the existing Print-cess envelope.
3. The Windows kiosk decrypts the file in memory and validates the HWP structure again. It parses the OLE Compound File (header, FAT and DIFAT, directory, mini stream), reads the document properties from the root `FileHeader` stream's own bytes, and checks directory entry names for script, macro and distribution storages. The same inspection runs once more immediately before Hancom Office opens the file.
4. Hancom Office opens the application-owned temporary `.hwp` file and renders a temporary PDF. Each render uses a new job folder under the kiosk account's `%TEMP%\PrintCess`, and the kiosk passes Hancom only plain files directly inside that folder; a link, junction or path outside it stops the render.
5. The generated PDF passes the existing page-count and safe-size checks before the fixed A4, one-copy, simplex, grayscale print path.
6. The original HWP bytes, temporary HWP, and temporary PDF are cleared or deleted on completion or failure.

No external document-conversion service receives the plaintext HWP.

## Rejected documents

The kiosk fails closed for:

- malformed OLE Compound File or missing HWP document identity, including truncated files, out-of-range or looping sector chains, looping or shared directory links, duplicate names in one storage, and a `FileHeader` that is not a root-level stream;
- password-encrypted or certificate-encrypted HWP;
- distribution documents;
- DRM-protected documents;
- script-enabled HWP, or a script/macro storage or stream name (`Scripts`, `DefaultJScript`, `JScriptVersion`, `_VBA_PROJECT`, `Macros`, compared without case) anywhere in the directory, linked into the tree or not;
- a `ViewText` storage, which holds the body of a distribution document;
- files larger than 50 MiB;
- Hancom rendering failures or generated PDFs outside the existing print limits;
- a Hancom render that does not finish within the time limit (60 seconds by default).

## Rendering time limit

Hancom Office renders on its own worker thread. When the render runs past `PRINT_CESS_HANCOM_RENDER_TIMEOUT_SECONDS` (whole seconds, 10 to 600; unset, malformed or out-of-range values use 60), the kiosk:

1. stops the `Hwp.exe` process that this render's automation object started, and its child processes. The kiosk identifies that process as the single new `Hwp.exe` in its own Windows session that started after the render began, and keeps its handle open; when that cannot be determined unambiguously, nothing is stopped;
2. gives the render up to 10 seconds to run its own cleanup, then deletes the job folder (anything still held open is removed by the start-up cleanup);
3. fails the job the same way as any document Hancom cannot open: the visitor sees "이 문서를 안전하게 열 수 없습니다" and the session is marked failed.

Cancelling the print job stops the owned Hancom process the same way.

## Deployment requirements

- Institution-approved Hancom Office installation registering `HWPFrame.HwpObject`.
- Hancom file-path security module installed and registered under `HKCU\Software\HNC\HwpAutomation\Modules` for the kiosk account, with the registered value pointing to an existing DLL.
- The registered security module decides which paths Hancom itself may open while it renders. The kiosk's own job-folder rule covers only the paths the kiosk passes to Hancom, so register a module that approves only files under the kiosk account's `%TEMP%\PrintCess` job folders for production use.
- When `PRINT_CESS_HANCOM_SECURITY_MODULE` is unset, the kiosk automatically uses the registered `FilePathCheckerModuleExample` module. Set the variable to another exact registered value name to override the default.
- To deliberately disable HWP/HWPX capability advertisement without uninstalling Hancom, set `PRINT_CESS_HANCOM_SECURITY_MODULE` to a reserved unregistered value such as `disabled`; an explicitly configured but unregistered module fails closed and suppresses the capability.
- Confirmed institutional automation and licensing terms.
- Target-PC acceptance tests using synthetic HWP 5.x files with tables, images, shapes, headers, footers, page breaks, and required fonts.
- Comparison against interactive Hancom Office output on the same machine and printer.

GitHub Actions verifies protocol handling, structural validation, Windows compilation, tests, and packaging. It cannot prove actual Hancom rendering or physical paper output because hosted runners do not contain the institution's licensed Hancom installation, fonts, driver, or printer.
