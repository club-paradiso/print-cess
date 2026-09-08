"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Camera,
  Crop,
  Images,
  Plus,
  RotateCw,
  ScanLine,
  Trash2,
} from "lucide-react";

import type { SupportedLocale } from "@print-cess/i18n";
import { PrimaryButton, SecondaryButton, StatusIcon } from "@print-cess/ui";

import {
  detectDocument,
  processDocument,
  type DocumentQuad,
  type ScanFilter,
} from "@/lib/document-scan-engine";
import { buildScannedPdf, type PdfImagePage } from "@/lib/scan-pdf";
import { advancedScanCopy } from "./scan-advanced-copy";
import { DocumentCropEditor } from "./document-crop-editor";
import { formatScanCopy, scanCopy } from "./scan-copy";

const MAX_PAGES = 10;

type ScanPage = {
  id: string;
  file: File;
  sourcePreviewUrl: string;
  previewUrl: string;
  rotation: number;
  quad: DocumentQuad;
  filter: ScanFilter;
  detected: boolean;
  confidence: number;
};

export function ScanComposer({
  locale,
  onComplete,
  onCancel,
}: {
  locale: SupportedLocale;
  onComplete: (file: File) => void | Promise<void>;
  onCancel?: () => void;
}) {
  const copy = scanCopy(locale);
  const advanced = advancedScanCopy(locale);
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const previewUrls = useRef(new Set<string>());

  useEffect(
    () => () => {
      for (const url of previewUrls.current) URL.revokeObjectURL(url);
      previewUrls.current.clear();
    },
    [],
  );

  const editingPage = useMemo(
    () => pages.find((page) => page.id === editingId),
    [editingId, pages],
  );

  const addFiles = useCallback(
    async (selection: FileList | null) => {
      if (!selection?.length || busy) return;
      setError("");
      const remaining = MAX_PAGES - pages.length;
      if (selection.length > remaining) setError(copy.tooMany);
      const selected = Array.from(selection).slice(0, remaining);
      if (selected.length === 0) return;

      setBusy(true);
      setStatus(advanced.detecting);
      const added: ScanPage[] = [];
      try {
        for (const file of selected) {
          const sourcePreviewUrl = URL.createObjectURL(file);
          previewUrls.current.add(sourcePreviewUrl);
          const detection = await detectDocument(file);
          setStatus(advanced.processing);
          const processed = await processDocument(file, {
            quad: detection.quad,
            filter: "auto",
            preview: true,
          });
          const previewUrl = URL.createObjectURL(processed.blob);
          previewUrls.current.add(previewUrl);
          added.push({
            id: crypto.randomUUID(),
            file,
            sourcePreviewUrl,
            previewUrl,
            rotation: 0,
            quad: detection.quad,
            filter: "auto",
            detected: detection.detected,
            confidence: detection.confidence,
          });
          setStatus(advanced.detecting);
        }
        setPages((current) => [...current, ...added]);
      } catch {
        for (const page of added) {
          URL.revokeObjectURL(page.sourcePreviewUrl);
          URL.revokeObjectURL(page.previewUrl);
          previewUrls.current.delete(page.sourcePreviewUrl);
          previewUrls.current.delete(page.previewUrl);
        }
        setError(copy.imageError);
      } finally {
        setBusy(false);
        setStatus("");
        if (cameraInput.current) cameraInput.current.value = "";
        if (galleryInput.current) galleryInput.current.value = "";
      }
    },
    [advanced.detecting, advanced.processing, busy, copy.imageError, copy.tooMany, pages.length],
  );

  const updatePage = useCallback((id: string, update: (page: ScanPage) => ScanPage) => {
    setPages((current) => current.map((page) => (page.id === id ? update(page) : page)));
  }, []);

  const movePage = useCallback((index: number, direction: -1 | 1) => {
    setPages((current) => {
      const destination = index + direction;
      if (destination < 0 || destination >= current.length) return current;
      const next = [...current];
      [next[index], next[destination]] = [next[destination]!, next[index]!];
      return next;
    });
  }, []);

  const removePage = useCallback((id: string) => {
    setPages((current) => {
      const removed = current.find((page) => page.id === id);
      if (removed) {
        for (const url of [removed.sourcePreviewUrl, removed.previewUrl]) {
          URL.revokeObjectURL(url);
          previewUrls.current.delete(url);
        }
      }
      return current.filter((page) => page.id !== id);
    });
    setEditingId((current) => (current === id ? null : current));
  }, []);

  const applyCrop = useCallback(
    async (id: string, value: { quad: DocumentQuad; filter: ScanFilter }) => {
      const page = pages.find((entry) => entry.id === id);
      if (!page || busy) return;
      setBusy(true);
      setStatus(advanced.processing);
      setError("");
      try {
        const processed = await processDocument(page.file, {
          quad: value.quad,
          filter: value.filter,
          preview: true,
        });
        const nextPreviewUrl = URL.createObjectURL(processed.blob);
        previewUrls.current.add(nextPreviewUrl);
        const previousPreviewUrl = page.previewUrl;
        updatePage(id, (current) => ({
          ...current,
          quad: value.quad,
          filter: value.filter,
          previewUrl: nextPreviewUrl,
          detected: true,
        }));
        URL.revokeObjectURL(previousPreviewUrl);
        previewUrls.current.delete(previousPreviewUrl);
        setEditingId(null);
      } catch {
        setError(copy.imageError);
      } finally {
        setBusy(false);
        setStatus("");
      }
    },
    [advanced.processing, busy, copy.imageError, pages, updatePage],
  );

  const makePdf = useCallback(async () => {
    if (pages.length === 0 || busy) return;
    setBusy(true);
    setStatus(advanced.processing);
    setError("");
    try {
      const normalized: PdfImagePage[] = [];
      for (const page of pages) {
        const processed = await processDocument(page.file, {
          quad: page.quad,
          filter: page.filter,
          rotation: page.rotation,
        });
        normalized.push({
          bytes: new Uint8Array(await processed.blob.arrayBuffer()),
          width: processed.width,
          height: processed.height,
        });
      }
      const bytes = buildScannedPdf(normalized);
      const file = new File([bytes.buffer as ArrayBuffer], copy.scannedFile, {
        type: "application/pdf",
        lastModified: Date.now(),
      });
      await onComplete(file);
    } catch {
      setError(copy.genericError);
    } finally {
      setBusy(false);
      setStatus("");
    }
  }, [advanced.processing, busy, copy.genericError, copy.scannedFile, onComplete, pages]);

  return (
    <section className="scan-composer" aria-busy={busy}>
      {onCancel ? (
        <button type="button" className="scan-back" onClick={onCancel} disabled={busy}>
          <ArrowLeft aria-hidden="true" /> {copy.closeScanner}
        </button>
      ) : null}
      <StatusIcon>
        <ScanLine size={32} aria-hidden="true" />
      </StatusIcon>
      <div className="scan-heading">
        <h1>{copy.title}</h1>
        <p>{copy.intro}</p>
      </div>
      <input
        ref={cameraInput}
        data-testid="scan-camera-input"
        hidden
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) => void addFiles(event.target.files)}
      />
      <input
        ref={galleryInput}
        data-testid="scan-gallery-input"
        hidden
        type="file"
        accept="image/*"
        multiple
        onChange={(event) => void addFiles(event.target.files)}
      />

      {pages.length === 0 ? (
        <div className="scan-empty">
          <Camera aria-hidden="true" />
          <p>{copy.empty}</p>
        </div>
      ) : (
        <>
          <div className="scan-page-count" aria-live="polite">
            {formatScanCopy(copy.pages, { count: pages.length })}
          </div>
          <ol className="scan-pages">
            {pages.map((page, index) => (
              <li key={page.id}>
                <div className="scan-page-preview">
                  {/* These are local object URLs; Next image optimization cannot improve them. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={page.previewUrl}
                    alt={`${index + 1}`}
                    style={{ transform: `rotate(${page.rotation}deg)` }}
                  />
                  <span className="scan-page-number">{index + 1}</span>
                  <span
                    className={`scan-detection-badge ${page.detected ? "is-detected" : "is-review"}`}
                    title={`${Math.round(page.confidence * 100)}%`}
                  >
                    {page.detected ? advanced.edgeFound : advanced.edgeNotFound}
                  </span>
                </div>
                <div className="scan-page-actions">
                  <button
                    type="button"
                    onClick={() => movePage(index, -1)}
                    disabled={index === 0 || busy}
                    aria-label={copy.moveEarlier}
                  >
                    <ArrowUp aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => movePage(index, 1)}
                    disabled={index === pages.length - 1 || busy}
                    aria-label={copy.moveLater}
                  >
                    <ArrowDown aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(page.id)}
                    disabled={busy}
                    aria-label={advanced.adjustCrop}
                  >
                    <Crop aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updatePage(page.id, (current) => ({
                        ...current,
                        rotation: (current.rotation + 90) % 360,
                      }))
                    }
                    disabled={busy}
                    aria-label={copy.rotate}
                  >
                    <RotateCw aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removePage(page.id)}
                    disabled={busy}
                    aria-label={copy.remove}
                  >
                    <Trash2 aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}

      {status ? (
        <p className="scan-notice" role="status" aria-live="polite">
          {status}
        </p>
      ) : null}
      {error ? (
        <p className="scan-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="scan-primary-actions">
        <PrimaryButton
          onClick={() => cameraInput.current?.click()}
          disabled={busy || pages.length >= MAX_PAGES}
        >
          {pages.length === 0 ? <Camera aria-hidden="true" /> : <Plus aria-hidden="true" />}
          {pages.length === 0 ? copy.camera : copy.addPage}
        </PrimaryButton>
        <SecondaryButton
          onClick={() => galleryInput.current?.click()}
          disabled={busy || pages.length >= MAX_PAGES}
        >
          <Images aria-hidden="true" /> {copy.gallery}
        </SecondaryButton>
      </div>
      {pages.length > 0 ? (
        <PrimaryButton className="scan-make-pdf" onClick={() => void makePdf()} disabled={busy}>
          <ScanLine aria-hidden="true" /> {busy ? copy.making : copy.makePdf}
        </PrimaryButton>
      ) : null}

      {editingPage ? (
        <DocumentCropEditor
          locale={locale}
          file={editingPage.file}
          previewUrl={editingPage.sourcePreviewUrl}
          initialQuad={editingPage.quad}
          initialFilter={editingPage.filter}
          onApply={(value) => void applyCrop(editingPage.id, value)}
          onCancel={() => setEditingId(null)}
        />
      ) : null}
    </section>
  );
}
