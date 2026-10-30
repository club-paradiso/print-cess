/**
 * Where /promo sends a visitor who wants to support the project, after the
 * TAPSO site's support hub.
 *
 * Nothing here is a payment flow. Print-cess never takes card details, an
 * amount or a name; it only shows destinations the owner configured. With
 * nothing configured the page says the window is not open yet, so it never
 * implies a route that does not exist. Values come from the server
 * environment at request time, hold no secret, and are public by design: a
 * support page link, a bank account for transfers, and a Toss send link to
 * that same account. The recipient is never written into source code.
 */

export type SupportBank = { name: string; account: string; holder: string };

export type SupportConfig = {
  link: { url: string; host: string } | undefined;
  bank: SupportBank | undefined;
  toss: string | undefined;
  open: boolean;
};

/** Trims, and drops one pair of wrapping quotes pasted along with a value. */
function clean(value: string | undefined): string {
  const text = (value ?? "").trim();
  const quoted = /^(["'])(.*)\1$/su.exec(text);
  return (quoted?.[2] ?? text).trim();
}

/** Names of support variables that hold something but were not accepted. Never values. */
export function rejectedSupportKeys(
  environment: NodeJS.ProcessEnv,
  config: SupportConfig,
): string[] {
  const set = (key: string) => clean(environment[key]).length > 0;
  const rejected: string[] = [];
  if (set("PRINT_CESS_SUPPORT_URL") && !config.link) rejected.push("PRINT_CESS_SUPPORT_URL");
  if (
    (set("PRINT_CESS_SUPPORT_BANK_NAME") || set("PRINT_CESS_SUPPORT_BANK_ACCOUNT")) &&
    !config.bank
  ) {
    rejected.push("PRINT_CESS_SUPPORT_BANK_NAME/ACCOUNT");
  }
  if (set("PRINT_CESS_SUPPORT_TOSS_SEND_URL") && !config.toss) {
    rejected.push("PRINT_CESS_SUPPORT_TOSS_SEND_URL");
  }
  return rejected;
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

/**
 * A Toss send deep link, accepted only when it names the same bank and account
 * the page shows and does not pre-fill an amount: supporters choose and
 * confirm the amount inside Toss. Same rule as the TAPSO site.
 */
export function parseTossSendUrl(
  value: string | undefined,
  bank: { name: string; account: string } | undefined,
): string | undefined {
  const text = clean(value);
  if (!text || !bank) return undefined;
  try {
    const url = new URL(text);
    if (
      url.protocol !== "supertoss:" ||
      url.hostname !== "send" ||
      url.pathname !== "" ||
      url.searchParams.get("bank") !== bank.name ||
      url.searchParams.get("accountNo") !== bank.account ||
      (url.searchParams.has("amount") && url.searchParams.get("amount") !== "0")
    ) {
      return undefined;
    }
    return text;
  } catch {
    return undefined;
  }
}

export function supportConfig(environment: NodeJS.ProcessEnv = process.env): SupportConfig {
  const link = parseSupportUrl(environment.PRINT_CESS_SUPPORT_URL);
  const name = clean(environment.PRINT_CESS_SUPPORT_BANK_NAME);
  const account = clean(environment.PRINT_CESS_SUPPORT_BANK_ACCOUNT);
  // The holder is optional, as on the TAPSO site: the bank app shows the
  // recipient's name before the visitor confirms a transfer.
  const holder = clean(environment.PRINT_CESS_SUPPORT_BANK_HOLDER);
  const bank = name && /^[0-9][0-9-]{5,31}$/u.test(account) ? { name, account, holder } : undefined;
  const toss = parseTossSendUrl(environment.PRINT_CESS_SUPPORT_TOSS_SEND_URL, bank);
  const config = { link, bank, toss, open: Boolean(link) || Boolean(bank) };
  const rejected = rejectedSupportKeys(environment, config);
  if (rejected.length > 0) {
    // An operator clue for a mistyped value. Names only: the values stay out of logs.
    console.warn(`promo.support.rejected ${rejected.join(",")}`);
  }
  return config;
}
