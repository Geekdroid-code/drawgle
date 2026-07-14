import { describe, expect, it } from "vitest";

import {
  DRAWGLE_GENERATION_COMPLETE_SENTINEL,
  normalizeStaticDrawgleHtml,
  sanitizeScreenAssetUsage,
  sanitizeStaticDrawgleHtml,
  validateSourceCompletion,
  validateScreenAssetPolicy,
  validateStaticDrawgleHtml,
} from "@/lib/generation/screen-quality";
import type { ScreenAssetManifest } from "@/lib/types";

const repeatedProductManifest: ScreenAssetManifest = {
  id: "cookie-asset",
  requirementId: "cookie-grid",
  role: "product_cutout",
  url: "https://assets.example/cookie.webp",
  width: 1024,
  height: 1024,
  hasAlpha: false,
  alt: "Chocolate cookie",
  placementHint: "Use inside cookie cards",
  objectFit: "cover",
  objectPosition: "center",
  source: "stock",
  provider: "pexels",
  critical: true,
  visibility: "public_reusable",
  semanticCategory: "food",
  semanticTags: ["bakery", "cookie"],
  reusePolicy: "repeat",
  expectedUses: 8,
};

describe("generated source completion", () => {
  const complete = (html: string) => `${html}\n${DRAWGLE_GENERATION_COMPLETE_SENTINEL}`;

  it("accepts complete HTML with void and SVG elements", () => {
    const code = complete(`<div class="min-h-screen"><img src="photo.webp"><input type="text"><svg><path d="M0 0h1v1z" /></svg></div>`);

    expect(validateSourceCompletion({ code, requireSentinel: true, finishReasons: ["STOP"] })).toMatchObject({
      valid: true,
      codes: [],
    });
  });

  it("normalizes a stray closing tag instead of rejecting browser-valid output", () => {
    const code = complete(`<div class="min-h-screen"><section><p>Ready</p></section></div></div>`);
    const completion = validateSourceCompletion({ code, requireSentinel: true, finishReasons: ["STOP"] });
    const normalized = normalizeStaticDrawgleHtml(code.replace(DRAWGLE_GENERATION_COMPLETE_SENTINEL, ""));

    expect(completion.valid).toBe(true);
    expect(normalized.valid).toBe(true);
    expect(normalized.code).toBe(`<div class="min-h-screen"><section><p>Ready</p></section></div>`);
  });

  it("closes ordinary omitted tags deterministically", () => {
    const code = complete(`<div class="min-h-screen"><section><p>Ready</p>`);
    const completion = validateSourceCompletion({ code, requireSentinel: true, finishReasons: ["STOP"] });
    const normalized = normalizeStaticDrawgleHtml(code.replace(DRAWGLE_GENERATION_COMPLETE_SENTINEL, ""));

    expect(completion.valid).toBe(true);
    expect(normalized.valid).toBe(true);
    expect(normalized.code).toBe(`<div class="min-h-screen"><section><p>Ready</p></section></div>`);
  });

  it("blocks genuinely truncated tags, comments, and raw-text elements", () => {
    const unfinishedTag = validateSourceCompletion({
      code: complete(`<div class="min-h-screen"><section`),
      requireSentinel: true,
    });
    const unfinishedComment = validateSourceCompletion({
      code: complete(`<div class="min-h-screen"><!-- unfinished`),
      requireSentinel: true,
    });
    const unfinishedStyle = validateSourceCompletion({
      code: complete(`<div class="min-h-screen"><style>.card { color: red; }`),
      requireSentinel: true,
    });

    expect(unfinishedTag.codes).toContain("trailing_open_tag");
    expect(unfinishedComment.codes).toContain("unclosed_comment");
    expect(unfinishedStyle.codes).toContain("unterminated_raw_text");
  });
});

describe("sanitizeStaticDrawgleHtml", () => {
  it("removes script tags before hard validation", () => {
    const input = `<div class="min-h-screen"><h1>Safe</h1><script>alert("x")</script></div>`;

    const result = sanitizeStaticDrawgleHtml(input);

    expect(result.changed).toBe(true);
    expect(result.removedCodes).toContain("script_tag");
    expect(result.code).not.toContain("<script");
    expect(validateStaticDrawgleHtml({ code: result.code, requireSingleScreenRoot: true }).valid).toBe(true);
  });

  it("removes inline event handlers and javascript urls without dropping normal markup", () => {
    const input = `<div class="min-h-screen" onclick="bad()"><a href="javascript:alert(1)" class="text-sm">Open</a><button onmouseover='bad()'>Tap</button></div>`;

    const result = sanitizeStaticDrawgleHtml(input);

    expect(result.removedCodes).toEqual(expect.arrayContaining(["inline_event_handler", "javascript_url"]));
    expect(result.code).not.toMatch(/onclick|onmouseover|javascript:/i);
    expect(result.code).toContain(`class="text-sm"`);
    expect(validateStaticDrawgleHtml({ code: result.code, requireSingleScreenRoot: true }).valid).toBe(true);
  });

  it("preserves style blocks and static screen structure", () => {
    const input = `<div class="min-h-screen"><style>.card{color:var(--dg-color-text-high-emphasis)}</style><p>Copy</p></div>`;

    const result = sanitizeStaticDrawgleHtml(input);

    expect(result.changed).toBe(false);
    expect(result.code).toContain("<style>");
    expect(validateStaticDrawgleHtml({ code: result.code, requireSingleScreenRoot: true }).valid).toBe(true);
  });
});

