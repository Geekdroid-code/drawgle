// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// Everything under app/dev is a test fixture. Next serves it to the open internet unless the page
// refuses to render in production, so each one must say so itself.
const devRoot = path.join(process.cwd(), "app", "dev");
const pages = readdirSync(devRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(devRoot, entry.name, "page.tsx"))
  .filter((file) => existsSync(file));

describe("dev fixture pages", () => {
  it("finds the fixtures it is meant to guard", () => {
    expect(pages.length).toBeGreaterThanOrEqual(4);
  });

  it.each(pages.map((file) => [path.basename(path.dirname(file)), file]))(
    "%s returns 404 in production",
    (_name, file) => {
      const source = readFileSync(file, "utf8");
      expect(source).toMatch(/process\.env\.NODE_ENV\s*===\s*["']production["']/);
      expect(source).toMatch(/notFound\(\)/);
    },
  );
});
