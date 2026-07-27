import { describe, expect, it } from "vitest";

import { offerCatalogSchema, organizationSchema, webApplicationSchema } from "@/lib/seo/schema";

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

  it("describes the Starter offer as a monthly subscription without inventory status", () => {
    const offer = webApplicationSchema().offers as Record<string, unknown>;

    expect(offer.name).toBe("Drawgle Starter monthly subscription");
    expect(offer.price).toBe("9");
    expect(offer.priceCurrency).toBe("USD");
    expect(offer).not.toHaveProperty("availability");
    expect(offer).not.toHaveProperty("priceSpecification");
  });

  it("describes every pricing plan as a monthly subscription without inventory status", () => {
    const offers = offerCatalogSchema().itemListElement as Array<Record<string, unknown>>;

    expect(offers).toHaveLength(3);
    for (const offer of offers) {
      expect(offer.name).toMatch(/^Drawgle .+ monthly subscription$/);
      expect(offer).not.toHaveProperty("availability");
      expect(offer).not.toHaveProperty("priceSpecification");
    }
  });
});
