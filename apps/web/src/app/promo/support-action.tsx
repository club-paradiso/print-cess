"use client";

import { ExternalLink, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { CopyButton } from "./copy-button";
import { support } from "./promo-copy";
import styles from "./promo.module.css";
import type { SupportConfig } from "./support-config";

/**
 * The support hub, as a modal after the TAPSO site. It lists only what the
 * owner configured and never takes a payment: a visitor leaves for the
 * destination, or copies an account number to use in their own bank app.
 */
export function SupportAction({ config }: { config: SupportConfig }) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const [opened, setOpened] = useState(false);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (opened && !element.open) element.showModal();
    if (!opened && element.open) element.close();
  }, [opened]);

  return (
    <>
      <button type="button" className={styles.primary} onClick={() => setOpened(true)}>
        {config.open ? support.openButton : support.closedButton}
      </button>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={titleId}
        onClose={() => setOpened(false)}
        onClick={(event) => {
          if (event.target === dialog.current) setOpened(false);
        }}
      >
        <div className={styles.dialogBody}>
          <div className={styles.dialogHead}>
            <h3 id={titleId}>{support.dialogTitle}</h3>
            <button
              type="button"
              className={styles.dialogClose}
              onClick={() => setOpened(false)}
              aria-label={support.dialogClose}
            >
              <X aria-hidden="true" size={22} />
            </button>
          </div>

          {config.link ? (
            <div className={styles.supportAction}>
              <a className={styles.primary} href={config.link.url} rel="noopener noreferrer">
                {support.linkCta}
                <ExternalLink aria-hidden="true" size={18} />
              </a>
              <p className={styles.supportNote}>
                {support.linkNote} <strong className={styles.host}>{config.link.host}</strong>
              </p>
            </div>
          ) : null}

          {config.bank ? (
            <div className={styles.bank}>
              <h4>{support.bankTitle}</h4>
              <p className={styles.bankLine}>
                {config.bank.name} <span className={styles.account}>{config.bank.account}</span>
              </p>
              <p className={styles.supportNote}>예금주 {config.bank.holder}</p>
              <CopyButton value={config.bank.account} />
            </div>
          ) : null}

          {config.open ? null : <p className={styles.supportNote}>{support.closedBody}</p>}
          <p className={styles.fine}>{support.fine}</p>
        </div>
      </dialog>
    </>
  );
}
