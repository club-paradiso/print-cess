import type { ButtonHTMLAttributes, CSSProperties, PropsWithChildren, ReactNode } from "react";
import { Check } from "lucide-react";

/**
 * The Print-cess mark: a printer whose incoming sheet has a crown's edge and
 * whose outgoing sheet carries a scan frame. It must read as a printer first;
 * the crown is the name's one wink and the frame is the QR hand-off.
 *
 * Geometry is shared with `apps/web/src/app/icon.svg` and
 * `docs/assets/print-cess-mark.svg`. Change all three together.
 */
export function PrintcessMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`pc-mark ${className}`.trim()}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path className="pc-mark__jewel" d="M32 2.4 35.6 6 32 9.6 28.4 6Z" />
      <path
        className="pc-mark__crown"
        d="M18 28V12.5l7 5.8 7-7 7 7 7-5.8V28Z"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <rect className="pc-mark__body" x="6" y="24.5" width="52" height="25" rx="7.5" />
      <rect className="pc-mark__slot" x="15" y="24.5" width="34" height="3.5" rx="1.75" />
      <rect className="pc-mark__slot" x="14" y="39.5" width="36" height="4" rx="2" />
      <path
        className="pc-mark__sheet"
        d="M17 41.5h30V58a2.5 2.5 0 0 1-2.5 2.5h-25A2.5 2.5 0 0 1 17 58Z"
      />
      <path
        className="pc-mark__code"
        d="M22.5 49.5v-3h3M41.5 49.5v-3h-3M22.5 52.5v3h3M41.5 52.5v3h-3"
      />
      <path className="pc-mark__dot" d="M28.8 48.2h6.4v5.6h-6.4z" />
      <circle className="pc-mark__status" cx="50.5" cy="31.5" r="2.7" />
    </svg>
  );
}

/**
 * The lockup. "Print-" is set in ink and "cess" in the brand indigo, so the
 * name's two halves read the way the logo does; the accessible name is the
 * whole service name in one piece, never the split.
 */
export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={compact ? "pc-wordmark pc-wordmark--compact" : "pc-wordmark"}
      role="img"
      aria-label="Print-cess by Club Paradiso"
    >
      <PrintcessMark />
      <span aria-hidden="true">
        <strong>
          Print-<span className="pc-wordmark__accent">cess</span>
        </strong>{" "}
        <small>by Club Paradiso</small>
      </span>
    </div>
  );
}

export function PrimaryButton({
  children,
  className = "",
  ...properties
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`pc-button pc-button--primary ${className}`.trim()} {...properties}>
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  className = "",
  ...properties
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`pc-button pc-button--secondary ${className}`.trim()} {...properties}>
      {children}
    </button>
  );
}

/** A quiet text action: the guide link, "change", "back". Never the main step. */
export function TertiaryButton({
  children,
  className = "",
  ...properties
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`pc-button pc-button--tertiary ${className}`.trim()} {...properties}>
      {children}
    </button>
  );
}

/** Erases or ends something. It is never styled like the step that moves forward. */
export function DestructiveButton({
  children,
  className = "",
  ...properties
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`pc-button pc-button--destructive ${className}`.trim()} {...properties}>
      {children}
    </button>
  );
}

export function ProgressSteps({
  current,
  total,
  label,
}: {
  current: number;
  total: number;
  label: string;
}) {
  return (
    <div
      className="pc-progress"
      aria-label={label}
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
    >
      <div
        className="pc-progress__track"
        aria-hidden="true"
        style={{ "--pc-progress-total": total } as CSSProperties}
      >
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={index + 1 <= current ? "pc-progress__dot is-active" : "pc-progress__dot"}
          >
            {index + 1 < current ? <Check size={14} strokeWidth={3} /> : null}
          </span>
        ))}
      </div>
      <span className="pc-progress__label">{label}</span>
    </div>
  );
}

