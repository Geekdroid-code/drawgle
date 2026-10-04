"use client";

import { useEffect, useState } from "react";

import { ClaimCreditsCard } from "@/components/credits/ClaimCreditsCard";
import type { CreditCodePreview, CreditCodeStatus } from "@/lib/credit-codes";

/**
 * Dev only (/dev/claim-preview): every state of the claim page, so it can be checked without
 * signing in. Redemption requests are answered in the page; nothing reaches the database.
 * Typed codes: DG-7K2M4P redeems, DG-USEDUP is claimed, anything else is unknown.
 */

const USER_ID = "claim-fixture";

const answers: Record<string, { status: CreditCodeStatus; credits?: number; balance?: number }> = {
  "DG-7K2M4P": { status: "redeemed", credits: 200, balance: 200 },
  "DG-USEDUP": { status: "exhausted" },
};

const links: Array<{ label: string; preview: CreditCodePreview | null }> = [
  { label: "Claim link", preview: { code: "DG-7K2M4P", credits: 200, status: "open" } },
  { label: "Typed code", preview: null },
  { label: "Already claimed", preview: { code: "DG-AB23CD", credits: 200, status: "already_redeemed" } },
  { label: "Used up", preview: { code: "DG-USEDUP", credits: 200, status: "exhausted" } },
  { label: "Expired", preview: { code: "DG-OLD234", credits: 200, status: "expired" } },
  { label: "Unknown", preview: { code: "DG-NOPE99", credits: 0, status: "not_found" } },
];

export function ClaimPreviewFixture() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const realFetch = window.fetch;
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!url.endsWith("/api/credits/redeem")) return realFetch(input, init);
      await new Promise((resolve) => setTimeout(resolve, 600));
      const { code } = JSON.parse(String(init?.body ?? "{}")) as { code?: string };
      const answer = answers[code ?? ""] ?? { status: "not_found" as const };
      return new Response(JSON.stringify(answer), {
        status: answer.status === "redeemed" ? 200 : answer.status === "not_found" ? 404 : 410,
        headers: { "Content-Type": "application/json" },
      });
    };
    // The cards render only once redemption requests are answered here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
    return () => {
      window.fetch = realFetch;
    };
  }, []);

  if (!ready) return null;

  return (
    <div className="min-h-svh bg-[var(--dg-bg)] text-[var(--dg-text)]">
      <div className="mx-auto grid max-w-6xl gap-x-6 gap-y-2 px-4 py-8 md:grid-cols-2 xl:grid-cols-3">
        {links.map(({ label, preview }) => (
          <div key={label} data-fixture={label}>
            <p className="px-4 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
            <div className="[&>main]:min-h-0 [&>main]:pt-3 [&>main]:sm:pt-3">
              <ClaimCreditsCard userId={USER_ID} preview={preview} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
