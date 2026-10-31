"use client";

import { Printer, ScanLine, Send } from "lucide-react";
import Link from "next/link";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { more } from "./promo-copy";
import styles from "./promo.module.css";

const ICONS: Record<string, ReactNode> = {
  print: <Printer aria-hidden="true" size={22} />,
  share: <Send aria-hidden="true" size={22} />,
  scan: <ScanLine aria-hidden="true" size={22} />,
};

/** Print, Share and Scan as one tab set: one capability in view, its conditions beside it. */
export function MoreTabs() {
  const [selected, setSelected] = useState(0);
  const base = useId();
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);

  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = more.items.length - 1;
    const next =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? (index + 1) % (last + 1)
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? (index + last) % (last + 1)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : undefined;
    if (next === undefined) return;
    event.preventDefault();
    setSelected(next);
    tabs.current[next]?.focus();
  };

  return (
    <div className={styles.tabs}>
      <div className={styles.tabList} role="tablist" aria-label={more.title}>
        {more.items.map((item, index) => (
          <button
            key={item.id}
            ref={(element) => {
              tabs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${item.id}`}
            aria-selected={selected === index}
            aria-controls={`${base}-panel-${item.id}`}
            tabIndex={selected === index ? 0 : -1}
            className={styles.tab}
            onClick={() => setSelected(index)}
            onKeyDown={(event) => move(event, index)}
          >
            {ICONS[item.id]}
            <span>{item.name}</span>
          </button>
        ))}
      </div>
      {more.items.map((item, index) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`${base}-panel-${item.id}`}
          aria-labelledby={`${base}-tab-${item.id}`}
          hidden={selected !== index}
          className={styles.tabPanel}
        >
          <div className={styles.tabIntro}>
            <h3>{item.name}</h3>
            <p>{item.body}</p>
          </div>
          <div className={styles.tabConditions}>
            <p className={styles.cardLabel}>{more.conditionsLabel}</p>
            <ul className={styles.conditions}>
              {item.conditions.map((condition) => (
                <li key={condition}>{condition}</li>
              ))}
            </ul>
          </div>
          <div className={styles.tabActions}>
            <Link className={styles.primary} href={item.href}>
              {item.cta}
            </Link>
            {"secondaryHref" in item ? (
              <Link className={styles.tertiary} href={item.secondaryHref}>
                {item.secondaryCta}
              </Link>
            ) : null}
          </div>
        </div>
      ))}
      <noscript>
        <div className={styles.noScriptFeatures}>
          {more.items.slice(1).map((item) => (
            <details key={item.id} className={styles.disclosure}>
              <summary>{item.name}</summary>
              <p>{item.body}</p>
              <ul>
                {item.conditions.map((condition) => (
                  <li key={condition}>{condition}</li>
                ))}
              </ul>
              <a className={styles.tertiary} href={item.href}>
                {item.cta}
              </a>
              {"secondaryHref" in item ? (
                <a className={styles.tertiary} href={item.secondaryHref}>
                  {item.secondaryCta}
                </a>
              ) : null}
            </details>
          ))}
        </div>
      </noscript>
    </div>
  );
}
