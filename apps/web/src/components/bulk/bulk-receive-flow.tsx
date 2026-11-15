"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Download,
  FolderDown,
  HardDriveDownload,
  Pause,
  Play,
  RotateCcw,
  Share2,
  X,
} from "lucide-react";

import type { SupportedLocale } from "@print-cess/i18n";
import { deriveBulkKeys, type BulkKeys } from "@print-cess/crypto";
import type { BulkCapabilities } from "@print-cess/protocol";
import { DestructiveButton, PrimaryButton, SecondaryButton, StatusIcon } from "@print-cess/ui";

import { useDropLocale } from "@/components/drop/drop-shell";

import { dropFileKind } from "@/lib/drop-file-kind";
import { parseDropFragment, readDropCodeEntry } from "@/lib/drop-link";
import type { ReceivedManifest } from "@/lib/bulk/receiver";
import type { BulkSaveTarget } from "@/lib/bulk/save-target";
import { BulkReceiveSession, type LinkState, type SessionFailure } from "@/lib/bulk/session";
import { getBulkCapabilities } from "@/lib/bulk/signal-client";
import {
  BatchTarget,
  bulkSaveOptions,
  directDownloadTarget,
  downloadFile,
  pickFolderTarget,
  shareFiles,
  type BatchItem,
} from "@/lib/bulk/staging";
import type { TransferSnapshot } from "@/lib/bulk/types";

import { bulkCopy, formatCount, type BulkCopy } from "./bulk-copy";
import {
  BulkProgress,
  BulkShell,
  LinkIndicator,
  VirtualFileList,
  formatBytes,
  stateLabel,
  useTransferGuards,
} from "./bulk-shared";

type Stage = "code" | "connecting" | "choose" | "receiving" | "done" | "cancelled" | "failed";

/** Files offered to one share sheet or one download tap. */
const EXPORT_CHUNK_FILES = 20;

