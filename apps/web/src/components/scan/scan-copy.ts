import type { SupportedLocale } from "@print-cess/i18n";

const en = {
  title: "Scan a document",
  intro: "Photograph each page. The PDF is made only on this device.",
  camera: "Scan with camera",
  gallery: "Add from photos",
  empty: "Lay the page flat in good light and hold the camera directly above it.",
  pages: "{{count}} of 10 pages",
  addPage: "Add another page",
  enhance: "Make text clearer in black and white",
  rotate: "Rotate",
  moveEarlier: "Move earlier",
  moveLater: "Move later",
  remove: "Remove",
  makePdf: "Make PDF",
  making: "Making your PDF…",
  back: "Back",
  done: "Your scan is ready",
  private: "The photos and PDF stay on this device unless you choose to share them.",
  share: "Send to another device",
  download: "Download PDF",
  print: "Print now",
  scanAgain: "Scan again",
  shareFallback: "File sharing is not available here. The PDF was downloaded instead.",
  downloaded: "PDF download started.",
  printHint: "Choose a printer in your device's print window.",
  tooMany: "You can scan up to 10 pages at once.",
  imageError: "One of those photos could not be opened. Try taking it again.",
  genericError: "The PDF could not be made. Try again.",
  scannedFile: "Print-cess-scan.pdf",
  useForPrint: "Use this PDF",
  closeScanner: "Cancel scanning",
};

const ko: typeof en = {
  title: "문서 스캔",
  intro: "페이지를 한 장씩 촬영하세요. PDF는 이 기기 안에서만 만들어져요.",
  camera: "카메라로 스캔",
  gallery: "사진에서 추가",
  empty: "문서를 밝고 평평한 곳에 놓고 카메라를 바로 위에서 비춰주세요.",
  pages: "{{count}} / 10페이지",
  addPage: "페이지 더 추가",
  enhance: "흑백으로 글자를 더 선명하게",
  rotate: "회전",
  moveEarlier: "앞으로 이동",
  moveLater: "뒤로 이동",
  remove: "삭제",
  makePdf: "PDF 만들기",
  making: "PDF를 만들고 있어요…",
  back: "뒤로",
  done: "스캔한 문서가 준비됐어요",
  private: "공유를 선택하기 전까지 사진과 PDF는 이 기기 안에만 있어요.",
  share: "다른 기기로 전송",
  download: "PDF 다운로드",
  print: "즉시 출력",
  scanAgain: "다시 스캔",
  shareFallback: "이 브라우저에서는 파일 공유를 열 수 없어 PDF를 다운로드했어요.",
  downloaded: "PDF 다운로드를 시작했어요.",
  printHint: "기기의 인쇄 창에서 프린터를 선택하세요.",
  tooMany: "한 번에 최대 10페이지까지 스캔할 수 있어요.",
  imageError: "사진 한 장을 열 수 없어요. 다시 촬영해 주세요.",
  genericError: "PDF를 만들지 못했어요. 다시 시도해 주세요.",
  scannedFile: "Print-cess-스캔.pdf",
  useForPrint: "이 PDF로 인쇄",
  closeScanner: "스캔 취소",
};

export type ScanCopy = typeof en;

export function scanCopy(locale: SupportedLocale): ScanCopy {
  return locale === "ko" ? ko : en;
}

export function formatScanCopy(value: string, values: Record<string, string | number>): string {
  return value.replace(/\{\{(\w+)\}\}/gu, (_, key: string) => String(values[key] ?? ""));
}

export const SCAN_HOME_CTA: Record<SupportedLocale, string> = {
  en: "Scan a document",
  ko: "문서 스캔",
  "zh-CN": "扫描文档",
  id: "Pindai dokumen",
  fil: "Mag-scan ng dokumento",
  vi: "Quét tài liệu",
  th: "สแกนเอกสาร",
  ne: "कागजात स्क्यान गर्नुहोस्",
  km: "ស្កេនឯកសារ",
  ar: "مسح مستند",
  ru: "Сканировать документ",
  mn: "Баримт скан хийх",
  uk: "Сканувати документ",
};
