// Creates and lists credit codes. Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
// from .env.local, so it writes to whichever database that file points at.
//
//   pnpm credits:codes create --campaign launch --count 50 --credits 200
//   pnpm credits:codes create --campaign friends --code FRIENDS --uses 25 --credits 100
//   pnpm credits:codes list --campaign launch            every code and who claimed it
//   pnpm credits:codes list --campaign launch --open     only links nobody has claimed yet
import { parseArgs } from "node:util";

import { createClient } from "@supabase/supabase-js";

import { generateCreditCode, normalizeCreditCode } from "../../lib/credit-codes";
import { siteConfig } from "../../lib/seo/config";

const CAMPAIGN_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    campaign: { type: "string" },
    count: { type: "string", default: "1" },
    credits: { type: "string" },
    uses: { type: "string", default: "1" },
    prefix: { type: "string", default: "DG" },
    code: { type: "string" },
    expires: { type: "string" },
    note: { type: "string" },
    open: { type: "boolean", default: false },
  },
});

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const command = positionals[0];
if (command !== "create" && command !== "list") {
  fail("Usage: pnpm credits:codes <create|list> --campaign <name> [options]. See the top of scripts/credits/credit-codes.ts.");
}

const campaign = values.campaign?.trim().toLowerCase() ?? "";
if (!CAMPAIGN_PATTERN.test(campaign)) fail("--campaign is required: lowercase letters, digits and dashes, e.g. launch.");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (pnpm credits:codes reads .env.local).");

const admin = createClient(url!, serviceKey!, { auth: { autoRefreshToken: false, persistSession: false } });
const claimLink = (code: string) => `${siteConfig.baseUrl}/claim/${code}`;

const wholeNumber = (raw: string, name: string, min: number, max: number) => {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) fail(`--${name} must be a whole number from ${min} to ${max}.`);
  return value;
};

async function create() {
  const credits = wholeNumber(values.credits ?? "", "credits", 1, 10000);
  const uses = wholeNumber(values.uses, "uses", 1, 100000);
  const count = wholeNumber(values.count, "count", 1, 500);

  let expiresAt: string | null = null;
  if (values.expires) {
    const expires = new Date(values.expires);
    if (Number.isNaN(expires.getTime()) || expires.getTime() <= Date.now()) fail("--expires must be a future date, e.g. 2026-10-31.");
    expiresAt = expires.toISOString();
  }

  let codes: string[];
  if (values.code) {
    if (count !== 1) fail("--code names one code; leave out --count.");
    const named = normalizeCreditCode(values.code);
    if (!named) fail("--code must be 4 to 40 letters, digits or dashes, e.g. FRIENDS.");
    codes = [named!];
  } else {
    const unique = new Set<string>();
    while (unique.size < count) unique.add(generateCreditCode(values.prefix));
    codes = [...unique];
  }

  const rows = codes.map((code) => ({
    code,
    campaign,
    credits,
    max_redemptions: uses,
    expires_at: expiresAt,
    note: values.note ?? null,
  }));
  const { error } = await admin.from("credit_codes").insert(rows);
  if (error) fail(`Could not create codes: ${error.message}`);

  const total = credits * uses * codes.length;
  console.log(`Created ${codes.length} code${codes.length === 1 ? "" : "s"} in "${campaign}": ${credits} credits, ${uses} use${uses === 1 ? "" : "s"} each, ${total.toLocaleString()} credits at most.`);
  if (expiresAt) console.log(`They expire ${expiresAt}.`);
  console.log("");
  for (const code of codes) console.log(claimLink(code));
}

async function list() {
  const { data: codes, error } = await admin
    .from("credit_codes")
    .select("code, credits, max_redemptions, redemption_count, expires_at, disabled_at")
    .eq("campaign", campaign)
    .order("created_at")
    .order("code");
  if (error) fail(`Could not read codes: ${error.message}`);

  const { data: redemptions, error: redemptionError } = await admin
    .from("credit_code_redemptions")
    .select("code, credits, created_at")
    .eq("campaign", campaign)
    .order("created_at");
  if (redemptionError) fail(`Could not read redemptions: ${redemptionError.message}`);

  const rows = codes ?? [];
  if (rows.length === 0) {
    console.log(`No codes in "${campaign}".`);
    return;
  }

  const claimedAt = new Map<string, string[]>();
  for (const redemption of redemptions ?? []) {
    claimedAt.set(redemption.code, [...(claimedAt.get(redemption.code) ?? []), redemption.created_at]);
  }

  const now = Date.now();
  const isOpen = (row: (typeof rows)[number]) =>
    !row.disabled_at &&
    row.redemption_count < row.max_redemptions &&
    (!row.expires_at || new Date(row.expires_at).getTime() > now);

  for (const row of rows) {
    if (values.open) {
      if (isOpen(row)) console.log(claimLink(row.code));
      continue;
    }
    const state = row.disabled_at
      ? "disabled"
      : row.expires_at && new Date(row.expires_at).getTime() <= now
        ? "expired"
        : `${row.redemption_count}/${row.max_redemptions}`;
    const last = claimedAt.get(row.code)?.at(-1);
    console.log(
      [row.code.padEnd(14), state.padEnd(9), (last ? `last claimed ${last.slice(0, 16).replace("T", " ")} UTC` : "").padEnd(34), claimLink(row.code)].join("  "),
    );
  }

  const people = redemptions?.length ?? 0;
  const granted = (redemptions ?? []).reduce((sum, redemption) => sum + Number(redemption.credits), 0);
  const capacity = rows.reduce((sum, row) => sum + row.max_redemptions, 0);
  const open = rows.filter(isOpen).length;
  console.log("");
  console.log(`${people} of ${capacity} claimed, ${granted.toLocaleString()} credits granted. ${open} code${open === 1 ? "" : "s"} still open.`);
}

// The package is CommonJS, so no top-level await.
(command === "create" ? create() : list()).catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