export function BulkReceiveFlow({ initialLocale }: { initialLocale?: SupportedLocale }) {
  // Korean is this flow's default: the server-chosen locale is treated as the
  // visitor's choice, so the browser's language does not silently override it.
  const [locale, setLocale, text] = useDropLocale(initialLocale, initialLocale);
  const copy = bulkCopy(locale);
  const [chosenStage, setStage] = useState<Stage>("code");
  const [entry, setEntry] = useState("");
  const [entryError, setEntryError] = useState(false);
  const [linkState, setLinkState] = useState<LinkState>("connecting");
  const [failure, setFailure] = useState<SessionFailure | null>(null);
  const [manifest, setManifest] = useState<ReceivedManifest | null>(null);
  const [snapshot, setSnapshot] = useState<TransferSnapshot | null>(null);
  const [batch, setBatch] = useState<BatchTarget | null>(null);
  const [batchFull, setBatchFull] = useState(false);
  const [exportedChunks, setExportedChunks] = useState(0);
  const [handedOver, setHandedOver] = useState(0);
  const [version, setVersion] = useState(0);
  const stage: Stage = chosenStage === "receiving" && snapshot?.finished ? "done" : chosenStage;
  const session = useRef<BulkReceiveSession | null>(null);
  // The same session, as state, for rendering (refs are not read during render).
  const [active, setActive] = useState<BulkReceiveSession | null>(null);
  const capabilities = useRef<BulkCapabilities | null>(null);

  const begin = useCallback(async (code: string) => {
    setStage("connecting");
    setFailure(null);
    let keys: BulkKeys;
    try {
      [keys, capabilities.current] = await Promise.all([
        deriveBulkKeys(code),
        getBulkCapabilities().catch(() => null),
      ]);
    } catch {
      setEntryError(true);
      setStage("code");
      return;
    }
    const created = new BulkReceiveSession(keys, {
      iceServers: capabilities.current?.iceServers ?? [],
      windowBlocks: 16,
      onRemoteCancel: () => setStage("cancelled"),
      onLinkState: setLinkState,
      onFailure: (reason) => {
        setFailure(reason);
        setStage((current) => (current === "done" ? current : "failed"));
      },
      onManifest: (received) => {
        setManifest(received);
        setStage("choose");
      },
      onUpdate: (next) => {
        setSnapshot(next);
        setVersion((value) => value + 1);
      },
      onStorageFull: () => {
        setExportedChunks(0);
        setBatchFull(true);
      },
    });
    session.current = created;
    setActive(created);
    void created.run();
  }, []);

  // The code arrives in the URL fragment, which never reaches the server. It is
  // removed from the address bar at once, so it is not left in history.
  useEffect(() => {
    const code = parseDropFragment(window.location.hash);
    if (!code) return;
    window.history.replaceState(null, "", window.location.pathname);
    void Promise.resolve().then(() => begin(code));
  }, [begin]);

  useEffect(
    () => () => {
      void session.current?.stop();
    },
    [],
  );

  const receiving = stage === "receiving" || (stage === "done" && (batch?.items.length ?? 0) > 0);
  useTransferGuards(receiving, copy.leaveWarning);

  const options = useMemo(() => bulkSaveOptions(manifest?.files.length ?? 0), [manifest]);

  const startWith = useCallback((target: BulkSaveTarget) => {
    session.current?.engine.start(target);
    setStage("receiving");
  }, []);

  const chooseFolder = useCallback(async () => {
    // Called directly from the tap: the folder picker needs the user activation.
    const target = await pickFolderTarget().catch(() => null);
    if (target) startWith(target);
  }, [startWith]);

  const chooseBatch = useCallback(async () => {
    const target = await BatchTarget.create();
    setBatch(target);
    startWith(target);
  }, [startWith]);

  const chooseDownloads = useCallback(() => startWith(directDownloadTarget()), [startWith]);

  const chunks = useMemo(() => {
    const items = batch?.items ?? [];
    const out: BatchItem[][] = [];
    for (let index = 0; index < items.length; index += EXPORT_CHUNK_FILES) {
      out.push(items.slice(index, index + EXPORT_CHUNK_FILES));
    }
    return out;
    // `version` changes whenever the batch gains a file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch, version, batchFull]);

  const exportChunk = useCallback(
    async (mode: "share" | "download") => {
      const chunk = chunks[exportedChunks];
      if (!chunk) return;
      const files = await Promise.all(chunk.map((item) => item.file()));
      if (mode === "share") {
        const result = await shareFiles(files).catch(() => "dismissed" as const);
        if (result !== "shared") return;
      } else {
        for (const file of files) downloadFile(file);
      }
      setHandedOver((value) => value + files.length);
      setExportedChunks((value) => value + 1);
    },
    [chunks, exportedChunks],
  );

  const finishBatch = useCallback(async () => {
    if (exportedChunks < chunks.length && !window.confirm(copy.batchClearConfirm)) return;
    await batch?.clear();
    setExportedChunks(0);
    setBatchFull(false);
    setVersion((value) => value + 1);
    session.current?.engine.storageFreed();
  }, [batch, chunks.length, copy.batchClearConfirm, exportedChunks]);

  const cancel = useCallback(async () => {
    if (!window.confirm(copy.cancelConfirm)) return;
    await session.current?.cancel();
    await session.current?.stop();
    await batch?.dispose();
    setStage("cancelled");
  }, [batch, copy.cancelConfirm]);

  const submitCode = useCallback(() => {
    const parsed = readDropCodeEntry(entry);
    if (!parsed.code) {
      setEntryError(true);
      return;
    }
    setEntryError(false);
    void begin(parsed.code);
  }, [begin, entry]);

  const engine = active?.engine;
  const kinds = useMemo(() => summarizeKinds(manifest), [manifest]);
  const failedCount = snapshot?.counts.failed ?? 0;
  const batchPending = (batch?.items.length ?? 0) > 0 && (batchFull || stage === "done");

  return (
    <BulkShell locale={locale} onLocaleChange={setLocale} text={text} copy={copy}>
      {stage === "code" ? (
        <section className="mobile-step mobile-step--single">
          <h1>{copy.receiveTitle}</h1>
          <label className="bulk-code">
            <span>{copy.enterCode}</span>
            <input
              value={entry}
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setEntry(readDropCodeEntry(event.target.value).display)}
              aria-invalid={entryError}
              data-testid="bulk-code-input"
            />
          </label>
          {entryError ? (
            <p className="mobile-file-error" role="alert">
              {copy.codeInvalid}
            </p>
          ) : null}
          <PrimaryButton onClick={submitCode}>{copy.openCode}</PrimaryButton>
        </section>
      ) : null}

      {stage === "connecting" ? (
        <section className="mobile-step mobile-step--single">
          <LinkIndicator state={linkState} copy={copy} />
          <h1>{copy.receiveTitle}</h1>
          <p>{copy.connectingHint}</p>
        </section>
      ) : null}

      {stage === "choose" && manifest ? (
        <section className="mobile-step bulk-choose">
          <LinkIndicator state={linkState} copy={copy} />
          <h1 data-testid="bulk-manifest-title">
            {copy.manifestTitle(
              formatCount(manifest.files.length, locale),
              formatBytes(manifest.totalBytes),
            )}
          </h1>
          <p>
            {copy.kindSummary(
              formatCount(kinds.photos, locale),
              formatCount(kinds.videos, locale),
              formatCount(kinds.others, locale),
            )}
          </p>
          <VirtualFileList
            text={text}
            count={manifest.files.length}
            version={0}
            label={copy.receiveTitle}
            row={(index) => manifest.files[index] ?? { name: "", size: 0, type: "" }}
          />
          <h2>{copy.chooseSave}</h2>
          <div className="bulk-save-options">
            {options.folder ? (
              <button type="button" className="source-tile" onClick={() => void chooseFolder()}>
                <span className="source-tile__icon" aria-hidden="true">
                  <FolderDown />
                </span>
                <span className="source-tile__label">{copy.saveFolder}</span>
                <span className="source-tile__hint">{copy.saveFolderHint}</span>
              </button>
            ) : null}
            <button
              type="button"
              className="source-tile"
              onClick={() => void chooseBatch()}
              data-testid="bulk-save-batch"
            >
              <span className="source-tile__icon" aria-hidden="true">
                <HardDriveDownload />
              </span>
              <span className="source-tile__label">{copy.saveBatch}</span>
              <span className="source-tile__hint">
                {copy.saveBatchHint(options.batch === "storage" ? "4GB" : "256MB")}
                {options.batch === "memory" ? ` ${copy.saveBatchMemoryNote}` : ""}
              </span>
            </button>
            {options.directDownloads ? (
              <button
                type="button"
                className="source-tile"
                onClick={chooseDownloads}
                data-testid="bulk-save-downloads"
              >
                <span className="source-tile__icon" aria-hidden="true">
                  <Download />
                </span>
                <span className="source-tile__label">{copy.saveDownloads}</span>
                <span className="source-tile__hint">{copy.saveDownloadsHint}</span>
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {(stage === "receiving" || stage === "done") && manifest && snapshot ? (
        <section className="mobile-step bulk-receiving">
          <LinkIndicator state={linkState} copy={copy} />
          <h1 data-testid="bulk-receive-title">
            {stage === "done"
              ? copy.doneTitleReceiver
              : snapshot.paused === "storage"
                ? copy.pausedStorage
                : snapshot.paused === "local"
                  ? copy.paused
                  : snapshot.paused === "remote"
                    ? copy.pausedRemote
                    : copy.receiving}
          </h1>
          <BulkProgress snapshot={snapshot} locale={locale} copy={copy} />

          {batchPending && batch ? (
            <div className="bulk-batch" data-testid="bulk-batch">
              <h2>
                {copy.batchTitle(
                  formatCount(batch.items.length, locale),
                  formatBytes(batch.items.reduce((sum, item) => sum + item.size, 0)),
                )}
              </h2>
              <p>{copy.batchHintIos}</p>
              {exportedChunks < chunks.length ? (
                <div className="bulk-controls">
                  {options.share ? (
                    <PrimaryButton onClick={() => void exportChunk("share")}>
                      <Share2 aria-hidden="true" />{" "}
                      {copy.shareChunk(String(exportedChunks + 1), String(chunks.length))}
                    </PrimaryButton>
                  ) : null}
                  <SecondaryButton
                    onClick={() => void exportChunk("download")}
                    data-testid="bulk-batch-download"
                  >
                    <Download aria-hidden="true" />{" "}
                    {copy.downloadChunk(String(exportedChunks + 1), String(chunks.length))}
                  </SecondaryButton>
                </div>
              ) : null}
              <SecondaryButton onClick={() => void finishBatch()} data-testid="bulk-batch-done">
                {stage === "done" ? copy.batchDoneLast : copy.batchDone}
              </SecondaryButton>
            </div>
          ) : null}

          {handedOver > 0 ? (
            <p className="bulk-note" data-testid="bulk-handed-over">
              {copy.handedOver(formatCount(handedOver, locale))} · {copy.handedOverNote}
            </p>
          ) : null}

          {stage === "receiving" ? (
            <div className="bulk-controls">
              {snapshot.paused === "local" ? (
                <SecondaryButton onClick={() => engine?.resume()}>
                  <Play aria-hidden="true" /> {copy.resumeReceive}
                </SecondaryButton>
              ) : snapshot.paused !== "storage" ? (
                <SecondaryButton onClick={() => engine?.pause()}>
                  <Pause aria-hidden="true" /> {copy.pause}
                </SecondaryButton>
              ) : null}
              <DestructiveButton onClick={() => void cancel()}>{copy.cancel}</DestructiveButton>
            </div>
          ) : null}

          {failedCount > 0 && (linkState === "direct" || linkState === "relay") ? (
            <SecondaryButton
              onClick={() => {
                engine?.retryFailed();
                setStage("receiving");
              }}
            >
              <RotateCcw aria-hidden="true" /> {copy.retryFailed(formatCount(failedCount, locale))}
            </SecondaryButton>
          ) : null}

          {engine ? (
            <VirtualFileList
              text={text}
              count={manifest.files.length}
              version={version}
              label={copy.receiving}
              row={(index) => {
                const state = engine.fileState(index);
                const reason = engine.failureReason(index);
                const file = manifest.files[index] ?? { name: "", size: 0, type: "" };
                return {
                  ...file,
                  state,
                  detail: reason ? failureLabel(reason, copy) : stateLabel(state, copy),
                };
              }}
            />
          ) : null}
        </section>
      ) : null}

      {stage === "cancelled" || stage === "failed" ? (
        <section className="mobile-step mobile-step--single">
          <StatusIcon tone="error">
            <X size={34} aria-hidden="true" />
          </StatusIcon>
          <h1>{stage === "cancelled" ? copy.cancelled : failureMessage(failure, copy)}</h1>
          {snapshot &&
          snapshot.counts.saved + snapshot.counts.stored + snapshot.counts.downloadStarted > 0 ? (
            <BulkProgress snapshot={snapshot} locale={locale} copy={copy} />
          ) : null}
          {batch && batch.items.length > 0 && stage === "failed" ? (
            <SecondaryButton onClick={() => setStage("done")}>
              <CheckCircle2 aria-hidden="true" />{" "}
              {copy.batchTitle(
                formatCount(batch.items.length, locale),
                formatBytes(batch.usedBytes),
              )}
            </SecondaryButton>
          ) : null}
        </section>
      ) : null}
    </BulkShell>
  );
}

function summarizeKinds(manifest: ReceivedManifest | null) {
  const counts = { photos: 0, videos: 0, others: 0 };
  for (const file of manifest?.files ?? []) {
    const kind = dropFileKind(file.name, file.type);
    if (kind === "image") counts.photos += 1;
    else if (kind === "video") counts.videos += 1;
    else counts.others += 1;
  }
  return counts;
}

function failureLabel(reason: string, copy: BulkCopy): string {
  switch (reason) {
    case "damaged":
      return copy.failedDamaged;
    case "unreadable":
      return copy.failedUnreadable;
    case "tooLarge":
      return copy.failedTooLarge;
    default:
      return copy.failedStorage;
  }
}

function failureMessage(failure: SessionFailure | null, copy: BulkCopy): string {
  switch (failure) {
    case "notFound":
      return copy.errorNotFound;
    case "taken":
      return copy.errorTaken;
    case "expired":
      return copy.errorExpired;
    case "unsupported":
      return copy.errorUnsupported;
    default:
      return copy.errorRetries;
  }
}
