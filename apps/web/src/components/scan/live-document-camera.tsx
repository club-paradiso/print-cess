"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Check, ScanLine, X } from "lucide-react";

import type { SupportedLocale } from "@print-cess/i18n";
import { PrimaryButton, SecondaryButton } from "@print-cess/ui";

import {
  FULL_FRAME_QUAD,
  inspectDocumentFrame,
  quadDrift,
  type CaptureIssue,
  type DocumentQuad,
} from "@/lib/document-scan-engine";
import { proScanCopy } from "./scan-pro-copy";

const ANALYSIS_EDGE = 820;
const ANALYSIS_INTERVAL_MS = 360;
const STABLE_DRIFT = 0.018;
const STABLE_FRAMES = 3;
const NEW_PAGE_DRIFT = 0.055;

function captureIssueText(issue: CaptureIssue, copy: ReturnType<typeof proScanCopy>): string {
  switch (issue) {
    case "move-closer":
      return copy.moveCloser;
    case "too-dark":
      return copy.moreLight;
    case "too-bright":
      return copy.tooBright;
    case "glare":
      return copy.reduceGlare;
    case "blurry":
      return copy.blurry;
    case "ready":
      return copy.ready;
    default:
      return copy.holdSteady;
  }
}

export function LiveDocumentCamera({
  locale,
  disabled,
  onCapture,
  onFallback,
  onClose,
}: {
  locale: SupportedLocale;
  disabled?: boolean;
  onCapture: (file: File) => void | Promise<void>;
  onFallback: () => void;
  onClose: () => void;
}) {
  const copy = proScanCopy(locale);
  const videoRef = useRef<HTMLVideoElement>(null);
  const analysisCanvas = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analysisBusy = useRef(false);
  const captureBusy = useRef(false);
  const lastQuad = useRef<DocumentQuad | null>(null);
  const capturedQuad = useRef<DocumentQuad | null>(null);
  const stableFrames = useRef(0);
  const waitingForNewPage = useRef(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState(false);
  const [autoCapture, setAutoCapture] = useState(true);
  const [quad, setQuad] = useState<DocumentQuad>(FULL_FRAME_QUAD);
  const [detected, setDetected] = useState(false);
  const [qualityScore, setQualityScore] = useState(0);
  const [message, setMessage] = useState(copy.cameraStarting);
  const [aspectRatio, setAspectRatio] = useState("3 / 4");

  const stopCamera = useCallback(() => {
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
  }, []);

  const captureFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0 || captureBusy.current) return;
    captureBusy.current = true;
    try {
      const maxEdge = 3200;
      const scale = Math.min(1, maxEdge / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("scanCameraCanvasUnavailable");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (value) => (value ? resolve(value) : reject(new Error("scanCameraCaptureFailed"))),
          "image/jpeg",
          0.96,
        );
      });
      const file = new File([blob], `Print-cess-scan-${Date.now()}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
      capturedQuad.current = lastQuad.current;
      waitingForNewPage.current = true;
      stableFrames.current = 0;
      await onCapture(file);
    } finally {
      window.setTimeout(() => {
        captureBusy.current = false;
      }, 650);
    }
  }, [onCapture]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const inspect = async () => {
      if (cancelled || disabled || analysisBusy.current || captureBusy.current) return;
      const video = videoRef.current;
      if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      analysisBusy.current = true;
      try {
        const scale = Math.min(1, ANALYSIS_EDGE / Math.max(video.videoWidth, video.videoHeight));
        const canvas = analysisCanvas.current ?? document.createElement("canvas");
        analysisCanvas.current = canvas;
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) return;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const inspection = await inspectDocumentFrame(canvas);
        if (cancelled) return;

        setQuad(inspection.detection.quad);
        setDetected(inspection.detection.detected);
        setQualityScore(inspection.quality.score);

        if (waitingForNewPage.current) {
          const previous = capturedQuad.current;
          if (
            !inspection.detection.detected ||
            (previous && quadDrift(previous, inspection.detection.quad) > NEW_PAGE_DRIFT)
          ) {
            waitingForNewPage.current = false;
            capturedQuad.current = null;
          } else {
            setMessage(copy.holdSteady);
            lastQuad.current = inspection.detection.quad;
            return;
          }
        }

        if (!inspection.quality.ready) {
          stableFrames.current = 0;
          setMessage(captureIssueText(inspection.quality.issue, copy));
          lastQuad.current = inspection.detection.quad;
          return;
        }

        const previous = lastQuad.current;
        const stable = previous ? quadDrift(previous, inspection.detection.quad) <= STABLE_DRIFT : false;
        stableFrames.current = stable ? stableFrames.current + 1 : 0;
        lastQuad.current = inspection.detection.quad;

        if (stableFrames.current < STABLE_FRAMES) {
          setMessage(copy.holdSteady);
          return;
        }

        setMessage(copy.ready);
        if (autoCapture) await captureFrame();
      } catch {
        stableFrames.current = 0;
        setMessage(copy.holdSteady);
      } finally {
        analysisBusy.current = false;
      }
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(true);
        setMessage(copy.cameraDenied);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 2560 },
            height: { ideal: 1920 },
          },
        });
        if (cancelled) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        if (cancelled) return;
        setAspectRatio(`${video.videoWidth || 3} / ${video.videoHeight || 4}`);
        setStarted(true);
        setMessage(copy.holdSteady);
        timer = window.setInterval(() => void inspect(), ANALYSIS_INTERVAL_MS);
      } catch {
        setError(true);
        setMessage(copy.cameraDenied);
      }
    };

    void start();
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      stopCamera();
    };
  }, [autoCapture, captureFrame, copy, disabled, stopCamera]);

  const close = () => {
    stopCamera();
    onClose();
  };
  const polygon = quad.map((point) => `${point.x * 1000},${point.y * 1000}`).join(" ");

  return (
    <div className="scan-live-dialog" role="dialog" aria-modal="true" aria-label={copy.liveCamera}>
      <div className="scan-live-panel">
        <div className="scan-live-header">
          <div>
            <strong>{copy.liveCamera}</strong>
            <span>{message}</span>
          </div>
          <button type="button" onClick={close} aria-label={copy.closeCamera}>
            <X aria-hidden="true" />
          </button>
        </div>

        {error ? (
          <div className="scan-camera-error">
            <CameraOff aria-hidden="true" />
            <p>{copy.cameraDenied}</p>
            <PrimaryButton
              onClick={() => {
                stopCamera();
                onClose();
                onFallback();
              }}
            >
              <Camera aria-hidden="true" /> {copy.cameraFallback}
            </PrimaryButton>
          </div>
        ) : (
          <>
            <div className="scan-live-stage" style={{ aspectRatio }}>
              <video ref={videoRef} muted playsInline aria-label={copy.liveCamera} />
              <svg
                className={`scan-live-overlay ${detected ? "is-detected" : ""}`}
                viewBox="0 0 1000 1000"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <polygon points={polygon} />
              </svg>
              {!started ? <div className="scan-live-loading">{copy.cameraStarting}</div> : null}
              <div className={`scan-live-guidance ${message === copy.ready ? "is-ready" : ""}`}>
                {message === copy.ready ? <Check aria-hidden="true" /> : <ScanLine aria-hidden="true" />}
                <span>{message}</span>
              </div>
            </div>

            <div className="scan-quality" aria-label={copy.quality}>
              <span>{copy.quality}</span>
              <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(qualityScore * 100)}>
                <i style={{ width: `${Math.round(qualityScore * 100)}%` }} />
              </div>
            </div>

            <div className="scan-live-controls">
              <SecondaryButton onClick={() => setAutoCapture((value) => !value)} disabled={disabled}>
                {autoCapture ? copy.autoCaptureOn : copy.autoCaptureOff}
              </SecondaryButton>
              <PrimaryButton onClick={() => void captureFrame()} disabled={!started || disabled || captureBusy.current}>
                <Camera aria-hidden="true" /> {copy.manualCapture}
              </PrimaryButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
