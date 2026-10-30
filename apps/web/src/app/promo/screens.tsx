import { FileText, Image as ImageIcon, QrCode } from "lucide-react";

import { Beacon, ScanFrame } from "@print-cess/ui";

import { how } from "./promo-copy";
import styles from "./promo.module.css";

const { screens } = how;

export type ScreenId = "kiosk" | "choose" | "check" | "done";

function KioskFrame() {
  return (
    <div className={`${styles.device} ${styles.deviceKiosk}`}>
      <p className={styles.deviceLabel}>{screens.kioskTitle}</p>
      <div className={styles.qrBox}>
        <ScanFrame />
        <QrCode aria-hidden="true" size={96} strokeWidth={1.5} />
      </div>
      <p className={styles.deviceStrong}>{screens.kioskCaption}</p>
      <p className={styles.deviceFinder}>
        <Beacon size="sm" />
        <span>{screens.kioskFinder}</span>
      </p>
    </div>
  );
}

function PhoneFrame({ id }: { id: "choose" | "check" | "done" }) {
  return (
    <div className={`${styles.device} ${styles.devicePhone}`}>
      <span className={styles.notch} aria-hidden="true" />
      {id === "choose" ? (
        <>
          <p className={styles.deviceStrong}>{screens.chooseTitle}</p>
          <p className={styles.deviceMuted}>{screens.chooseRules}</p>
          <span className={styles.fakeButton} data-primary="true">
            <ImageIcon aria-hidden="true" size={20} />
            {screens.choosePhotos}
          </span>
          <span className={styles.fakeButton}>
            <FileText aria-hidden="true" size={20} />
            {screens.chooseFiles}
          </span>
        </>
      ) : null}
      {id === "check" ? (
        <>
          <p className={styles.deviceStrong}>{screens.checkTitle}</p>
          <p className={styles.deviceMuted}>{screens.checkHelp}</p>
          <span className={styles.sheet} aria-hidden="true" />
          <p className={styles.deviceMuted}>{screens.checkSummary}</p>
          <p className={styles.deviceMuted}>{screens.checkPrivacy}</p>
          <span className={styles.fakeButton} data-primary="true">
            {screens.checkPrint}
          </span>
          <span className={styles.fakeButton}>{screens.checkOther}</span>
        </>
      ) : null}
      {id === "done" ? (
        <>
          <p className={styles.deviceStrong}>{screens.doneTitle}</p>
          <p className={styles.deviceMuted}>{screens.doneBody}</p>
          <span className={styles.printerArt} aria-hidden="true">
            <span className={styles.printerBody} />
            <span className={styles.printerSheet} />
          </span>
          <span className={styles.fakeButton}>{screens.doneClose}</span>
        </>
      ) : null}
    </div>
  );
}

/** One drawn screen of the print flow, in the product's own words. */
export function Screen({ id }: { id: ScreenId }) {
  return id === "kiosk" ? <KioskFrame /> : <PhoneFrame id={id} />;
}
