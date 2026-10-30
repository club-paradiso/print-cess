/**
 * Where /promo sends a visitor who wants to support the project.
 *
 * Nothing here is a payment flow. Print-cess never takes card details, an
 * amount or a name; it only shows a destination the owner has configured.
 * With nothing configured the page says the window is not open yet, so it
 * never implies a route that does not exist. Values come from the server
 * environment at request time and hold no secret: a public link and, if the
 * owner chooses, a public bank account for transfers.
 */

export type SupportBank = { name: string; account: string; holder: string };

export type SupportConfig = {
  link: { url: string; host: string } | undefined;
  bank: SupportBank | undefined;
  open: boolean;
};

function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

/** Only a plain https address with no credentials, so the button cannot hide where it goes. */
export function parseSupportUrl(
  value: string | undefined,
): { url: string; host: string } | undefined {
  const text = clean(value);
  if (!text) return undefined;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname.includes(".")) {
      return undefined;
    }
    return { url: url.toString(), host: url.hostname };
  } catch {
    return undefined;
  }
}

export function supportConfig(environment: NodeJS.ProcessEnv = process.env): SupportConfig {
  const link = parseSupportUrl(environment.PRINT_CESS_SUPPORT_URL);
  const bank = {
    name: clean(environment.PRINT_CESS_SUPPORT_BANK_NAME),
    account: clean(environment.PRINT_CESS_SUPPORT_BANK_ACCOUNT),
    holder: clean(environment.PRINT_CESS_SUPPORT_BANK_HOLDER),
  };
  const bankReady =
    bank.name && bank.account && bank.holder && /^[0-9-]{6,32}$/u.test(bank.account);
  return {
    link,
    bank: bankReady ? bank : undefined,
    open: Boolean(link) || Boolean(bankReady),
  };
}
