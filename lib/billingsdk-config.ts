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
    title: "Lite",
    description: "Casual designers, indie hackers, validating concepts.",
    currency: "$",
    monthlyPrice: "9.99",
    yearlyPrice: "99.90",
    buttonText: "Subscribe to Lite",
    credits: 600,
    features: [
      { name: "600 AI generation credits/mo", icon: "check", iconColor: "text-emerald-500" },
      { name: "Build ~20 screens per month", icon: "check", iconColor: "text-emerald-500" },
      { name: "Free blueprint brief planner", icon: "check", iconColor: "text-emerald-500" },
      { name: "Tailwind CSS components export", icon: "check", iconColor: "text-emerald-500" },
      { name: "Figma design system matching", icon: "check", iconColor: "text-emerald-500" },
    ],
  },
  {
    id: "ef08d1b1-105b-4a40-bb77-1b1c197451bd",
    title: "Starter",
    description: "Startups, active developers, active builders.",
    currency: "$",
    monthlyPrice: "17.49",
    yearlyPrice: "174.90",
    buttonText: "Subscribe to Starter",
    badge: "Best Value",
    highlight: true,
    credits: 1500,
    features: [
      { name: "1,500 AI generation credits/mo", icon: "check", iconColor: "text-indigo-500" },
      { name: "Build ~50 screens per month", icon: "check", iconColor: "text-indigo-500" },
      { name: "Style reference image matching", icon: "check", iconColor: "text-indigo-500" },
      { name: "Priority AI generation speed", icon: "check", iconColor: "text-indigo-500" },
      { name: "All Lite features included", icon: "check", iconColor: "text-indigo-500" },
    ],
  },
  {
    id: "2b055b26-4ee6-404f-8646-a498bbd94b43",
    title: "Pro",
    description: "Agencies, hyper-active builders, design teams.",
    currency: "$",
    monthlyPrice: "49.99",
    yearlyPrice: "499.90",
    buttonText: "Subscribe to Pro",
    credits: 10000,
    features: [
      { name: "10,000 AI generation credits/mo", icon: "check", iconColor: "text-violet-500" },
      { name: "Build ~333 screens per month", icon: "check", iconColor: "text-violet-500" },
      { name: "Multi-screen system planning", icon: "check", iconColor: "text-violet-500" },
      { name: "Unlimited Figma exports", icon: "check", iconColor: "text-violet-500" },
      { name: "Priority developer support", icon: "check", iconColor: "text-violet-500" },
    ],
  },
];
