import { applyProductPatch, createProductPlanning, type ProductPlanning } from "./model";
const messageId = "11111111-1111-4111-8111-111111111111";
export function productFixture(): ProductPlanning {
  const state = createProductPlanning({ imagePath: null, imageReferenceMode: "style", stylePresetSlug: null });
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
