/**
 * The only third-party scripts the app loads. The CSP allows these exact
 * package versions rather than the whole CDN host, so any other file on
 * jsDelivr is still refused by browsers that ignore 'strict-dynamic'.
 */
const JSDELIVR = "https://cdn.jsdelivr.net/npm";

export const JSQR_SRC = `${JSDELIVR}/jsqr@1.4.0/dist/jsQR.js`;

export const TESSERACT_VERSION = "7.0.0";
export const TESSERACT_PACKAGE = `${JSDELIVR}/tesseract.js@${TESSERACT_VERSION}/`;
export const TESSERACT_CORE_PACKAGE = `${JSDELIVR}/tesseract.js-core@${TESSERACT_VERSION}/`;

/** CSP source expressions; a trailing slash matches every file under that path. */
export const CDN_SCRIPT_SOURCES = [JSQR_SRC, TESSERACT_PACKAGE, TESSERACT_CORE_PACKAGE];
