"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Camera,
  Images,
  Plus,
  RotateCw,
  ScanLine,
  Trash2,
} from "lucide-react";

import type { SupportedLocale } from "@print-cess/i18n";
import { PrimaryButton, SecondaryButton, StatusIcon } from "@print-cess/ui";

import { buildScannedPdf, type PdfImagePage } from "@/lib/scan-pdf";
import { formatScanCopy, scanCopy } from "./scan-copy";

const MAX_PAGES = 10;
const MAX_IMAGE_EDGE = 1600;
const JPEG_QUALITY = 0.78;

type ScanPage = {
  id: string;
  file: File;
  previewUrl: string;
  rotation: number;
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
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [enhance, setEnhance] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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

  const addFiles = useCallback(
    (selection: FileList | null) => {
      if (!selection?.length) return;
      setError("");
      const remaining = MAX_PAGES - pages.length;
      if (selection.length > remaining) setError(copy.tooMany);
      const added = Array.from(selection)
        .slice(0, remaining)
        .map((file) => {
          const previewUrl = URL.createObjectURL(file);
          previewUrls.current.add(previewUrl);
          return { id: crypto.randomUUID(), file, previewUrl, rotation: 0 };
        });
      setPages((current) => [...current, ...added]);
      if (cameraInput.current) cameraInput.current.value = "";
      if (galleryInput.current) galleryInput.current.value = "";
    },
    [copy.tooMany, pages.length],
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
        URL.revokeObjectURL(removed.previewUrl);
        previewUrls.current.delete(removed.previewUrl);
      }
      return current.filter((page) => page.id !== id);
    });
  }, []);

  const makePdf = useCallback(async () => {
    if (pages.length === 0 || busy) return;
    setBusy(true);
    setError("");
    try {
      const normalized: PdfImagePage[] = [];
      for (const page of pages) {
        normalized.push(await normalizeScanPage(page.file, page.rotation, enhance));
      }
      const bytes = buildScannedPdf(normalized);
      const file = new File([bytes.buffer as ArrayBuffer], copy.scannedFile, {
        type: "application/pdf",
        lastModified: Date.now(),
      });
      await onComplete(file);
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message === "scanImageError"
          ? copy.imageError
          : copy.genericError,
      );
    } finally {
      setBusy(false);
    }
  }, [busy, copy.genericError, copy.imageError, copy.scannedFile, enhance, onComplete, pages]);

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
        onChange={(event) => addFiles(event.target.files)}
      />
      <input
        ref={galleryInput}
        data-testid="scan-gallery-input"
        hidden
        type="file"
        accept="image/*"
        multiple
        onChange={(event) => addFiles(event.target.files)}
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
                {/* These are local object URLs; Next image optimization cannot improve them. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={page.previewUrl}
                  alt={`${index + 1}`}
                  style={{ transform: `rotate(${page.rotation}deg)` }}
                />
                <span className="scan-page-number">{index + 1}</span>
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

      {error ? (
        <p className="scan-error" role="alert">
          {error}
        </p>
      ) : null}
      <label className="scan-enhance">
        <input
          type="checkbox"
          checked={enhance}
          onChange={(event) => setEnhance(event.target.checked)}
          disabled={busy}
        />
        <span>{copy.enhance}</span>
      </label>
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
    </section>
  );
}

async function normalizeScanPage(
  file: File,
  rotation: number,
  enhance: boolean,
): Promise<PdfImagePage> {
  let image: CanvasImageSource;
  let width: number;
  let height: number;
  let release: () => void = () => {};
  try {
    if (typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
        image = bitmap;
        width = bitmap.width;
        height = bitmap.height;
        release = () => bitmap.close();
      } catch {
        const loaded = await loadImage(file);
        image = loaded.image;
        width = loaded.image.naturalWidth;
        height = loaded.image.naturalHeight;
        release = loaded.release;
      }
    } else {
      const loaded = await loadImage(file);
      image = loaded.image;
      width = loaded.image.naturalWidth;
      height = loaded.image.naturalHeight;
      release = loaded.release;
    }
  } catch {
    throw new Error("scanImageError");
  }

  try {
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(width, height));
    const drawnWidth = Math.max(1, Math.round(width * scale));
    const drawnHeight = Math.max(1, Math.round(height * scale));
    const sideways = rotation % 180 !== 0;
    const canvas = document.createElement("canvas");
    canvas.width = sideways ? drawnHeight : drawnWidth;
    canvas.height = sideways ? drawnWidth : drawnHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("scanImageError");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (enhance) context.filter = "grayscale(1) contrast(1.12) brightness(1.04)";
    context.save();
    if (rotation === 90) {
      context.translate(canvas.width, 0);
      context.rotate(Math.PI / 2);
    } else if (rotation === 180) {
      context.translate(canvas.width, canvas.height);
      context.rotate(Math.PI);
    } else if (rotation === 270) {
      context.translate(0, canvas.height);
      context.rotate(-Math.PI / 2);
    }
    context.drawImage(image, 0, 0, drawnWidth, drawnHeight);
    context.restore();
    const blob = await canvasBlob(canvas);
    return {
      bytes: new Uint8Array(await blob.arrayBuffer()),
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    release();
  }
}

async function loadImage(file: File): Promise<{ image: HTMLImageElement; release: () => void }> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
    return { image, release: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("scanImageError"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}
