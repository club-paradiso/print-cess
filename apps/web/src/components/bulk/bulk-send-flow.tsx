"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Copy,
  Files,
  Image as ImageIcon,
  LockKeyhole,
  Pause,
  Play,
  QrCode,
  X,
} from "lucide-react";
import QRCode from "qrcode";

import type { SupportedLocale } from "@print-cess/i18n";
import {
  BULK_MAX_FILES,
  BULK_MAX_FILE_BYTES,
  BULK_MAX_TOTAL_BYTES,
  type BulkCapabilities,
  type BulkManifestFile,
} from "@print-cess/protocol";
import {
  DestructiveButton,
  PrimaryButton,
  ScanFrame,
  SecondaryButton,
  StatusIcon,
  TertiaryButton,
} from "@print-cess/ui";

import { SendFlow } from "@/components/drop/send-flow";
import { useDropLocale } from "@/components/drop/drop-shell";
import { SourcePicker } from "@/components/shared/source-picker";

import { safeFileName, safeMediaType } from "@/lib/drop-file-name";
import {
  buildBulkLink,
  BulkSendSession,
  type LinkState,
  type SessionFailure,
} from "@/lib/bulk/session";
import { getBulkCapabilities } from "@/lib/bulk/signal-client";
import type { TransferSnapshot } from "@/lib/bulk/types";
import { QR_COLORS } from "@/lib/qr-style";

import { bulkCopy, formatCount } from "./bulk-copy";
import {
  BulkProgress,
  BulkShell,
  LinkIndicator,
  VirtualFileList,
  formatBytes,
  stateLabel,
  useTransferGuards,
} from "./bulk-shared";

type Stage = "pick" | "share" | "done" | "cancelled" | "failed" | "cloud";

