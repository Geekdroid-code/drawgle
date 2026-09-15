"use client";
import { ProductPlanningRecovery } from "./ProductPlanningRecovery";
export function PlanningModeRecovery(props: Omit<React.ComponentProps<typeof ProductPlanningRecovery>, "modeError">) {
  return <ProductPlanningRecovery {...props} modeError />;
}
