"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Printer, QrCode, X } from "lucide-react";

import { Beacon } from "@print-cess/ui";

import { startCodeScanner, supportsCodeScanning, type CodeScanner } from "@/lib/drop-scanner";
import { parsePrintSessionQr } from "@/lib/print-qr";

export type PrintEntryLabels = {
  scanCta: string;
  lostCta: string;
  lostTitle: string;
  lostSteps: readonly [string, string, string];
  lostHint: string;
  beaconCaption: string;
  close: string;
  scanTitle: string;
  scanHint: string;
  scanStarting: string;
  scanDenied: string;
  scanUnsupported: string;
  scanInvalid: string;
};

type Panel = "lost" | "scan" | null;
type ScanState = "starting" | "scanning" | "denied" | "unsupported";

/** How long a rejected QR code keeps its message on screen after it leaves view. */
const INVALID_NOTICE_MS = 4000;

/**
 * The two actions for somebody who reached the home page without scanning the
 * Print-cess screen: scan its QR code from here, or be shown how to find it.
 * Both open as a sheet, so the page behind keeps its place and nothing is
 * navigated until a valid Print-cess code has been read.
 *
 * The phone's own camera app stays the primary route and keeps working with no
 * page involved; this is the recovery path, and where the browser cannot scan
 * it says so and points back to that app instead of pretending.
 */
export function PrintEntryActions({ labels }: { labels: PrintEntryLabels }) {
  const [panel, setPanel] = useState<Panel>(null);
  const [scanState, setScanState] = useState<ScanState>("starting");
  const [invalid, setInvalid] = useState(false);
  const lostDialog = useRef<HTMLDialogElement>(null);
  const scanDialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const scanner = useRef<CodeScanner<string> | null>(null);
  const invalidTimer = useRef(0);

  const open = useCallback((next: Exclude<Panel, null>) => {
    const dialog = next === "lost" ? lostDialog.current : scanDialog.current;
    const other = next === "lost" ? scanDialog.current : lostDialog.current;
    if (other?.open) other.close();
    if (dialog && !dialog.open) dialog.showModal();
    // Decided here, in the click, so the sheet opens already saying what it
    // can do and no effect has to correct it afterwards.
    setScanState(next === "scan" && !supportsCodeScanning() ? "unsupported" : "starting");
    setInvalid(false);
    setPanel(next);
  }, []);

  const close = useCallback(() => {
    lostDialog.current?.close();
    scanDialog.current?.close();
    setPanel(null);
  }, []);

  // The dialog also closes itself on Escape and on the platform back gesture;
  // keep the state, and with it the camera, in step.
  const onDialogClosed = useCallback((which: Exclude<Panel, null>) => {
    setPanel((current) => (current === which ? null : current));
  }, []);

  useEffect(() => {
    if (panel !== "scan") return;
    const element = video.current;
    if (!element) return;
    if (!supportsCodeScanning()) return;
    let cancelled = false;
    void startCodeScanner(element, (raw) => {
      const path = parsePrintSessionQr(raw, window.location.origin);
      if (path === null) {
        setInvalid(true);
        window.clearTimeout(invalidTimer.current);
        invalidTimer.current = window.setTimeout(() => setInvalid(false), INVALID_NOTICE_MS);
      }
      return path;
    }).then(
      (active) => {
        if (cancelled) {
          active.stop();
          return;
        }
        scanner.current = active;
        setScanState("scanning");
        void active.codes.then((path) => {
          // Only the validated path ever reaches here, never the scanned text.
          if (path !== null && !cancelled) window.location.assign(path);
        });
      },
      () => {
        if (!cancelled) setScanState("denied");
      },
    );
    return () => {
      cancelled = true;
      window.clearTimeout(invalidTimer.current);
      scanner.current?.stop();
      scanner.current = null;
    };
  }, [panel]);

  const notice =
    scanState === "denied"
      ? labels.scanDenied
      : scanState === "unsupported"
        ? labels.scanUnsupported
        : invalid
          ? labels.scanInvalid
          : scanState === "starting"
            ? labels.scanStarting
            : labels.scanHint;
  const showVideo = scanState === "starting" || scanState === "scanning";

  return (
    <>
      <div className="print-entry__actions">
        <button
          type="button"
          className="pc-button pc-button--primary print-entry__scan"
          onClick={() => open("scan")}
        >
          <QrCode aria-hidden="true" />
          {labels.scanCta}
        </button>
        <button
          type="button"
          className="pc-button pc-button--secondary print-entry__lost"
          onClick={() => open("lost")}
        >
          {labels.lostCta}
        </button>
      </div>

      <dialog
        ref={lostDialog}
        className="print-sheet"
        aria-labelledby="print-lost-title"
        onClose={() => onDialogClosed("lost")}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className="print-sheet__body">
          <header className="print-sheet__header">
            <h2 id="print-lost-title">{labels.lostTitle}</h2>
            <button
              type="button"
              className="print-sheet__close"
              aria-label={labels.close}
              onClick={close}
            >
              <X aria-hidden="true" />
            </button>
          </header>
          <ol className="print-find">
            <li>
              <span className="print-find__icon" aria-hidden="true">
                <Printer />
              </span>
              <span>{labels.lostSteps[0]}</span>
            </li>
            <li>
              <span className="print-find__icon print-find__icon--beacon" aria-hidden="true">
                <Beacon size="sm" />
              </span>
              <span>
                {labels.lostSteps[1]}
                <small>{labels.beaconCaption}</small>
              </span>
            </li>
            <li>
              <span className="print-find__icon" aria-hidden="true">
                <QrCode />
              </span>
              <span>{labels.lostSteps[2]}</span>
            </li>
          </ol>
          <button
            type="button"
            className="pc-button pc-button--primary print-sheet__cta"
            onClick={() => open("scan")}
          >
            <QrCode aria-hidden="true" />
            {labels.scanCta}
          </button>
          <p className="print-sheet__hint">{labels.lostHint}</p>
        </div>
      </dialog>

      <dialog
        ref={scanDialog}
        className="print-sheet print-sheet--scan"
        aria-labelledby="print-scan-title"
        onClose={() => onDialogClosed("scan")}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className="print-sheet__body">
          <header className="print-sheet__header">
            <h2 id="print-scan-title">{labels.scanTitle}</h2>
            <button
              type="button"
              className="print-sheet__close"
              aria-label={labels.close}
              onClick={close}
            >
              <X aria-hidden="true" />
            </button>
          </header>
          {/* The camera is only a way to read the code; the sentence below says
              the same thing in words and is announced when it changes. */}
          <div className="print-viewfinder" hidden={!showVideo}>
            <video ref={video} playsInline muted aria-hidden="true" />
            <span className="print-viewfinder__frame" aria-hidden="true" />
          </div>
          <p
            className={invalid ? "print-sheet__notice is-invalid" : "print-sheet__notice"}
            role="status"
          >
            {notice}
          </p>
          {scanState === "denied" || scanState === "unsupported" ? (
            <button
              type="button"
              className="pc-button pc-button--secondary print-sheet__cta"
              onClick={() => open("lost")}
            >
              {labels.lostCta}
            </button>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
