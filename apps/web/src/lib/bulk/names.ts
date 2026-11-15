import { MAX_DROP_FILE_NAME_BYTES } from "@print-cess/protocol";

import { safeFileName, safeMediaType, splitExtension } from "../drop-file-name";

/**
 * Makes every name in a received manifest safe and unique in one linear pass.
 *
 * Safety comes from `safeFileName`, which replaces every path separator, so no
 * name the receiver ever handles can climb out of the folder it is written to.
 * Uniqueness matters because phones name photos alike (`IMG_0001.JPG` from two
 * albums) and a folder write must never silently replace an earlier file. The
 * per-stem counter keeps 3,000 identical names linear rather than quadratic.
 */
export function uniqueSafeNames(rawNames: readonly string[]): string[] {
  const taken = new Set<string>();
  const counters = new Map<string, number>();
  const out: string[] = [];
  for (const raw of rawNames) {
    let name = safeFileName(raw);
    const folded = name.toLowerCase();
    if (taken.has(folded)) {
      const { stem, extension } = splitExtension(name);
      let counter = counters.get(folded) ?? 1;
      let candidate = name;
      do {
        counter += 1;
        candidate = safeFileName(`${stem} (${counter})${extension}`, MAX_DROP_FILE_NAME_BYTES);
      } while (taken.has(candidate.toLowerCase()));
      counters.set(folded, counter);
      name = candidate;
    }
    taken.add(name.toLowerCase());
    out.push(name);
  }
  return out;
}

export { safeMediaType };
