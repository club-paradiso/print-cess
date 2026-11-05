// Fetch the exact, audited browser-only Hancom PDF renderer and OFL fonts
// during build, never from a third-party origin at document conversion time.
// SHA-256 protects release artifacts; Git blob SHA-1 pins Google Fonts bytes.
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "hancom-rhwp");
const googleFontsCommit = "bbda7253fc363238b05d97515ca71f8ae49c4fa9";
const files = [
  {
    name: "rhwptopdf.umd.js",
    url: "https://github.com/sanguneo/rhwptopdf/releases/download/v0.2.2/rhwptopdf.umd.js",
    algorithm: "sha256",
    digest: "7913400eae742e9f15f320fc377d5961a63216840f290a4c280fbe731ec3c0cd",
  },
  {
    name: "rhwptopdf.umd_bg.wasm",
    url: "https://github.com/sanguneo/rhwptopdf/releases/download/v0.2.2/rhwptopdf.umd_bg.wasm",
    algorithm: "sha256",
    digest: "7a3e1e3e3a8d2a5bea64feac7bd8a2b556687a70874003fcf2aa6677e92f83a7",
  },
  {
    name: "NanumGothic-Regular.ttf",
    url: `https://raw.githubusercontent.com/google/fonts/${googleFontsCommit}/ofl/nanumgothic/NanumGothic-Regular.ttf`,
    algorithm: "git-blob-sha1",
    digest: "2aa2b20905b4136808a0126d8e36e5c0f576715c",
  },
  {
    name: "OFL-NanumGothic.txt",
    url: `https://raw.githubusercontent.com/google/fonts/${googleFontsCommit}/ofl/nanumgothic/OFL.txt`,
    algorithm: "git-blob-sha1",
    digest: "69ff40157d0bba4c65e4ecf77564e1f01d0b02a5",
  },
  {
    name: "OFL-NanumMyeongjo.txt",
    url: `https://raw.githubusercontent.com/google/fonts/${googleFontsCommit}/ofl/nanummyeongjo/OFL.txt`,
    algorithm: "git-blob-sha1",
    digest: "f1277166eb2e0a38c6a487149827c5c3b34d4e2b",
  },
  {
    name: "NanumMyeongjo-Regular.ttf",
    url: `https://raw.githubusercontent.com/google/fonts/${googleFontsCommit}/ofl/nanummyeongjo/NanumMyeongjo-Regular.ttf`,
    algorithm: "git-blob-sha1",
    digest: "8c1bb666acfac3668c6b433b8419cd70d9140045",
  },
];

function digestOf(buffer, algorithm) {
  if (algorithm === "sha256") return createHash("sha256").update(buffer).digest("hex");
  return createHash("sha1")
    .update(`blob ${buffer.length}\0`)
    .update(buffer)
    .digest("hex");
}

async function fetchPinned(file) {
  const path = join(publicDir, file.name);
  try {
    const existing = await readFile(path);
    if (digestOf(existing, file.algorithm) === file.digest) return;
  } catch {
    // A fresh deployment has no downloaded assets.
  }
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(file.url, {
        redirect: "follow",
        signal: AbortSignal.timeout(90_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const content = Buffer.from(await response.arrayBuffer());
      if (digestOf(content, file.algorithm) !== file.digest) {
        throw new Error(`Integrity mismatch: ${file.name}`);
      }
      const temporary = `${path}.${process.pid}.tmp`;
      try {
        await writeFile(temporary, content);
        await rename(temporary, path);
      } finally {
        await rm(temporary, { force: true });
      }
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `Cannot install pinned Hancom renderer asset ${file.name}: ${lastError}`,
  );
}

await mkdir(publicDir, { recursive: true });
await Promise.all(files.map(fetchPinned));
