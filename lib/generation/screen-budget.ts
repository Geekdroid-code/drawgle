import type { ScreenPlan } from "@/lib/types";

export const screenBuildOutputTokenBudget = (screenPlan: ScreenPlan) => {
  const evidence = `${screenPlan.name} ${screenPlan.description}`;
  const dense = screenPlan.description.length > 6000
    || /\b(dashboard|analytics|chart|map|calendar|timeline|table|commerce grid|media grid|dense|data visualization)\b/i.test(evidence);
  if (dense) return 26000;
  return screenPlan.description.length < 2800 ? 12000 : 18000;
};
