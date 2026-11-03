"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";

import { PrimaryButton, TertiaryButton } from "@print-cess/ui";

import type { PdfPasswordRequest } from "@/lib/unlock-pdf";
import type { Text } from "@/lib/use-visitor-locale";

/**
 * Asks for a locked PDF's password. The value lives only in this component's
 * state and is handed straight to the on-phone unlocker; it is never stored,
 * logged or sent. The field is cleared after every attempt.
 */
export function PdfPasswordStep({
  request,
  busy,
  text,
  onSubmit,
  onCancel,
}: {
  request: PdfPasswordRequest;
  busy: boolean;
  text: Text;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // The field is emptied on submit, so each new request starts blank.
  useEffect(() => {
    if (!busy) input.current?.focus();
  }, [request, busy]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy || password.length === 0) return;
    const value = password;
    setPassword("");
    onSubmit(value);
  };

  if (busy) {
    return (
      <section className="mobile-step" aria-busy="true">
        <div className="mobile-spinner" />
        <p role="status">{text("pdfUnlocking")}</p>
      </section>
    );
  }

  return (
    <section className="mobile-step mobile-pdf-password">
      <h1>
        <LockKeyhole aria-hidden="true" /> {text("pdfPasswordTitle")}
      </h1>
      <p>{text("pdfPasswordHelp", { name: request.fileName })}</p>
      {request.errorKey ? (
        <p className="mobile-file-error" role="alert">
          {text(request.errorKey)}
        </p>
      ) : null}
      <form className="mobile-pdf-password__form" onSubmit={submit}>
        <label htmlFor="pdf-password">{text("pdfPasswordLabel")}</label>
        <div className="mobile-pdf-password__field">
          <input
            ref={input}
            id="pdf-password"
            data-testid="pdf-password-input"
            type={visible ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={128}
            enterKeyHint="done"
          />
          <button
            type="button"
            className="mobile-pdf-password__toggle"
            aria-pressed={visible}
            aria-label={text("pdfPasswordShow")}
            onClick={() => setVisible((current) => !current)}
          >
            {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </button>
        </div>
        <p className="mobile-pdf-password__attempts">
          {text("pdfPasswordAttemptsLeft", { count: request.attemptsLeft })}
        </p>
        <div className="mobile-actions">
          <PrimaryButton type="submit" disabled={password.length === 0}>
            {text("pdfPasswordSubmit")}
          </PrimaryButton>
          <TertiaryButton type="button" onClick={onCancel}>
            {text("chooseAnother")}
          </TertiaryButton>
        </div>
      </form>
    </section>
  );
}
