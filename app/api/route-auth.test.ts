// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// Next serves every folder under app/api to the open internet, and proxy.ts only guards page paths.
// A route that forgets to authenticate is a free model endpoint for anyone, so each one must
// prove who is calling or, for the few that are not user-facing, say how it is trusted instead.
const apiRoot = path.join(process.cwd(), "app", "api");

const routeFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return routeFiles(full);
    return name === "route.ts" ? [full] : [];
  });

const userAuth = [/auth\.getUser\(/, /auth\.getClaims\(/, /requireAdminUser\(/, /getAuthenticatedUser\(/];
const otherTrust: Record<string, RegExp> = {
  "dodopayments/webhook/route.ts": /webhook-signature/,
  "admin/curated-visual-assets/route.ts": /authorization/,
};

describe("API route authentication", () => {
  const files = routeFiles(apiRoot);

  it("finds the routes it is meant to guard", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files.map((file) => [path.relative(apiRoot, file).split(path.sep).join("/"), file]))(
    "%s checks who is calling",
    (relative, file) => {
      const source = readFileSync(file, "utf8");
      const trusted = otherTrust[relative as string];
      const proves = trusted ? trusted.test(source) : userAuth.some((pattern) => pattern.test(source));
      expect(proves, `${relative} serves requests without checking who is calling`).toBe(true);
    },
  );

  it("does not expose a route that lets a browser spend or change its own credits", () => {
    const relatives = files.map((file) => path.relative(apiRoot, file).split(path.sep).join("/"));
    expect(relatives).not.toContain("deduct-credits/route.ts");
  });
});
