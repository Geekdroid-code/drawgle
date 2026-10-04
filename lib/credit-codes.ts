import { SCREEN_GENERATION_CREDIT_COST } from "@/lib/generation/pricing";

// Mirrors the credit_codes.code check constraint and redeem_credit_code's own test.
export const CREDIT_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{3,39}$/;

// No 0/O or 1/I/L, so a code read off a screenshot or typed by hand survives.
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export type CreditCodeStatus = "redeemed" | "already_redeemed" | "expired" | "exhausted" | "not_found";

export type CreditCodeResult = {
  status: CreditCodeStatus;
  credits?: number;
  balance?: number;
};

/** What a claim link shows before anyone presses the button. */
export type CreditCodePreview = {
  code: string;
  credits: number;
  status: "open" | Exclude<CreditCodeStatus, "redeemed">;
};

export const creditCodeHttpStatus: Record<CreditCodeStatus, number> = {
  redeemed: 200,
  already_redeemed: 409,
  expired: 410,
  exhausted: 410,
  not_found: 404,
};

const statuses = new Set<string>(Object.keys(creditCodeHttpStatus));

export function normalizeCreditCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return CREDIT_CODE_PATTERN.test(code) ? code : null;
}

export function readCreditCodeResult(value: unknown): CreditCodeResult | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.status !== "string" || !statuses.has(record.status)) return null;
  const result: CreditCodeResult = { status: record.status as CreditCodeStatus };
  if (record.credits != null && Number.isFinite(Number(record.credits))) result.credits = Number(record.credits);
  if (record.balance != null && Number.isFinite(Number(record.balance))) result.balance = Number(record.balance);
  return result;
}

export function screensForCredits(credits: number) {
  return Math.floor(credits / SCREEN_GENERATION_CREDIT_COST);
}

export function describeCreditCodeResult(result: CreditCodeResult): string {
  switch (result.status) {
    case "redeemed": {
      const credits = result.credits ?? 0;
      const screens = screensForCredits(credits);
      return screens > 0
        ? `${credits.toLocaleString()} credits added. That's enough for ${screens} screen${screens === 1 ? "" : "s"}.`
        : `${credits.toLocaleString()} credits added.`;
    }
    case "already_redeemed":
      return "This account has already claimed credits from this offer.";
    case "expired":
      return "This code has expired.";
    case "exhausted":
      return "This code has already been claimed.";
    case "not_found":
      return "That code doesn't exist. Check it and try again.";
  }
}

/** A random code such as DG-7K2M4P. Uses Web Crypto, so it runs in Node and in browsers. */
export function generateCreditCode(prefix = "DG", length = 6): string {
  const characters: string[] = [];
  // Bytes at or above the largest multiple of the alphabet size are skipped, so every
  // character is equally likely.
  const ceiling = 256 - (256 % CODE_ALPHABET.length);
  while (characters.length < length) {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(length * 2));
    for (const byte of bytes) {
      if (byte < ceiling && characters.length < length) characters.push(CODE_ALPHABET[byte % CODE_ALPHABET.length]);
    }
  }
  const body = characters.join("");
  const code = prefix ? `${prefix.toUpperCase()}-${body}` : body;
  if (!CREDIT_CODE_PATTERN.test(code)) throw new Error(`"${code}" is not a valid credit code.`);
  return code;
}
