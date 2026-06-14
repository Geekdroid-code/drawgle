export interface Feature {
  name: string;
  icon: string;
  iconColor?: string;
}

export interface Plan {
  id: string;
  title: string;
  description: string;
  highlight?: boolean;
  type?: "monthly" | "yearly";
  currency?: string;
  monthlyPrice: string;
  yearlyPrice: string;
  buttonText: string;
  badge?: string;
  features: Feature[];
  credits: number;
}

export interface CurrentPlan {
  plan: Plan;
  type: "monthly" | "yearly" | "custom";
  price?: string;
  nextBillingDate: string;
  paymentMethod: string;
  status: "active" | "inactive" | "past_due" | "cancelled";
}

export const plans: Plan[] = [
  {
    id: "7f0fa34c-a654-475c-a13b-a65205b7d754",
    title: "Starter",
    description: "Casual designers, indie hackers, validating concepts.",
    currency: "$",
    monthlyPrice: "9.00",
    yearlyPrice: "90.00",
    buttonText: "Subscribe to Starter",
    credits: 600,
    features: [
      { name: "600 AI generation credits/mo", icon: "check", iconColor: "text-emerald-500" },
      { name: "Build ~30 screens per month", icon: "check", iconColor: "text-emerald-500" },
      { name: "Free blueprint brief planner", icon: "check", iconColor: "text-emerald-500" },
      { name: "Agent-ready HTML & design context", icon: "check", iconColor: "text-emerald-500" },
      { name: "Figma design system matching", icon: "check", iconColor: "text-emerald-500" },
    ],
  },
  {
    id: "ef08d1b1-105b-4a40-bb77-1b1c197451bd",
    title: "Pro",
    description: "Startups, active developers, active builders.",
    currency: "$",
    monthlyPrice: "29.00",
    yearlyPrice: "290.00",
    buttonText: "Subscribe to Pro",
    badge: "Best Value",
    highlight: true,
    credits: 2400,
    features: [
      { name: "2,400 AI generation credits/mo", icon: "check", iconColor: "text-indigo-500" },
      { name: "Build ~120 screens per month", icon: "check", iconColor: "text-indigo-500" },
      { name: "Style reference image matching", icon: "check", iconColor: "text-indigo-500" },
      { name: "Priority AI generation speed", icon: "check", iconColor: "text-indigo-500" },
      { name: "All Starter features included", icon: "check", iconColor: "text-indigo-500" },
    ],
  },
  {
    id: "2b055b26-4ee6-404f-8646-a498bbd94b43",
    title: "Studio",
    description: "Agencies, hyper-active builders, design teams.",
    currency: "$",
    monthlyPrice: "79.00",
    yearlyPrice: "790.00",
    buttonText: "Subscribe to Studio",
    credits: 8000,
    features: [
      { name: "8,000 AI generation credits/mo", icon: "check", iconColor: "text-violet-500" },
      { name: "Build ~400 screens per month", icon: "check", iconColor: "text-violet-500" },
      { name: "Multi-screen system planning", icon: "check", iconColor: "text-violet-500" },
      { name: "Project Agent Packs & Beta Scaffolds", icon: "check", iconColor: "text-violet-500" },
      { name: "Priority developer support", icon: "check", iconColor: "text-violet-500" },
    ],
  },
];
