"use client";

import { ArrowLeft, ArrowRight, FileText, Image as ImageIcon, QrCode } from "lucide-react";
import { useState } from "react";

import { Beacon, ScanFrame } from "@print-cess/ui";

import { how } from "./promo-copy";
import styles from "./promo.module.css";

const { screens } = how;

/** Four screens a visitor really sees, grouped under the three headline steps. */
const FRAMES = [
  { step: 0, id: "kiosk" },
  { step: 1, id: "choose" },
  { step: 1, id: "check" },
  { step: 2, id: "done" },
] as const;

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
          <span className={styles.fakeButton}>{screens.doneClose}</span>
        </>
      ) : null}
    </div>
  );
}

/**
 * A walk through the print flow in the product's own words. The screens are
 * drawings: nothing here uploads, encrypts or prints, and the buttons inside
 * them are not controls.
 */
export function HowDemo() {
  const [index, setIndex] = useState(0);
  const frame = FRAMES[index] ?? FRAMES[0];

  const jumpTo = (step: number) => {
    const first = FRAMES.findIndex((item) => item.step === step);
    if (first >= 0) setIndex(first);
  };

  return (
    <div className={styles.demo}>
      <ol className={styles.stepList} aria-label={how.stepsLabel}>
        {how.steps.map((step, step_index) => (
          <li key={step.title}>
            <button
              type="button"
              className={styles.stepButton}
              aria-current={frame.step === step_index ? "step" : undefined}
              onClick={() => jumpTo(step_index)}
            >
              <span className={styles.stepNumber} aria-hidden="true">
                {step_index + 1}
              </span>
              <span className={styles.stepText}>
                <strong>{step.title}</strong>
                <span>{step.body}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>

      <figure className={styles.stage}>
        <div className={styles.stageScreen} aria-live="polite">
          {frame.id === "kiosk" ? <KioskFrame /> : <PhoneFrame id={frame.id} />}
        </div>
        <figcaption className={styles.stageCaption}>{how.mockNote}</figcaption>
        <div className={styles.stageNav}>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => setIndex((value) => Math.max(0, value - 1))}
            disabled={index === 0}
          >
            <ArrowLeft aria-hidden="true" size={18} />
            {how.previous}
          </button>
          <span className={styles.stageCount}>
            {index + 1} / {FRAMES.length}
          </span>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => setIndex((value) => Math.min(FRAMES.length - 1, value + 1))}
            disabled={index === FRAMES.length - 1}
          >
            {how.next}
            <ArrowRight aria-hidden="true" size={18} />
          </button>
        </div>
      </figure>
    </div>
  );
}
