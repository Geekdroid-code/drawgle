import type { ScreenPlan, ScreenStateVariantPlan } from "@/lib/types";

const meaningfulStatePattern =
  /\b(tab|tabs|segmented|segment|filter|filters|search results|sort|modal|dialog|sheet|drawer|popover|popup|overlay|empty|loading|error|selected|selection|detail panel|expanded|collapsed|accordion|form|compose|create|add|new|upload|results|table|list|cards|chart|analytics|calendar|kanban|step|wizard)\b/i;

const weakControlPattern =
  /\b(theme|dark|light|system|appearance|display setting|display settings|compact|density|dense|comfortable|color|colour|palette|accent|font size|spacing|radius|rounded|shadow|animation|motion|hover|focus|pressed|toggle switch|switch button)\b/i;

const paidVariantPattern =
  /\b(open|show|display|reveal|activate|select|expanded|collapsed|filtered|sorted|results|content|body|panel|modal|dialog|sheet|drawer|popover|form|create|add|upload|empty|loading|error|table|list|cards|chart|analytics)\b/i;

const strongContentSurfacePattern =
  /\b(modal|dialog|sheet|drawer|popover|popup|overlay|empty|loading|error|selected item|detail panel|filtered results|search results|table|list|cards|chart|analytics|form|compose|create|add|new|upload|tab body|content body|results)\b/i;

const lifecycleStatePattern =
  /\b(empty|empty state|zero state|no data|no items|no activity|loading|loading state|skeleton|skeletons|error|error state|failure|failed|offline)\b/i;

const explicitLifecycleRequestPattern =
  /\b(empty state|zero state|loading state|skeleton|error state|offline state|no results state|no data state|state variants?|screen states?|local states?)\b/i;

const actionBoundLifecyclePattern =
  /\b(search results|no results|filtered results|filter results|sort results|validation error|form error|upload error|import error|payment error|checkout error|permission error|permission denied|auth error|network error)\b/i;

type StateVariantGuardrailContext = {
  userPrompt?: string | null;
  screenPlan?: Pick<ScreenPlan, "name" | "description" | "type"> | null;
};

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

export const isMeaningfulStateVariantForContext = (
  variant: ScreenStateVariantPlan,
  context: StateVariantGuardrailContext = {},
) => {
  if (!isMeaningfulStateVariant(variant)) {
    return false;
  }

  const text = variantText(variant);
  const prompt = context.userPrompt ?? "";
  const lifecycleVariant = lifecycleStatePattern.test(text);
  const lifecycleExplicitlyRequested = explicitLifecycleRequestPattern.test(prompt);
  const lifecycleBoundToAction = actionBoundLifecyclePattern.test(text);

  if (lifecycleVariant && !lifecycleExplicitlyRequested && !lifecycleBoundToAction) {
    return false;
  }

  return true;
};

export const filterMeaningfulStateVariants = (
  variants: ScreenStateVariantPlan[],
  context: StateVariantGuardrailContext = {},
) => variants.filter((variant) => isMeaningfulStateVariantForContext(variant, context));
