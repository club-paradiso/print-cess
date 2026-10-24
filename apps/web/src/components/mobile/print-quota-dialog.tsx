"use client";

import { useCallback, useEffect, useId, useRef } from "react";
import { Printer, ShieldCheck } from "lucide-react";

import type { PrintQuotaDecision } from "@print-cess/protocol";
import { PrimaryButton, SecondaryButton } from "@print-cess/ui";

import type { Text } from "@/lib/use-visitor-locale";

export function PrintQuotaDialog({
  decision,
  text,
  onReselect,
  onCancel,
}: {
  decision: PrintQuotaDecision;
  text: Text;
  onReselect: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const bodyId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const hardLimit = decision.kind === "hardLimitExceeded";

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const handleReselect = useCallback(() => {
    for (const input of document.querySelectorAll<HTMLInputElement>('input[type="file"]')) {
      input.value = "";
    }
    onReselect();
  }, [onReselect]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCancel();
      }
    },
    [onCancel],
  );

  return (
    <div className="quota-overlay" onKeyDown={onKeyDown}>
      <div
        className={hardLimit ? "quota-dialog quota-dialog--hard" : "quota-dialog"}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        ref={dialogRef}
      >
        {hardLimit ? (
          <HardLimitPanel decision={decision} text={text} titleId={titleId} bodyId={bodyId} />
        ) : (
          <StaffApprovalPanel decision={decision} text={text} titleId={titleId} bodyId={bodyId} />
        )}

        <div className="quota-actions">
          <PrimaryButton type="button" onClick={handleReselect}>
            {text("quotaReselect")}
          </PrimaryButton>
          {hardLimit ? null : (
            <SecondaryButton type="button" onClick={onCancel}>
              {text("quotaCancel")}
            </SecondaryButton>
          )}
        </div>
      </div>
    </div>
  );
}

function QuotaSummary({
  decision,
  text,
  limitLabel,
  limitValue,
}: {
  decision: PrintQuotaDecision;
  text: Text;
  limitLabel: string;
  limitValue: string;
}) {
  return (
    <dl className="quota-summary">
      <div>
        <dt>{text("quotaSelectedLabel")}</dt>
        <dd className="quota-summary__count">
          {text("quotaPagesValue", { pages: decision.totalPages })}
        </dd>
      </div>
      <div>
        <dt>{limitLabel}</dt>
        <dd>{limitValue}</dd>
      </div>
    </dl>
  );
}

function HardLimitPanel({
  decision,
  text,
  titleId,
  bodyId,
}: {
  decision: PrintQuotaDecision;
  text: Text;
  titleId: string;
  bodyId: string;
}) {
  return (
    <div className="quota-hard">
      <span className="quota-hard__icon" aria-hidden="true">
        <Printer />
      </span>
      <h2 id={titleId}>{text("quotaHardTitle")}</h2>
      <div id={bodyId}>
        <QuotaSummary
          decision={decision}
          text={text}
          limitLabel={text("quotaHardMaxLabel")}
          limitValue={text("quotaPagesValue", { pages: decision.systemLimit })}
        />
      </div>
    </div>
  );
}

function StaffApprovalPanel({
  decision,
  text,
  titleId,
  bodyId,
}: {
  decision: PrintQuotaDecision;
  text: Text;
  titleId: string;
  bodyId: string;
}) {
  return (
    <div className="quota-over">
      <span className="quota-over__icon" aria-hidden="true">
        <ShieldCheck />
      </span>
      <h2 id={titleId}>{text("quotaOverBody")}</h2>
      <div id={bodyId}>
        <QuotaSummary
          decision={decision}
          text={text}
          limitLabel={text("quotaFreeLabel")}
          limitValue={text("quotaFreePagesValue", { pages: decision.publicLimit })}
        />
        <p className="quota-over__body">{text("quotaStaffBody")}</p>
      </div>
    </div>
  );
}
