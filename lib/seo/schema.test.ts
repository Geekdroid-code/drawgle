import { describe, expect, it } from "vitest";

import { organizationSchema, webApplicationSchema } from "@/lib/seo/schema";

describe("Drawgle SEO schema", () => {
  it("describes the verified web application and public export surface", () => {
    const schema = webApplicationSchema();

    expect(schema["@type"]).toBe("WebApplication");
    expect(schema.applicationCategory).toBe("DesignApplication");
    expect(schema.applicationSubCategory).toBe("AI mobile app UI designer");
    expect(schema.operatingSystem).toBe("Cloud/Web");
    expect(schema.author).toEqual({ "@id": "https://drawgle.com/#organization" });

    const featureList = schema.featureList as string[];
    expect(featureList).toContain("Screenshot-to-editable-UI reconstruction");
    expect(featureList).toContain("Standalone Tailwind HTML export");
    expect(featureList.some((feature) => /React Native|Flutter|SwiftUI|Figma/i.test(feature))).toBe(false);
  });

  it("uses sameAs for Drawgle identity and about for related topics", () => {
    const organization = organizationSchema();
    const topics = webApplicationSchema().about as Array<Record<string, unknown>>;

    expect(organization.sameAs).toEqual(["https://x.com/9to5_Dad"]);
    expect(topics.map((topic) => topic.sameAs)).toContain("https://www.wikidata.org/wiki/Q11660");
  });
});
