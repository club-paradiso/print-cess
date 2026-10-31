"use client";

import { useEffect, useRef, useState } from "react";

import { how } from "./promo-copy";
import styles from "./promo.module.css";
import { Screen, type ScreenId } from "./screens";

/** The screen a step shows; step two has a second screen the visitor can pick. */
function screenFor(step: number, variant: number): ScreenId {
  if (step === 0) return "kiosk";
  if (step === 1) return variant === 0 ? "choose" : "check";
  return "done";
}

/**
 * The print flow as one story read top to bottom, after the TAPSO site. The
 * steps are ordinary content in reading order. Scrolling only tells the sticky
 * screen and the step dock which step is being read: nothing is pinned,
 * hijacked or hidden until scrolled to, and no step needs the screen to be read.
 */
export function Journey() {
  const root = useRef<HTMLDivElement | null>(null);
  const flow = useRef<HTMLOListElement | null>(null);
  const [active, setActive] = useState(0);
  const [variant, setVariant] = useState(0);
  const [dock, setDock] = useState(false);

  // Follow the step that crosses the middle of the viewport.
  useEffect(() => {
    const steps = Array.from(flow.current?.querySelectorAll<HTMLElement>("[data-step]") ?? []);
    if (steps.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.step));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    for (const step of steps) observer.observe(step);
    return () => observer.disconnect();
  }, []);

  // The dock shows only while the walkthrough is on screen.
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => setDock(entry?.isIntersecting ?? false),
      {
        threshold: 0.2,
      },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    flow.current?.style.setProperty("--progress", String(active / (how.steps.length - 1)));
  }, [active]);

  const current = screenFor(active, variant);

  return (
    <div className={styles.journey} ref={root}>
      <ol className={styles.flow} ref={flow}>
        {how.steps.map((step, index) => {
          const shown = screenFor(index, variant);
          return (
            <li
              key={step.title}
              className={styles.step}
              data-step={index}
              data-state={index === active ? "active" : index < active ? "past" : "next"}
            >
              <span className={styles.stepStop} aria-hidden="true" />
              <p className={styles.stepLabel}>{index + 1}단계</p>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepBody}>{step.body}</p>
              {index === 1 ? (
                <div className={styles.variants} role="group" aria-label={how.variantsLabel}>
                  {how.variants.map((label, choice) => (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={variant === choice}
                      onClick={() => setVariant(choice)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
              <details className={styles.stepPreview}>
                <summary>
                  {how.previewLabel}
                  <span aria-hidden="true"> +</span>
                </summary>
                <p className="visually-hidden">그림: {how.pictures[shown]}</p>
                <div className={styles.stepVisual} aria-hidden="true">
                  <Screen id={shown} />
                  <span className={styles.stageCaption}>{how.mockNote}</span>
                </div>
              </details>
            </li>
          );
        })}
      </ol>

      <aside className={styles.journeyStage} aria-hidden="true">
        <div className={styles.stage}>
          <div className={styles.stageScreen} key={current}>
            <Screen id={current} />
          </div>
          <p className={styles.stageCaption}>{how.mockNote}</p>
        </div>
      </aside>

      <div className={styles.dock} data-visible={dock} aria-hidden="true">
        <span className={styles.dockNumber}>
          {active + 1}/{how.steps.length}
        </span>
        <span className={styles.dockTitle}>{how.steps[active]?.title}</span>
        <span className={styles.dockNote}>{how.dockLabel}</span>
      </div>
    </div>
  );
}
