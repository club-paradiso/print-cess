import { Check, FileText, Image as ImageIcon, LockKeyhole } from "lucide-react";

import { Beacon, PrintcessMark, ScanFrame } from "@print-cess/ui";

import { how } from "./promo-copy";
import styles from "./promo.module.css";

const { screens } = how;

export type ScreenId = "kiosk" | "choose" | "check" | "done";

/**
 * A decorative code: three finder squares and a fixed module pattern. It has no
 * format or timing information, so no camera can decode it into a link.
 */
function DecorativeCode() {
  const size = 21;
  const cells: Array<[number, number]> = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const inFinder = (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12);
      if (inFinder) continue;
      if ((x * 7 + y * 13 + x * y) % 5 < 2) cells.push([x, y]);
    }
  }
  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width={7} height={7} rx={1.4} />
      <rect x={x + 1} y={y + 1} width={5} height={5} rx={1} className={styles.codeGap} />
      <rect x={x + 2} y={y + 2} width={3} height={3} rx={0.6} />
    </g>
  );
  return (
    <svg className={styles.code} viewBox={`-1 -1 ${size + 2} ${size + 2}`} aria-hidden="true">
      {cells.map(([x, y]) => (
        <rect key={`${x}.${y}`} x={x} y={y} width={1} height={1} rx={0.25} />
      ))}
      {finder(0, 0)}
      {finder(14, 0)}
      {finder(0, 14)}
    </svg>
  );
}

/** The shared display beside the printer, as a monitor on a stand. */
function Kiosk() {
  return (
    <div className={styles.monitor}>
      <div className={styles.monitorScreen}>
        <p className={styles.monitorEyebrow}>{screens.kioskTitle}</p>
        <p className={styles.monitorTitle}>{screens.kioskCaption}</p>
        <div className={styles.monitorCode}>
          <ScanFrame />
          <DecorativeCode />
        </div>
        <p className={styles.monitorFinder}>
          <Beacon size="sm" />
          <span>{screens.kioskFinder}</span>
        </p>
      </div>
      <span className={styles.monitorNeck} />
      <span className={styles.monitorBase} />
    </div>
  );
}

function PhoneScreen({ id }: { id: "choose" | "check" | "done" }) {
  if (id === "choose") {
    return (
      <>
        <p className={styles.appTitle}>{screens.chooseTitle}</p>
        <p className={styles.appMuted}>{screens.chooseRules}</p>
        <div className={styles.appActions}>
          <span className="pc-button pc-button--primary">
            <ImageIcon size={20} />
            {screens.choosePhotos}
          </span>
          <span className="pc-button pc-button--secondary">
            <FileText size={20} />
            {screens.chooseFiles}
          </span>
        </div>
      </>
    );
  }
  if (id === "check") {
    return (
      <>
        <p className={styles.appTitle}>{screens.checkTitle}</p>
        <div className={styles.appPaper}>
          <span />
          <span />
          <span />
          <span />
        </div>
        <p className={styles.appMuted}>{screens.checkSummary}</p>
        <p className={styles.appLock}>
          <LockKeyhole size={14} />
          {screens.checkPrivacy}
        </p>
        <div className={styles.appActions}>
          <span className="pc-button pc-button--primary">{screens.checkPrint}</span>
        </div>
      </>
    );
  }
  return (
    <>
      <span className={styles.appDone}>
        <Check size={34} strokeWidth={3} />
      </span>
      <p className={`${styles.appTitle} ${styles.appCenter}`}>{screens.doneTitle}</p>
      <p className={`${styles.appMuted} ${styles.appCenter}`}>{screens.doneBody}</p>
      <div className={styles.appActions}>
        <span className="pc-button pc-button--secondary">{screens.doneClose}</span>
      </div>
    </>
  );
}

/** A phone drawn in black glass, showing one screen of the print flow. */
function Phone({ id }: { id: "choose" | "check" | "done" }) {
  return (
    <div className={styles.phone}>
      <div className={styles.phoneScreen}>
        <span className={styles.island} />
        <p className={styles.statusBar}>
          <span>9:41</span>
          <span className={styles.statusIcons}>
            <i />
            <i />
            <i />
          </span>
        </p>
        <p className={styles.appBar}>
          <PrintcessMark />
          <span>Print-cess</span>
        </p>
        <div className={styles.appBody}>
          <PhoneScreen id={id} />
        </div>
      </div>
    </div>
  );
}

/** One drawn screen of the print flow, in the product's own words. Decorative. */
export function Screen({ id }: { id: ScreenId }) {
  return id === "kiosk" ? <Kiosk /> : <Phone id={id} />;
}
