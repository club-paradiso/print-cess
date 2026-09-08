"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Languages, Printer, RotateCcw, Send, ShieldCheck } from "lucide-react";

import { LOCALE_NAMES, SUPPORTED_LOCALES, type SupportedLocale } from "@print-cess/i18n";
import { PrimaryButton, ScreenShell, SecondaryButton, StatusIcon, Wordmark } from "@print-cess/ui";

import { useVisitorLocale } from "@/lib/use-visitor-locale";
import { ScanComposer } from "./scan-composer";
import { scanCopy } from "./scan-copy";

export function ScannerFlow({ initialLocale }: { initialLocale?: SupportedLocale }) {
  const [locale, setLocale] = useVisitorLocale(initialLocale);
  const copy = scanCopy(locale);
  const [file, setFile] = useState<File>();
  const [previewUrl, setPreviewUrl] = useState("");
  const [notice, setNotice] = useState("");
  const printFrame = useRef<HTMLIFrameElement>(null);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const acceptPdf = useCallback((next: File) => {
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
    setNotice("");
  }, []);

  const restart = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setFile(undefined);
    setNotice("");
  }, [previewUrl]);

  const download = useCallback(() => {
    if (!file || !previewUrl) return;
    const link = document.createElement("a");
    link.href = previewUrl;
    link.download = file.name;
    link.click();
    setNotice(copy.downloaded);
  }, [copy.downloaded, file, previewUrl]);

  const share = useCallback(async () => {
    if (!file) return;
    try {
      if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: file.name });
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
    download();
    setNotice(copy.shareFallback);
  }, [copy.shareFallback, download, file]);

  const print = useCallback(() => {
    if (!previewUrl) return;
    setNotice(copy.printHint);
    const frame = printFrame.current;
    if (!frame) return;
    frame.onload = () => frame.contentWindow?.print();
    frame.src = previewUrl;
  }, [copy.printHint, previewUrl]);

  return (
    <ScreenShell>
      <div className="mobile-topbar scan-topbar">
        <Wordmark compact />
        <label className="drop-language">
          <Languages aria-hidden="true" />
          <span className="drop-visually-hidden">Language</span>
          <select
            value={locale}
            onChange={(event) => setLocale(event.target.value as SupportedLocale)}
          >
            {SUPPORTED_LOCALES.map((candidate) => (
              <option key={candidate} value={candidate}>
                {LOCALE_NAMES[candidate]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!file ? (
        <ScanComposer locale={locale} onComplete={acceptPdf} />
      ) : (
        <section className="scan-result">
          <StatusIcon tone="success">
            <ShieldCheck size={32} aria-hidden="true" />
          </StatusIcon>
          <div className="scan-heading">
            <h1>{copy.done}</h1>
            <p>{copy.private}</p>
          </div>
          <div className="scan-pdf-card">
            <iframe src={previewUrl} title={copy.done} />
            <div>
              <strong>{file.name}</strong>
              <span>{formatBytes(file.size)} · PDF</span>
            </div>
          </div>
          {notice ? (
            <p className="scan-notice" role="status">
              {notice}
            </p>
          ) : null}
          <div className="scan-result-actions">
            <PrimaryButton onClick={() => void share()}>
              <Send aria-hidden="true" /> {copy.share}
            </PrimaryButton>
            <SecondaryButton onClick={print}>
              <Printer aria-hidden="true" /> {copy.print}
            </SecondaryButton>
            <SecondaryButton onClick={download}>
              <Download aria-hidden="true" /> {copy.download}
            </SecondaryButton>
            <button type="button" className="scan-again" onClick={restart}>
              <RotateCcw aria-hidden="true" /> {copy.scanAgain}
            </button>
          </div>
          <iframe ref={printFrame} className="scan-print-frame" title={copy.print} />
        </section>
      )}
    </ScreenShell>
  );
}

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
