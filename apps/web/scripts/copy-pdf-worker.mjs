import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const source = join(root, "..", "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const destination = join(root, "..", "public", "pdf.worker.min.mjs");
await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);

// Build-time only: serve the pinned converter and OFL Korean fonts from the
// Print-cess origin. No browser needs to contact GitHub or a conversion API.
await import("./fetch-hancom-renderer.mjs");
