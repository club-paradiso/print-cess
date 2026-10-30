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
export function SupportAction({
  config,
  tossQr,
}: {
  config: SupportConfig;
  /** A data: URL drawn on the server from the configured Toss link. */
  tossQr?: string | undefined;
}) {
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
            <section className={styles.bank} aria-labelledby={`${titleId}-bank`}>
              <h4 id={`${titleId}-bank`}>{support.bankTitle(config.bank.name)}</h4>
              <p className={styles.supportNote}>{support.bankCheck}</p>
              {config.toss ? (
                <>
                  <a className={styles.toss} href={config.toss}>
                    {support.tossCta}
                  </a>
                  <p className={styles.supportNote}>{support.tossNote}</p>
                  {tossQr ? (
                    <div className={styles.tossQr}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL drawn on the server */}
                      <img src={tossQr} alt={support.tossQrAlt} width={132} height={132} />
                      <div>
                        <strong>{support.tossQrTitle}</strong>
                        <p className={styles.supportNote}>{support.tossQrBody}</p>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
              <dl className={styles.bankDetails}>
                <div>
                  <dt>{support.bankName}</dt>
                  <dd>{config.bank.name}</dd>
                </div>
                <div>
                  <dt>{support.bankAccount}</dt>
                  <dd className={styles.account}>{config.bank.account}</dd>
                </div>
                {config.bank.holder ? (
                  <div>
                    <dt>{support.bankHolder}</dt>
                    <dd>{config.bank.holder}</dd>
                  </div>
                ) : null}
              </dl>
              <CopyButton value={config.bank.account} />
            </section>
          ) : null}

          {config.open ? null : <p className={styles.supportNote}>{support.closedBody}</p>}
          <p className={styles.fine}>{support.fine}</p>
        </div>
      </dialog>
    </>
  );
}
