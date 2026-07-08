import { describe, expect, it } from "vitest";

import {
  sanitizeStaticDrawgleHtml,
  validateStaticDrawgleHtml,
} from "@/lib/generation/screen-quality";

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
