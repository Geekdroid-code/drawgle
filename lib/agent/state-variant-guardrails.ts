import type { ScreenStateVariantPlan } from "@/lib/types";

const meaningfulStatePattern =
  /\b(tab|tabs|segmented|segment|filter|filters|search results|sort|modal|dialog|sheet|drawer|popover|popup|overlay|empty|loading|error|selected|selection|detail panel|expanded|collapsed|accordion|form|compose|create|add|new|upload|results|table|list|cards|chart|analytics|calendar|kanban|step|wizard)\b/i;

const weakControlPattern =
  /\b(theme|dark|light|system|appearance|display setting|display settings|compact|density|dense|comfortable|color|colour|palette|accent|font size|spacing|radius|rounded|shadow|animation|motion|hover|focus|pressed|toggle switch|switch button)\b/i;

const paidVariantPattern =
  /\b(open|show|display|reveal|activate|select|expanded|collapsed|filtered|sorted|results|content|body|panel|modal|dialog|sheet|drawer|popover|form|create|add|upload|empty|loading|error|table|list|cards|chart|analytics)\b/i;

const strongContentSurfacePattern =
  /\b(modal|dialog|sheet|drawer|popover|popup|overlay|empty|loading|error|selected item|detail panel|filtered results|search results|table|list|cards|chart|analytics|form|compose|create|add|new|upload|tab body|content body|results)\b/i;

const variantText = (variant: ScreenStateVariantPlan) =>
  [
    variant.id,
    variant.stateKey,
    variant.stateLabel,
    variant.stateRole,
    variant.triggerLabel,
    variant.description,
    variant.editInstruction,
  ].join(" ");

export const isMeaningfulStateVariant = (variant: ScreenStateVariantPlan) => {
  const text = variantText(variant);
  const hasMeaningfulSurface = meaningfulStatePattern.test(text);
  const hasPaidStateChange = paidVariantPattern.test(text);
  const looksVisualOnly = weakControlPattern.test(text) && !strongContentSurfacePattern.test(text);

  return hasMeaningfulSurface && hasPaidStateChange && !looksVisualOnly;
};

export const filterMeaningfulStateVariants = (variants: ScreenStateVariantPlan[]) =>
  variants.filter(isMeaningfulStateVariant);