describe("screen asset role enforcement", () => {
  it("preserves repeated compatible uses and reports a shortfall", () => {
    const image = `<img src="${repeatedProductManifest.url}" data-asset-requirement-id="cookie-grid" data-asset-role="product_cutout" alt="Cookie">`;
    const result = sanitizeScreenAssetUsage({ code: `<div>${image}${image}</div>`, assetManifest: [repeatedProductManifest] });
    expect(result.changed).toBe(false);
    const policy = validateScreenAssetPolicy({ code: result.code, assetManifest: [repeatedProductManifest] });
    expect(policy.valid).toBe(true);
    expect(policy.usesByRequirement["cookie-grid"]).toBe(2);
    expect(policy.warnings).toContain("Asset requirement cookie-grid expected 8 compatible uses but generated 2.");
  });

  it("sanitizes a product URL declared for an avatar slot", () => {
    const code = `<div class="profile-avatar"><img class="h-12 w-12 rounded-full" src="${repeatedProductManifest.url}" data-asset-requirement-id="cookie-grid" data-asset-role="avatar" alt="User avatar"></div>`;
    const result = sanitizeScreenAssetUsage({ code, assetManifest: [repeatedProductManifest] });
    expect(result.changed).toBe(true);
    expect(result.sanitizedMisuseCount).toBe(1);
    expect(result.code).not.toContain(`<img`);
    expect(result.code).toContain(`data-asset-sanitized="true"`);
  });

  it("sanitizes invented external bitmap URLs", () => {
    const result = sanitizeScreenAssetUsage({
      code: `<div><img src="https://random.example/headphones.png" data-asset-requirement-id="cookie-grid" data-asset-role="product_cutout"></div>`,
      assetManifest: [repeatedProductManifest],
    });
    expect(result.changed).toBe(true);
    expect(result.invalidUrls).toEqual(["https://random.example/headphones.png"]);
    expect(result.code).not.toContain("random.example");
  });

  it("sanitizes approved URLs that omit required metadata", () => {
    const result = sanitizeScreenAssetUsage({
      code: `<img src="${repeatedProductManifest.url}" alt="Cookie">`,
      assetManifest: [repeatedProductManifest],
    });
    expect(result.changed).toBe(true);
    expect(result.missingMetadata).toEqual([repeatedProductManifest.url]);
  });

  it("allows only metadata-bound background roles", () => {
    const background = { ...repeatedProductManifest, role: "background_photo" as const, requirementId: "bakery-background" };
    const valid = sanitizeScreenAssetUsage({
      code: `<div data-asset-requirement-id="bakery-background" data-asset-role="background_photo" style="background-image:url('${background.url}')"></div>`,
      assetManifest: [background],
    });
    expect(valid.changed).toBe(false);

    const invalid = sanitizeScreenAssetUsage({
      code: `<style>.hero{background-image:url('${background.url}')}</style><div class="hero"></div>`,
      assetManifest: [background],
    });
    expect(invalid.changed).toBe(true);
    expect(invalid.code).not.toContain(background.url);
  });

  it("does not reuse one distinct portrait URL for two identities", () => {
    const portrait = {
      ...repeatedProductManifest,
      id: "portrait-one",
      requirementId: "team-portraits",
      role: "avatar" as const,
      semanticCategory: "person" as const,
      reusePolicy: "distinct" as const,
      expectedUses: 1,
    };
    const image = `<img src="${portrait.url}" data-asset-requirement-id="team-portraits" data-asset-role="avatar">`;
    const result = sanitizeScreenAssetUsage({ code: `<div>${image}${image}</div>`, assetManifest: [portrait] });
    expect(result.changed).toBe(true);
    expect(result.sanitizedMisuseCount).toBe(1);
    expect((result.code.match(/<img/g) ?? []).length).toBe(1);
  });
});