export function ScreenShell({ children, footer }: PropsWithChildren<{ footer?: ReactNode }>) {
  return (
    <main className="pc-screen-shell">
      <div className="pc-screen-shell__body">{children}</div>
      {footer ? <div className="pc-screen-shell__footer">{footer}</div> : null}
    </main>
  );
}

export function StatusIcon({
  tone = "info",
  children,
}: PropsWithChildren<{ tone?: "info" | "success" | "warning" | "error" }>) {
  return <span className={`pc-status-icon pc-status-icon--${tone}`}>{children}</span>;
}

/**
 * The document on its way: a sheet entering the printer while it is being sent,
 * and leaving it while the printer works. It is drawn only while the service is
 * genuinely busy, it never stands in for a percentage, and it is hidden from
 * assistive technology because the sentence beside it says the same thing.
 */
export function HandoffIllustration({ stage }: { stage: "sending" | "printing" }) {
  return (
    <div className={`pc-handoff pc-handoff--${stage}`} aria-hidden="true">
      <svg viewBox="0 0 112 112" fill="none" focusable="false">
        <defs>
          <clipPath id={`pc-handoff-clip-${stage}`}>
            {stage === "sending" ? (
              <rect x="0" y="0" width="112" height="46" />
            ) : (
              <rect x="0" y="72" width="112" height="40" />
            )}
          </clipPath>
        </defs>
        <rect className="pc-handoff__body" x="10" y="40" width="92" height="46" rx="14" />
        <rect className="pc-handoff__face" x="10" y="52" width="92" height="34" rx="12" />
        <rect className="pc-handoff__slot" x="26" y="40" width="60" height="6" rx="3" />
        <rect className="pc-handoff__slot" x="24" y="72" width="64" height="6" rx="3" />
        <circle className="pc-handoff__led" cx="88" cy="62" r="4" />
        <g clipPath={`url(#pc-handoff-clip-${stage})`}>
          <g className="pc-handoff__travel">
            {stage === "sending" ? (
              <>
                <rect className="pc-handoff__sheet" x="33" y="6" width="46" height="40" rx="4" />
                <path className="pc-handoff__lines" d="M42 18h28M42 26h28M42 34h18" />
              </>
            ) : (
              <>
                <rect className="pc-handoff__sheet" x="30" y="66" width="52" height="34" rx="4" />
                <path className="pc-handoff__lines" d="M40 80h32M40 88h22" />
              </>
            )}
          </g>
        </g>
      </svg>
    </div>
  );
}

/**
 * Where a file is going, drawn as two objects and the path between them:
 * phone to printer, phone to laptop, paper to PDF. It names the capability's
 * shape at a glance and carries no state, so it never moves and is hidden from
 * assistive technology; the heading beside it says the same thing in words.
 */
export function RouteGlyph({ from, to }: { from: ReactNode; to: ReactNode }) {
  return (
    <span className="pc-route" aria-hidden="true">
      <span className="pc-route__end pc-route__end--from">{from}</span>
      <svg className="pc-route__path" viewBox="0 0 40 12" focusable="false">
        <path d="M1 6h30" strokeDasharray="3 4" />
        <path d="m31 1.5 6 4.5-6 4.5" />
      </svg>
      <span className="pc-route__end pc-route__end--to">{to}</span>
    </span>
  );
}

/**
 * The scan frame from the mark: four rounded corners drawn around whatever QR
 * code the parent holds. Purely decorative; the parent keeps the code's own
 * quiet zone, so the corners never touch a module a camera has to read.
 */
export function ScanFrame() {
  return (
    <svg className="pc-scan-frame" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <path d="M2.5 20V9A6.5 6.5 0 0 1 9 2.5h11M80 2.5h11A6.5 6.5 0 0 1 97.5 9v11M97.5 80v11a6.5 6.5 0 0 1-6.5 6.5H80M20 97.5H9A6.5 6.5 0 0 1 2.5 91V80" />
    </svg>
  );
}
