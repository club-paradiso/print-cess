"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { support } from "./promo-copy";
import styles from "./promo.module.css";

type CopyState = "idle" | "copied" | "failed";

export function CopyButton({ value }: { value: string }) {
  const [state, setState] = useState<CopyState>("idle");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
    window.setTimeout(() => setState("idle"), 4000);
  };

  return (
    <>
      <button type="button" className={styles.secondary} onClick={() => void copy()}>
        {state === "copied" ? (
          <Check aria-hidden="true" size={18} />
        ) : (
          <Copy aria-hidden="true" size={18} />
        )}
        {support.bankCopy}
      </button>
      <span role="status" className={styles.copyStatus}>
        {state === "copied" ? support.bankCopied : state === "failed" ? support.bankFailed : ""}
      </span>
    </>
  );
}
