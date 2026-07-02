import type { ScreenStateVariantPlan } from "@/lib/types";

const escapeHtml = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const buildStateVariantErrorCode = (message: string) => `<div class="min-h-screen w-full flex flex-col items-center justify-center gap-3 bg-red-50 text-red-700 px-6 text-center">
  <div class="text-lg font-semibold">State variant failed</div>
  <div class="text-sm leading-6">${escapeHtml(message)}</div>
</div>`;

export const stateVariantScreenName = (parentName: string, stateLabel: string) => {
  const baseName = parentName.trim() || "Screen";
  const label = stateLabel.trim() || "State";
  const name = `${baseName} / ${label}`;
  return name.length > 100 ? `${name.slice(0, 97).trimEnd()}...` : name;
};

export const buildStateVariantEditActivityKey = (generationRunId: string, variantId: string) =>
  `edit:${generationRunId}:${variantId}`;

export const buildStateVariantEditInstruction = (parentName: string, variant: ScreenStateVariantPlan) => [
  `Create the "${variant.stateLabel}" local state for the existing "${parentName}" screen.`,
  variant.editInstruction,
  "Preserve the parent screen shell, header, shared navigation behavior, typography, spacing, colors, token classes, radius/shadow language, and overall composition.",
  "Change only the active local state, selected tab/filter/control, modal/empty/loading/error/selected-item state, and the content directly associated with that state.",
  "Do not create a route, detail page, CTA destination, new bottom-nav item, or unrelated screen. This is a same-screen state variant only.",
  "Return edits against the current saved HTML source.",
].join("\n");

export const buildStateVariantFailurePatch = (message: string) => ({
  status: "failed" as const,
  error: message,
  code: buildStateVariantErrorCode(message),
});
