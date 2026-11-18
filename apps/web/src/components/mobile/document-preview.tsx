"use client";

import { useCallback, useMemo } from "react";
import { FileText } from "lucide-react";

import type { ValidatedMobileFile } from "@/lib/file-validation";
import { PdfPreview } from "./pdf-preview";

export function DocumentPreview({
  file,
  validated,
  labels,
}: {
  file: File;
  validated: ValidatedMobileFile;
  labels: {
    documentPreview: string;
    selectedDocumentPreview: string;
    pdfPreview: string;
    firstPagePreview: string;
    hwpxPreview: string;
  };
}) {
  const previewBlob = useMemo(() => {
    if (
      validated.fileKind === "pdf" ||
      validated.fileKind === "hwp" ||
      validated.fileKind === "hwpx"
    )
      return undefined;
    // Never reopen the original provider-backed iCloud File for preview.
    // The preview must display the exact validated bytes that will be sent.
    // Blob copies the buffer on construction; avoid another large slice on iOS.
    return new Blob([validated.bytes as Uint8Array<ArrayBuffer>], {
      type: validated.fileKind === "png" ? "image/png" : "image/jpeg",
    });
  }, [validated.bytes, validated.fileKind]);

  const attachPreview = useCallback(
    (image: HTMLImageElement | null) => {
      if (!image || !previewBlob) return;
      const url = URL.createObjectURL(previewBlob);
      image.src = url;
      return () => {
        image.removeAttribute("src");
        URL.revokeObjectURL(url);
      };
    },
    [previewBlob],
  );

  return (
    <div className="mobile-preview" aria-label={labels.documentPreview}>
      {validated.fileKind === "pdf" ? (
        <PdfPreview
          bytes={validated.bytes}
          pdfPreview={labels.pdfPreview}
          firstPagePreview={labels.firstPagePreview}
        />
      ) : validated.fileKind === "hwp" || validated.fileKind === "hwpx" ? (
        <div className="mobile-preview__document" role="img" aria-label={labels.hwpxPreview}>
          <FileText aria-hidden="true" />
          <strong>{file.name}</strong>
          <span>{labels.hwpxPreview}</span>
        </div>
      ) : previewBlob ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img ref={attachPreview} alt={labels.selectedDocumentPreview} />
      ) : null}
    </div>
  );
}
