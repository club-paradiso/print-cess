"use client";

import { useCallback, useEffect, useState, type ReactNode, type UIEvent } from "react";
import { CircleAlert, Cloud, Layers, Link2, Link2Off, LoaderCircle, Radio } from "lucide-react";

import type { SupportedLocale } from "@print-cess/i18n";
import { ScreenShell } from "@print-cess/ui";

import { AppTopbar } from "@/components/shared/app-topbar";
import { formatBytes, FileRow, type Text } from "@/components/drop/drop-shell";

import type { LinkState } from "@/lib/bulk/session";
import { FILE_STATE, type StateCounts, type TransferSnapshot } from "@/lib/bulk/types";

import { formatCount, type BulkCopy } from "./bulk-copy";

export function BulkShell({
  locale,
  onLocaleChange,
  text,
  copy,
  children,
}: {
  locale: SupportedLocale;
  onLocaleChange: (locale: SupportedLocale) => void;
  text: Text;
  copy: BulkCopy;
  children: ReactNode;
}) {
  return (
    <ScreenShell>
      <AppTopbar
        locale={locale}
        onLocaleChange={onLocaleChange}
        languageLabel={text("selectLanguage")}
        section={{ icon: <Layers aria-hidden="true" />, label: copy.section }}
      />
      {children}
    </ScreenShell>
  );
}

/**
 * The network indicator. It names what the page observed, in words first and
 * colour second, and never says "connected" before the channel's handshake
 * verified the other device.
 */
export function LinkIndicator({
  state,
  copy,
  cloud = false,
}: {
  state: LinkState;
  copy: BulkCopy;
  cloud?: boolean;
}) {
  if (cloud) {
    return (
      <p className="bulk-link bulk-link--cloud" role="status" data-link-state="cloud">
        <Cloud aria-hidden="true" /> {copy.linkCloud}
      </p>
    );
  }
  const [label, icon, tone] = {
    preparing: [copy.linkPreparing, <LoaderCircle key="i" className="bulk-spin" />, "busy"],
    waiting: [copy.linkWaiting, <Radio key="i" />, "busy"],
    connecting: [copy.linkConnecting, <LoaderCircle key="i" className="bulk-spin" />, "busy"],
    direct: [copy.linkDirect, <Link2 key="i" />, "ok"],
    relay: [copy.linkRelay, <Link2 key="i" />, "ok"],
    disconnected: [copy.linkDisconnected, <Link2Off key="i" />, "warn"],
    failed: [copy.linkFailed, <CircleAlert key="i" />, "error"],
  }[state] as [string, ReactNode, string];
  return (
    <p className={`bulk-link bulk-link--${tone}`} role="status" data-link-state={state}>
      <span aria-hidden="true">{icon}</span> {label}
    </p>
  );
}

export function CountsLine({
  counts,
  copy,
  locale,
}: {
  counts: StateCounts;
  copy: BulkCopy;
  locale: SupportedLocale;
}) {
  const n = (value: number) => formatCount(value, locale);
  const parts: [string, string][] = [];
  if (counts.saved) parts.push(["saved", copy.countSaved(n(counts.saved))]);
  if (counts.stored) parts.push(["stored", copy.countStored(n(counts.stored))]);
  if (counts.downloadStarted)
    parts.push(["downloadStarted", copy.countDownloadStarted(n(counts.downloadStarted))]);
  if (counts.failed) parts.push(["failed", copy.countFailed(n(counts.failed))]);
  const left = counts.pending + counts.active;
  if (left) parts.push(["pending", copy.countPending(n(left))]);
  return (
    <ul className="bulk-counts" data-testid="bulk-counts">
      {parts.map(([key, label]) => (
        <li key={key} className={`bulk-count bulk-count--${key}`} data-count={key}>
          {label}
        </li>
      ))}
    </ul>
  );
}

