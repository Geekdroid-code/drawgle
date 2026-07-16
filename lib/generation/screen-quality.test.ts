import { describe, expect, it } from "vitest";

import {
  DRAWGLE_GENERATION_COMPLETE_SENTINEL,
  hydrateScreenAssetSlots,
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
    const manifest = { ...repeatedProductManifest, critical: false };
    const result = sanitizeScreenAssetUsage({ code: `<div>${image}${image}</div>`, assetManifest: [manifest] });
    expect(result.sanitizedMisuseCount).toBe(0);
    expect(result.repairedMetadataCount).toBe(2);
    const policy = validateScreenAssetPolicy({ code: result.code, assetManifest: [manifest] });
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

  it("repairs approved URLs that omit required metadata", () => {
    const result = sanitizeScreenAssetUsage({
      code: `<img src="${repeatedProductManifest.url}" alt="Cookie">`,
      assetManifest: [repeatedProductManifest],
    });
    expect(result.changed).toBe(true);
    expect(result.repairedMetadataCount).toBe(1);
    expect(result.sanitizedMisuseCount).toBe(0);
    expect(result.code).toContain(`data-asset-requirement-id="cookie-grid"`);
    expect(result.code).toContain(`data-asset-role="product_cutout"`);
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

describe("screen asset slot hydration", () => {
  it("preserves the audited skincare hero and product assets through hydration and sanitization", () => {
    const hero: ScreenAssetManifest = {
      ...repeatedProductManifest,
      id: "hero-r2",
      requirementId: "hero-skincare-editorial",
      role: "background_photo",
      url: "https://r2.example/visual-assets/hero/asset.webp",
      alt: "Editorial skincare bottle",
      expectedUses: 1,
    };
    const products: ScreenAssetManifest = {
      ...repeatedProductManifest,
      id: "products-r2",
      requirementId: "product-shelf-items",
      role: "product_photo",
      url: "https://r2.example/visual-assets/products/asset.webp",
      alt: "Luxury skincare products",
      expectedUses: 4,
    };
    const heroHydration = hydrateScreenAssetSlots({
      code: `<div data-asset-slot="true" data-asset-requirement-id="hero-skincare-editorial" data-asset-role="background_photo"></div>`,
      assetManifest: [hero],
    });
    const productHydration = hydrateScreenAssetSlots({
      code: `<main>${Array.from({ length: 4 }, () =>
        `<div data-asset-slot="true" data-asset-requirement-id="product-shelf-items" data-asset-role="product_photo"></div>`).join("")}</main>`,
      assetManifest: [products],
    });
    const sanitizedHero = sanitizeScreenAssetUsage({
      code: heroHydration.code,
      assetManifest: [hero],
    });
    const sanitizedProducts = sanitizeScreenAssetUsage({
      code: productHydration.code,
      assetManifest: [products],
    });

    expect(sanitizedHero.code).toContain(hero.url);
    expect(sanitizedProducts.code.match(new RegExp(products.url!.replaceAll(".", "\\."), "g")))
      .toHaveLength(4);
    expect(`${sanitizedHero.code}${sanitizedProducts.code}`).not.toContain("data-asset-sanitized");
    expect(sanitizedHero.sanitizedMisuseCount + sanitizedProducts.sanitizedMisuseCount).toBe(0);
  });

  it("hydrates repeat slots deterministically with the approved URL", () => {
    const code = `<section>
      <div data-asset-slot="true" data-asset-requirement-id="cookie-grid" data-asset-role="product_cutout"></div>
      <div data-asset-slot="true" data-asset-requirement-id="cookie-grid" data-asset-role="product_cutout"></div>
    </section>`;
    const hydrated = hydrateScreenAssetSlots({
      code,
      assetManifest: [{ ...repeatedProductManifest, expectedUses: 2 }],
    });

    expect(hydrated.hydratedAssetCount).toBe(2);
    expect(hydrated.placeholderUseCount).toBe(0);
    expect((hydrated.code.match(/<img/g) ?? []).length).toBe(2);
    expect((hydrated.code.match(/https:\/\/assets\.example\/cookie\.webp/g) ?? []).length).toBe(2);
    expect(hydrated.missingCriticalSlotIds).toEqual([]);
    expect(validateScreenAssetPolicy({
      code: hydrated.code,
      assetManifest: [{ ...repeatedProductManifest, expectedUses: 2 }],
    }).valid).toBe(true);
  });

  it("repairs an img-shaped slot instead of producing invalid nested markup", () => {
    const hydrated = hydrateScreenAssetSlots({
      code: `<img class="aspect-square" data-asset-slot="true" data-asset-requirement-id="cookie-grid" data-asset-role="product_cutout">`,
      assetManifest: [repeatedProductManifest],
    });

    expect((hydrated.code.match(/<img/g) ?? []).length).toBe(1);
    expect(hydrated.code).toContain(repeatedProductManifest.url);
    expect(hydrated.code).not.toContain("data-asset-slot=");
    expect(hydrated.code).toContain(`data-asset-hydrated="true"`);
  });

  it("binds distinct slot indexes to different resolved identities", () => {
    const first = {
      ...repeatedProductManifest,
      id: "product-one",
      requirementId: "product-grid",
      reusePolicy: "distinct" as const,
      expectedUses: 1,
      slotIndex: 0,
      url: "https://assets.example/product-one.webp",
    };
    const second = {
      ...first,
      id: "product-two",
      slotIndex: 1,
      url: "https://assets.example/product-two.webp",
    };
    const hydrated = hydrateScreenAssetSlots({
      code: `<div>
        <div data-asset-slot="true" data-asset-requirement-id="product-grid" data-asset-role="product_cutout" data-asset-slot-index="0"></div>
        <div data-asset-slot="true" data-asset-requirement-id="product-grid" data-asset-role="product_cutout" data-asset-slot-index="1"></div>
      </div>`,
      assetManifest: [first, second],
    });

    expect(hydrated.code).toContain(first.url);
    expect(hydrated.code).toContain(second.url);
    expect(hydrated.hydratedAssetCount).toBe(2);
  });

  it("keeps an attributed placeholder when resolution failed", () => {
    const placeholder = {
      ...repeatedProductManifest,
      id: "placeholder:cookie-grid",
      url: null,
      provider: "placeholder" as const,
      source: "placeholder" as const,
      placeholder: true,
      expectedUses: 1,
    };
    const hydrated = hydrateScreenAssetSlots({
      code: `<div data-asset-slot="true" data-asset-requirement-id="cookie-grid" data-asset-role="product_cutout"></div>`,
      assetManifest: [placeholder],
    });

    expect(hydrated.placeholderUseCount).toBe(1);
    expect(hydrated.code).toContain(`data-asset-placeholder="true"`);
    expect(hydrated.code).not.toContain("<img");
    expect(validateScreenAssetPolicy({ code: hydrated.code, assetManifest: [placeholder] }).valid)
      .toBe(true);
  });

  it("blocks a critical requirement when the builder omits its slot", () => {
    const policy = validateScreenAssetPolicy({
      code: `<div class="min-h-screen">No media slot</div>`,
      assetManifest: [repeatedProductManifest],
    });

    expect(policy.valid).toBe(false);
    expect(policy.missingCriticalSlotIds).toEqual(["cookie-grid"]);
  });

  it("does not double-count hydrated images when critical repeat slots are missing", () => {
    const manifest = { ...repeatedProductManifest, expectedUses: 2 };
    const hydrated = hydrateScreenAssetSlots({
      code: `<div data-asset-slot="true" data-asset-requirement-id="cookie-grid" data-asset-role="product_cutout"></div>`,
      assetManifest: [manifest],
    });

    expect(hydrated.hydratedAssetCount).toBe(1);
    expect(hydrated.missingCriticalSlotIds).toEqual(["cookie-grid"]);
    expect(validateScreenAssetPolicy({ code: hydrated.code, assetManifest: [manifest] }).valid)
      .toBe(false);
  });
});