export function BulkSendFlow({ initialLocale }: { initialLocale?: SupportedLocale }) {
  // Korean is this flow's default: the server-chosen locale is treated as the
  // visitor's choice, so the browser's language does not silently override it.
  const [locale, setLocale, text] = useDropLocale(initialLocale, initialLocale);
  const copy = bulkCopy(locale);
  const [files, setFiles] = useState<File[]>([]);
  const [chosenStage, setStage] = useState<Stage>("pick");
  const [capabilities, setCapabilities] = useState<BulkCapabilities | null>(null);
  const [linkState, setLinkState] = useState<LinkState>("preparing");
  const [failure, setFailure] = useState<SessionFailure | null>(null);
  const [snapshot, setSnapshot] = useState<TransferSnapshot | null>(null);
  const [qr, setQr] = useState("");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [consent, setConsent] = useState(false);
  const [version, setVersion] = useState(0);
  // The receiver's report and a session failure end the sharing screen; both
  // are derived here rather than copied into state by an effect.
  const stage: Stage =
    chosenStage === "share" && snapshot?.finished
      ? "done"
      : chosenStage === "share" && failure
        ? "failed"
        : chosenStage;
  const session = useRef<BulkSendSession | null>(null);
  // The same session, as state, for rendering (refs are not read during render).
  const [active, setActive] = useState<BulkSendSession | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const keys = useRef(new Set<string>());

  useEffect(() => {
    const controller = new AbortController();
    void getBulkCapabilities(controller.signal)
      .then(setCapabilities)
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => () => void session.current?.stop(), []);

  const totalBytes = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files]);
  const selectionError = useMemo(() => {
    const maxFiles = Math.min(capabilities?.maximumFileCount ?? BULK_MAX_FILES, BULK_MAX_FILES);
    if (files.length > maxFiles) return copy.tooManyFiles(formatCount(maxFiles, locale));
    if (totalBytes > (capabilities?.maximumTotalBytes ?? BULK_MAX_TOTAL_BYTES))
      return copy.tooLarge;
    if (files.some((file) => file.size > BULK_MAX_FILE_BYTES)) return copy.fileTooLarge;
    return null;
  }, [capabilities, copy, files, locale, totalBytes]);

  // Selected files are identified by name, size and modification time, in one
  // linear pass with a Set: comparing every pair would be nine million checks
  // for three thousand photos.
  const addFiles = useCallback((incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;
    const accepted: File[] = [];
    for (const file of Array.from(incoming)) {
      const key = `${file.name}\u0000${file.size}\u0000${file.lastModified}`;
      if (keys.current.has(key)) continue;
      keys.current.add(key);
      accepted.push(file);
    }
    if (accepted.length > 0) setFiles((current) => [...current, ...accepted]);
  }, []);

  const clear = useCallback(() => {
    keys.current.clear();
    setFiles([]);
    if (photoInput.current) photoInput.current.value = "";
    if (fileInput.current) fileInput.current.value = "";
  }, []);

  const manifest = useMemo<BulkManifestFile[]>(
    () =>
      files.map((file) => ({
        name: safeFileName(file.name),
        size: file.size,
        type: safeMediaType(file.type),
      })),
    [files],
  );

  const start = useCallback(async () => {
    if (selectionError || files.length === 0) return;
    setStage("share");
    setLinkState("preparing");
    setFailure(null);
    const created = await BulkSendSession.create({
      files,
      manifest,
      ...devFrameBytes(),
      iceServers: capabilities?.iceServers ?? [],
      onLinkState: setLinkState,
      onFailure: setFailure,
      onRemoteCancel: () => setStage("cancelled"),
      onUpdate: (next) => {
        setSnapshot(next);
        setVersion((value) => value + 1);
      },
    });
    session.current = created;
    setActive(created);
    const url = buildBulkLink(window.location.origin, created.code);
    setLink(url);
    setQr(
      await QRCode.toDataURL(url, {
        errorCorrectionLevel: "M",
        margin: 2,
        scale: 9,
        color: QR_COLORS,
      }),
    );
    setSnapshot(created.engine.snapshot());
    void created.run().catch(() => {
      setFailure("tooManyRetries");
      setLinkState("failed");
    });
  }, [capabilities, files, manifest, selectionError]);

  const transferring =
    stage === "share" &&
    (linkState === "direct" || linkState === "relay" || linkState === "disconnected");
  useTransferGuards(transferring, copy.leaveWarning);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard can be refused; the QR still works.
    }
  }, [link]);

  const cancel = useCallback(async () => {
    if (!window.confirm(copy.cancelConfirm)) return;
    await session.current?.stop();
    session.current = null;
    setStage("cancelled");
  }, [copy]);

  const reset = useCallback(async () => {
    await session.current?.stop();
    session.current = null;
    clear();
    setSnapshot(null);
    setQr("");
    setStage("pick");
  }, [clear]);

  const switchToCloud = useCallback(async () => {
    await session.current?.stop();
    session.current = null;
    setConsent(false);
    setStage("cloud");
  }, []);

  if (stage === "cloud") {
    // The v1 encrypted hand-off, with the same files, after explicit consent.
    return (
      <div className="bulk-cloud">
        <LinkIndicator state="direct" copy={copy} cloud />
        <SendFlow
          initialLocale={locale}
          carriedLocale={locale}
          initialFiles={files}
          back={{ label: copy.close, onBack: () => void reset() }}
        />
      </div>
    );
  }

  const engine = active?.engine;
  const fallback = capabilities?.cloudFallback;
  const fitsCloud =
    fallback?.available === true &&
    files.length <= fallback.maximumFileCount &&
    totalBytes <= fallback.maximumTotalBytes;
  const connected = linkState === "direct" || linkState === "relay";

  return (
    <BulkShell locale={locale} onLocaleChange={setLocale} text={text} copy={copy}>
      {stage === "pick" ? (
        <section className="mobile-step bulk-pick">
          <h1>{copy.sendTitle}</h1>
          <p>{copy.sendIntro}</p>
          <input
            ref={photoInput}
            data-testid="bulk-photo-input"
            hidden
            multiple
            type="file"
            accept="image/*,video/*"
            onChange={(event) => addFiles(event.target.files)}
          />
          <input
            ref={fileInput}
            data-testid="bulk-file-input"
            hidden
            multiple
            type="file"
            onChange={(event) => addFiles(event.target.files)}
          />
          {files.length === 0 ? (
            <SourcePicker
              sources={[
                {
                  id: "photos",
                  icon: <ImageIcon />,
                  label: copy.pickPhotos,
                  hint: copy.pickPhotosHint,
                  onPick: () => photoInput.current?.click(),
                },
                {
                  id: "files",
                  icon: <Files />,
                  label: copy.pickFiles,
                  hint: copy.pickFilesHint,
                  onPick: () => fileInput.current?.click(),
                },
              ]}
            />
          ) : (
            <div className="drop-selection">
              <p className="drop-selection__summary" data-testid="bulk-selection-summary">
                {copy.summary(formatCount(files.length, locale), formatBytes(totalBytes))}
              </p>
              {selectionError ? (
                <p className="mobile-file-error" role="alert">
                  {selectionError}
                </p>
              ) : null}
              <VirtualFileList
                text={text}
                count={manifest.length}
                version={files.length}
                label={copy.summary(formatCount(files.length, locale), formatBytes(totalBytes))}
                row={(index) => manifest[index] ?? { name: "", size: 0, type: "" }}
              />
              <div className="drop-selection__actions">
                <SecondaryButton onClick={() => photoInput.current?.click()}>
                  <ImageIcon aria-hidden="true" /> {copy.addMore}
                </SecondaryButton>
                <SecondaryButton onClick={clear}>
                  <X aria-hidden="true" /> {copy.clear}
                </SecondaryButton>
              </div>
            </div>
          )}
          {files.length > 0 && !selectionError ? (
            <div className="mobile-actions">
              <PrimaryButton onClick={() => void start()} data-testid="bulk-start">
                <QrCode aria-hidden="true" /> {copy.start}
              </PrimaryButton>
            </div>
          ) : null}
          <p className="drop-privacy">
            <LockKeyhole aria-hidden="true" /> {copy.privacy}
          </p>
        </section>
      ) : null}

      {stage === "share" ? (
        <section
          className="mobile-step bulk-share"
          data-transfer-code={process.env.NODE_ENV === "production" ? undefined : active?.code}
        >
          <LinkIndicator state={linkState} copy={copy} />
          {!connected && linkState !== "disconnected" ? (
            <>
              <h1>{copy.scanTitle}</h1>
              <p>{copy.scanHint}</p>
              {qr ? (
                <figure className="drop-qr">
                  <div className="drop-qr__code">
                    <ScanFrame />
                    {/* eslint-disable-next-line @next/next/no-img-element -- a data URL generated in the browser */}
                    <img src={qr} alt={copy.scanTitle} />
                  </div>
                </figure>
              ) : (
                <p>{copy.preparing}</p>
              )}
              <SecondaryButton onClick={() => void copyLink()} disabled={!link}>
                {copied ? <CheckCircle2 aria-hidden="true" /> : <Copy aria-hidden="true" />}{" "}
                {copied ? copy.copied : copy.copyLink}
              </SecondaryButton>
              <details className="drop-more-ways bulk-fallback">
                <summary>{copy.fallbackTitle}</summary>
                <p>{copy.fallbackBody}</p>
                {fitsCloud ? (
                  consent ? (
                    <div
                      className="bulk-consent"
                      role="alertdialog"
                      aria-labelledby="bulk-consent-title"
                    >
                      <h2 id="bulk-consent-title">{copy.fallbackConsentTitle}</h2>
                      <p>{copy.fallbackConsentBody("30")}</p>
                      <PrimaryButton onClick={() => void switchToCloud()}>
                        {copy.fallbackConfirm}
                      </PrimaryButton>
                      <TertiaryButton onClick={() => setConsent(false)}>
                        {copy.fallbackKeep}
                      </TertiaryButton>
                    </div>
                  ) : (
                    <SecondaryButton onClick={() => setConsent(true)}>
                      {copy.fallbackCloud}
                    </SecondaryButton>
                  )
                ) : fallback?.available ? (
                  <p>
                    {copy.fallbackTooBig(
                      formatCount(fallback.maximumFileCount, locale),
                      formatBytes(fallback.maximumTotalBytes),
                    )}
                  </p>
                ) : null}
              </details>
            </>
          ) : (
            <>
              <h1>
                {snapshot?.paused === "local"
                  ? copy.paused
                  : snapshot?.paused === "remote"
                    ? copy.pausedRemote
                    : copy.sending}
              </h1>
              {snapshot ? <BulkProgress snapshot={snapshot} locale={locale} copy={copy} /> : null}
              {snapshot?.currentFile !== null && snapshot?.currentFile !== undefined ? (
                <p className="bulk-current">
                  {copy.currentFile(manifest[snapshot.currentFile]?.name ?? "")}
                </p>
              ) : null}
              <p className="bulk-note">{copy.keepScreenOn}</p>
              <div className="bulk-controls">
                {snapshot?.paused === "local" ? (
                  <SecondaryButton onClick={() => engine?.resume()}>
                    <Play aria-hidden="true" /> {copy.resume}
                  </SecondaryButton>
                ) : (
                  <SecondaryButton onClick={() => engine?.pause()}>
                    <Pause aria-hidden="true" /> {copy.pause}
                  </SecondaryButton>
                )}
                <DestructiveButton onClick={() => void cancel()}>{copy.cancel}</DestructiveButton>
              </div>
              {engine ? (
                <VirtualFileList
                  text={text}
                  count={manifest.length}
                  version={version}
                  label={copy.sending}
                  row={(index) => {
                    const state = engine.fileState(index);
                    const entry = manifest[index] ?? { name: "", size: 0, type: "" };
                    return { ...entry, state, detail: stateLabel(state, copy) };
                  }}
                />
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {stage === "done" && snapshot ? (
        <section className="mobile-step mobile-step--single" data-testid="bulk-send-done">
          <StatusIcon tone={snapshot.counts.failed ? "error" : "success"}>
            <CheckCircle2 size={34} aria-hidden="true" />
          </StatusIcon>
          <h1>{copy.doneTitleSender}</h1>
          <BulkProgress snapshot={snapshot} locale={locale} copy={copy} />
          <PrimaryButton onClick={() => void reset()}>{copy.newTransfer}</PrimaryButton>
        </section>
      ) : null}

      {stage === "cancelled" || stage === "failed" ? (
        <section className="mobile-step mobile-step--single">
          <StatusIcon tone="error">
            <X size={34} aria-hidden="true" />
          </StatusIcon>
          <h1>{stage === "cancelled" ? copy.cancelled : failureText(failure, copy)}</h1>
          {stage === "failed" && fitsCloud ? (
            <SecondaryButton onClick={() => void switchToCloud()}>
              {copy.fallbackCloud}
            </SecondaryButton>
          ) : null}
          <PrimaryButton onClick={() => void reset()}>{copy.newTransfer}</PrimaryButton>
        </section>
      ) : null}
    </BulkShell>
  );
}

function failureText(failure: SessionFailure | null, copy: ReturnType<typeof bulkCopy>): string {
  switch (failure) {
    case "expired":
      return copy.errorExpired;
    case "unsupported":
      return copy.errorUnsupported;
    case "taken":
      return copy.errorTaken;
    case "notFound":
      return copy.errorNotFound;
    default:
      return copy.errorRetries;
  }
}

/**
 * Outside Production only: `?frame=<bytes>` overrides the data-channel message
 * size so the browser benchmark can compare frame sizes. Production always
 * uses the protocol default (16 KiB, or the negotiated maximum if smaller).
 */
function devFrameBytes(): { frameBytes?: number } {
  if (process.env.NODE_ENV === "production") return {};
  const value = Number(new URLSearchParams(window.location.search).get("frame"));
  return Number.isInteger(value) && value >= 1024 && value <= 256 * 1024
    ? { frameBytes: value }
    : {};
}
