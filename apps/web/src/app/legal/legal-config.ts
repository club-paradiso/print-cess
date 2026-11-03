/**
 * Who answers privacy questions for the Print-cess service that Club Paradiso
 * runs. 개인정보 보호법 제30조제1항제6호 requires the privacy policy to name
 * the privacy officer (or the responsible department) and a way to reach them.
 *
 * The values are public by design and come from the server environment, so a
 * personal address is never written into source code. Without an email the
 * policy still names the role and sends people to the feedback form and the
 * repository, and says plainly that a direct address is not published yet.
 */

export const LEGAL_EFFECTIVE_DATE = "2026-11-03";

export type PrivacyContact = {
  officer: string;
  email: string | undefined;
};

const DEFAULT_OFFICER = "Club Paradiso 운영 책임자";

function clean(value: string | undefined): string {
  const text = (value ?? "").trim();
  const quoted = /^(["'])(.*)\1$/su.exec(text);
  return (quoted?.[2] ?? text).trim();
}

/** A plain address only: no display name, no spaces, no extra headers. */
export function parseContactEmail(value: string | undefined): string | undefined {
  const text = clean(value);
  if (!text || text.length > 254) return undefined;
  return /^[^\s@<>"',;:()[\]\\]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/iu.test(text) ? text : undefined;
}

export function privacyContact(environment: NodeJS.ProcessEnv = process.env): PrivacyContact {
  const officer = clean(environment.PRINT_CESS_PRIVACY_OFFICER).slice(0, 80);
  return {
    officer: officer || DEFAULT_OFFICER,
    email: parseContactEmail(environment.PRINT_CESS_PRIVACY_CONTACT_EMAIL),
  };
}
