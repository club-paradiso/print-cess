"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./promo.module.css";

/**
 * The statement's three verbs. When the line is first read, each word's print
 * line feeds out under it in turn, like a sheet leaving the printer. The words
 * themselves never change colour, so contrast holds at every moment.
 */
export function StatementLine({ id, words }: { id: string; words: readonly string[] }) {
  const line = useRef<HTMLHeadingElement | null>(null);
  const [fed, setFed] = useState(false);

  useEffect(() => {
    const element = line.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setFed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.6 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <h2 id={id} ref={line} className={styles.statementLine} data-fed={fed}>
      {words.map((word) => (
        <span key={word}>{word}</span>
      ))}
    </h2>
  );
}
