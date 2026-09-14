import { applyProductPatch, createProductPlanning, type ProductPlanning } from "./model";
import { functionalItemSchema } from "./functional-plan";
const messageId = "11111111-1111-4111-8111-111111111111";
export function productFixture(): ProductPlanning {
  const state = createProductPlanning({ imagePath: null, imageReferenceMode: "style", stylePresetSlug: null });
  // Legacy fixture exercises compatibility; v2-specific tests opt into its gates.
  delete state.designerVersion;
  return applyProductPatch(state, { operations: [
    ...[
      ["identity", "tacozz", "Tacozz", "Sell T-shirts"],
      ["actors", "shoppers", "Shoppers", "Customers shopping for T-shirts"],
      ["jobs", "buy", "Buy", "Find and purchase a T-shirt"],
      ["journeys", "purchase", "Purchase journey", "Shop → Product → Cart → Checkout"],
      ["surfaces", "onboarding", "Onboarding", "Introduce the brand"],
      ["surfaces", "shop", "Shop", "Browse products"],
      ["surfaces", "cart", "Cart", "Review selected items"],
      ["surfaces", "orders", "Orders", "Track purchases"],
      ["capabilities", "purchase-capability", "Purchase", "Select sizes and place an order"],
      ["preferences", "minimal", "Minimal", "Sophisticated and minimal"],
    ].map(([section, id, label, detail]) => ({ op: "put_fact", fact: { section, id, label, detail, source: "assumption", evidence: "", links: [] } })),
    { op: "set_scope", goal: "Design onboarding first", surfaceIds: ["onboarding"], rationale: "Introduce the brand before shopping" },
  ] }, messageId);
}

export const experienceFixture = () => ({ referencePath: "owner/prompt-images/reference.webp", referenceId: null,
  referenceHash: "hash", observations: "Large product imagery with generous gutters", direction: "Product-led restrained shopping",
  informationHierarchy: "Product then price then action", navigation: "Keep shopping destinations distinct", adaptations: "Use product data rather than editorial filler" });
export const functionalFixture = (key = "screen:onboarding", name = "Welcome", sequence = 0) => functionalItemSchema.parse({
  stableKey: key, kind: "screen", name, description: "Introduce the brand and start shopping", surfaceIds: ["onboarding"], journeyIds: ["purchase"],
  information: "Brand identity and start-shopping action", entryCondition: "First launch", outcome: "Enter the shop", actions: [{ label: "Shop", destinationKey: null, outcome: "Shop is outside this onboarding-only scope" }], sequence,
});
export function designerFixture(): ProductPlanning {
  const state = productFixture();
  return { ...state, designerVersion: 2, experience: experienceFixture(), input: { ...state.input, imagePath: experienceFixture().referencePath },
    evidenceAssessment: { turnId: "test", mode: "product", productReady: true, experienceReady: true, gaps: [], delegation: "", rationale: "Detailed brief" },
    scope: { ...state.scope!, outputKeys: ["screen:onboarding"], manifest: [functionalFixture()] } };
}
