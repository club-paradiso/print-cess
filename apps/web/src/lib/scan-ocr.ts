import type { SupportedLocale } from "@print-cess/i18n";

import type { PdfOcrWord } from "./scan-pdf";

export type OcrProgress = {
  progress: number;
  status: string;
};

export type OcrResult = {
  text: string;
  words: PdfOcrWord[];
  confidence: number;
  language: string;
};

type TesseractBbox = { x0: number; y0: number; x1: number; y1: number };
type TesseractWord = { text: string; confidence: number; bbox: TesseractBbox };
type TesseractLine = { words: TesseractWord[] };
type TesseractParagraph = { lines: TesseractLine[] };
type TesseractBlock = { paragraphs: TesseractParagraph[] };
type TesseractPage = {
  text: string;
  confidence: number;
  blocks: TesseractBlock[] | null;
};
type TesseractWorker = {
  recognize: (
    image: Blob,
    options?: Record<string, unknown>,
    output?: Record<string, boolean>,
  ) => Promise<{ data: TesseractPage }>;
  terminate: () => Promise<void>;
};
type TesseractGlobal = {
  createWorker: (
    languages: string | string[],
    oem?: number,
    options?: {
      workerPath?: string;
      corePath?: string;
      langPath?: string;
      workerBlobURL?: boolean;
      logger?: (message: { progress?: number; status?: string }) => void;
      errorHandler?: (error: unknown) => void;
    },
  ) => Promise<TesseractWorker>;
};

declare global {
  interface Window {
    Tesseract?: TesseractGlobal;
  }
}

const TESSERACT_VERSION = "7.0.0";
const TESSERACT_SCRIPT = `https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist/tesseract.min.js`;
const TESSERACT_WORKER = `https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist/worker.min.js`;
const TESSERACT_CORE = `https://cdn.jsdelivr.net/npm/tesseract.js-core@${TESSERACT_VERSION}`;
const TESSDATA_FAST = "https://tessdata.projectnaptha.com/4.0.0_fast";

const PRIMARY_OCR_LANGUAGE: Record<SupportedLocale, string> = {
  en: "eng",
  ko: "kor",
  "zh-CN": "chi_sim",
  id: "ind",
  fil: "tgl",
  vi: "vie",
  th: "tha",
  ne: "nep",
  km: "khm",
  ar: "ara",
  ru: "rus",
  mn: "mon",
  uk: "ukr",
};

export function ocrLanguagesForLocale(locale: SupportedLocale): string[] {
  const primary = PRIMARY_OCR_LANGUAGE[locale];
  return primary === "eng" ? ["eng"] : [primary, "eng"];
}

let scriptPromise: Promise<TesseractGlobal> | undefined;
let workerState: { languageKey: string; worker: TesseractWorker } | undefined;
let activeProgress: ((value: OcrProgress) => void) | undefined;

function getTesseractGlobal(): TesseractGlobal | undefined {
  return typeof window === "undefined" ? undefined : window.Tesseract;
}

async function loadTesseract(): Promise<TesseractGlobal> {
  const existing = getTesseractGlobal();
  if (existing) return existing;
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<TesseractGlobal>((resolve, reject) => {
    const alreadyLoading = document.querySelector<HTMLScriptElement>("script[data-print-cess-ocr]");
    const script = alreadyLoading ?? document.createElement("script");

    const finish = () => {
      const runtime = getTesseractGlobal();
      if (runtime) resolve(runtime);
      else reject(new Error("ocrRuntimeUnavailable"));
    };
    const fail = () => reject(new Error("ocrRuntimeLoadFailed"));

    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", fail, { once: true });
    if (!alreadyLoading) {
      script.dataset.printCessOcr = "true";
      script.src = TESSERACT_SCRIPT;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.referrerPolicy = "no-referrer";
      document.head.append(script);
    }
  }).catch((error) => {
    scriptPromise = undefined;
    throw error;
  });

  return scriptPromise;
}

async function getWorker(languages: string[]): Promise<TesseractWorker> {
  const languageKey = languages.join("+");
  if (workerState?.languageKey === languageKey) return workerState.worker;
  if (workerState) {
    await workerState.worker.terminate().catch(() => undefined);
    workerState = undefined;
  }

  const tesseract = await loadTesseract();
  const worker = await tesseract.createWorker(languages, 1, {
    workerPath: TESSERACT_WORKER,
    corePath: TESSERACT_CORE,
    langPath: TESSDATA_FAST,
    workerBlobURL: true,
    logger: (message) => {
      activeProgress?.({
        progress: Math.min(1, Math.max(0, message.progress ?? 0)),
        status: message.status ?? "recognizing text",
      });
    },
  });
  workerState = { languageKey, worker };
  return worker;
}

function extractWords(blocks: TesseractBlock[] | null): PdfOcrWord[] {
  if (!blocks) return [];
  const words: PdfOcrWord[] = [];
  for (const block of blocks) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        for (const word of line.words) {
          const value = word.text.trim();
          if (!value) continue;
          words.push({
            text: value,
            confidence: word.confidence,
            bbox: { ...word.bbox },
          });
        }
      }
    }
  }
  return words;
}

export async function recognizeDocument(
  image: Blob,
  locale: SupportedLocale,
  dimensions: { width: number; height: number },
  onProgress?: (value: OcrProgress) => void,
): Promise<OcrResult> {
  const languages = ocrLanguagesForLocale(locale);
  activeProgress = onProgress;
  try {
    const worker = await getWorker(languages);
    const { data } = await worker.recognize(image, { rotateAuto: false }, { text: true, blocks: true });
    let words = extractWords(data.blocks);
    if (words.length === 0 && data.text.trim()) {
      words = [
        {
          text: data.text.replace(/\s+/gu, " ").trim(),
          confidence: data.confidence,
          bbox: {
            x0: 0,
            y0: 0,
            x1: dimensions.width,
            y1: Math.max(24, Math.round(dimensions.height * 0.08)),
          },
        },
      ];
    }
    return {
      text: data.text,
      words,
      confidence: data.confidence,
      language: languages.join("+"),
    };
  } finally {
    activeProgress = undefined;
  }
}

export async function terminateOcrWorker(): Promise<void> {
  if (!workerState) return;
  const { worker } = workerState;
  workerState = undefined;
  await worker.terminate().catch(() => undefined);
}