export function BulkProgress({
  snapshot,
  locale,
  copy,
}: {
  snapshot: TransferSnapshot;
  locale: SupportedLocale;
  copy: BulkCopy;
}) {
  const percent =
    snapshot.totalBytes > 0
      ? Math.min(100, Math.floor((snapshot.doneBytes / snapshot.totalBytes) * 100))
      : snapshot.counts.pending + snapshot.counts.active === 0
        ? 100
        : 0;
  const finishedFiles = snapshot.fileCount - snapshot.counts.pending - snapshot.counts.active;
  return (
    <div className="drop-progress" data-testid="bulk-progress" data-percent={percent}>
      <div
        className="drop-progress__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`${percent}%`}
      >
        <span className="drop-progress__fill" style={{ inlineSize: `${percent}%` }} />
      </div>
      <p className="drop-progress__label">
        {percent}% · {formatBytes(snapshot.doneBytes)} / {formatBytes(snapshot.totalBytes)} ·{" "}
        {formatCount(finishedFiles, locale)} / {formatCount(snapshot.fileCount, locale)}
      </p>
      <CountsLine counts={snapshot.counts} copy={copy} locale={locale} />
    </div>
  );
}

const ROW_HEIGHT = 60;
const VISIBLE_ROWS = 7;
const OVERSCAN = 4;

/**
 * A windowed list: only the rows in view (plus a few) exist in the DOM, so a
 * 3,000-file transfer renders about fifteen rows, not three thousand cards.
 */
export function VirtualFileList({
  count,
  row,
  label,
  version,
  text,
}: {
  text: Text;
  count: number;
  row: (index: number) => {
    name: string;
    size: number;
    type: string;
    state?: number;
    detail?: string;
  };
  label: string;
  /** Changes whenever row content may have changed, to re-render visible rows. */
  version: number;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const onScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);
  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const last = Math.min(count, Math.ceil(scrollTop / ROW_HEIGHT) + VISIBLE_ROWS + OVERSCAN);
  const height = Math.min(count, VISIBLE_ROWS) * ROW_HEIGHT;
  const rows: ReactNode[] = [];
  for (let index = first; index < last; index += 1) {
    const item = row(index);
    rows.push(
      <li
        key={index}
        className={`bulk-row drop-file ${stateClass(item.state)}`}
        style={{ transform: `translateY(${index * ROW_HEIGHT}px)` }}
        data-index={index}
      >
        <FileRow file={item} text={text} detail={item.detail} />
      </li>,
    );
  }
  return (
    <div
      className="bulk-list"
      style={{ blockSize: `${height}px` }}
      onScroll={onScroll}
      tabIndex={0}
      role="region"
      aria-label={label}
      data-version={version}
      data-testid="bulk-list"
    >
      <ul className="bulk-list__inner" style={{ blockSize: `${count * ROW_HEIGHT}px` }}>
        {rows}
      </ul>
    </div>
  );
}

function stateClass(state: number | undefined): string {
  if (state === FILE_STATE.saved || state === FILE_STATE.downloadStarted) return "drop-file--saved";
  if (state === FILE_STATE.stored) return "drop-file--shared";
  if (state === FILE_STATE.failed) return "drop-file--failed";
  if (state === FILE_STATE.active) return "drop-file--saving";
  return "";
}

export function stateLabel(state: number, copy: BulkCopy): string {
  switch (state) {
    case FILE_STATE.active:
      return copy.stateActive;
    case FILE_STATE.saved:
      return copy.stateSaved;
    case FILE_STATE.stored:
      return copy.stateStored;
    case FILE_STATE.downloadStarted:
      return copy.stateDownloadStarted;
    case FILE_STATE.failed:
      return copy.stateFailed;
    default:
      return copy.statePending;
  }
}

/** Keeps the screen awake and warns before leaving while `active` is true. */
export function useTransferGuards(active: boolean, warning: string): void {
  useEffect(() => {
    if (!active) return;
    let lock: { release(): Promise<void> } | null = null;
    let released = false;
    const acquire = async () => {
      try {
        const wakeLock = (
          navigator as Navigator & {
            wakeLock?: { request(type: "screen"): Promise<{ release(): Promise<void> }> };
          }
        ).wakeLock;
        if (!wakeLock || document.visibilityState !== "visible") return;
        lock = await wakeLock.request("screen");
        if (released) void lock.release();
      } catch {
        // Wake lock can be refused (low battery, policy). The warning still stands.
      }
    };
    void acquire();
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = warning;
      return warning;
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      released = true;
      void lock?.release().catch(() => undefined);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [active, warning]);
}

export { formatBytes };
