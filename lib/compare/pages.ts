export type ComparisonStatus = "published" | "draft";

export type ComparisonSource = {
  label: string;
  href: string;
  note?: string;
};

export type PricingPlan = {
  name: string;
  price: string;
  subtitle: string;
};

export type PricingComparison = {
  drawglePlans: PricingPlan[];
  competitorPlans: PricingPlan[];
  verdict: string;
};

export type ComparisonPageData = {
  slug: string;
  status: ComparisonStatus;
  competitor: {
    name: string;
    productUrl: string;
  };
  metadata: {
    title: string;
    description: string;
    publishedDate: string;
    modifiedDate: string;
  };
  heroTitle: string;
  sonicBoomSummary: string;
  quickVerdict: {
    competitorTitle: string;
    competitorDescription: string;
    drawgleTitle: string;
    drawgleDescription: string;
  };
  methodology: {
    summary: string;
    checks: string[];
  };
  matrix: Record<string, {
    feature: string;
    drawgle: string;
    competitor: string;
    winner: "drawgle" | "competitor" | "tie";
  }>;
  pricing: PricingComparison;
  features: Array<{
    title: string;
    content: string;
    winner: "drawgle" | "competitor" | "tie";
  }>;
  verdict: {
    competitorText: string;
    drawgleText: string;
    competitorIf: string[];
    drawgleIf: string[];
  };
  bestForNiche: Array<{
    niche: string;
    bestTool: "drawgle" | "competitor" | "tie";
    reason: string;
  }>;
  idealUsers: {
    drawgle: Array<{
      role: string;
      goal: string;
      whyFit: string;
    }>;
    competitor: Array<{
      role: string;
      goal: string;
      whyFit: string;
    }>;
  };
  limitations: {
    drawgle: string[];
    competitor: string[];
  };
  faqs: Array<{
    question: string;
    answer: string;
  }>;
  sources: ComparisonSource[];
  finalVerdict: {
    title: string;
    body: string[];
    recommendation: string;
    drawgleCta: {
      label: string;
      href: string;
    };
    competitorCta: {
      label: string;
      href: string;
    };
  };
};

const sleekSources: ComparisonSource[] = [
  {
    label: "Sleek.design homepage",
    href: "https://sleek.design/",
    note: "Used to verify mobile-first positioning, AI generation, and Figma export claims.",
  },
  {
    label: "Sleek.design pricing",
    href: "https://sleek.design/pricing",
    note: "Used to verify plan structure, credit limits, API access, and code export availability.",
  },
  {
    label: "Sleek agent skills GitHub repository",
    href: "https://github.com/sleekdotdesign/agent-skills",
    note: "Used to confirm the Pro+ tier requirement for API and agent skill access.",
  },
];

export const comparisonPages: ComparisonPageData[] = [
  {
    slug: "sleek-design",
    status: "published",
    competitor: {
      name: "Sleek.design",
      productUrl: "https://sleek.design/",
    },
    metadata: {
      title: "Drawgle vs Sleek.design: AI Mobile UI Builder Comparison",
      description:
        "A source-backed, side-by-side comparison of Drawgle and Sleek.design covering AI generation, Figma and code export, design tokens, pricing, and which fits your workflow.",
      publishedDate: "2026-07-01",
      modifiedDate: "2026-07-05",
    },
    heroTitle: "Drawgle vs. Sleek.design: 2026 Comparison for Mobile UI Builders",
    sonicBoomSummary:
      "Sleek.design and Drawgle are both AI tools that turn prompts and screenshots into mobile UI, but they optimize for different deliverables. Sleek is positioned for Figma-first mobile app design with very high credit limits. Drawgle is positioned for production-ready code: the same canvas can export standalone HTML, native scaffolds for React Native, SwiftUI, Jetpack Compose, and Flutter, plus an Agent Pack for AI coding tools.",
    quickVerdict: {
      competitorTitle: "Choose Sleek.design if mobile-first, Figma-first output is the priority:",
      competitorDescription:
        "Sleek is built exclusively for mobile app screens and ships native editable Figma-layer export on all paid plans. If your team's source of truth is Figma and you want to generate many polished variations quickly, Sleek is the cleaner fit.",
      drawgleTitle: "Choose Drawgle if production-ready code, in the framework you already use, is the priority:",
      drawgleDescription:
        "Drawgle is built around the moment after design approval. The canvas exports real code in HTML, React Native, SwiftUI, Jetpack Compose, or Flutter, alongside design tokens and a navigation shell, so the result lands in a repository as something a team can build on rather than redesign.",
    },
    methodology: {
      summary:
        "This comparison is based on the publicly available product pages, pricing pages, and public repositories of both tools as of mid-2026. The focus is on the practical workflow differences a developer or founder would actually feel, not on an exhaustive feature checklist.",
      checks: [
        "Reviewed Sleek's published pricing structure and credit limits across Starter, Pro, and Team.",
        "Reviewed Sleek's public Figma export, code export, and agent skill documentation.",
        "Cross-checked Drawgle's export formats and design token behavior against the product docs.",
        "Tested the end-to-end handoff for both tools against a typical Tailwind + React workflow.",
      ],
    },
    matrix: {
      primaryWorkflow: {
        feature: "Primary workflow",
        drawgle: "Prompt or screenshot to editable mobile UI with production-ready code export.",
        competitor: "Prompt or reference image to mobile app screens with Figma and code export.",
        winner: "tie",
      },
      figmaHandoff: {
        feature: "Figma handoff",
        drawgle: "Not positioned as a Figma-first export workflow.",
        competitor: "Publishes native editable Figma-layer export without a plugin.",
        winner: "competitor",
      },
      codeHandoff: {
        feature: "Code handoff",
        drawgle: "Five production-ready targets: HTML / Tailwind, React Native, SwiftUI, Jetpack Compose, and Flutter.",
        competitor: "HTML or React with Tailwind CSS export, no native framework scaffolds.",
        winner: "drawgle",
      },
      nativeScaffolds: {
        feature: "Native framework scaffolds",
        drawgle: "Built-in scaffolds for React Native, SwiftUI, Jetpack Compose, and Flutter with a shared navigation component.",
        competitor: "No published native framework scaffolds; code export is web-oriented.",
        winner: "drawgle",
      },
      designTokens: {
        feature: "Design system control",
        drawgle: "Central design tokens (colors, spacing, radius, typography) update connected screens live.",
        competitor: "Visual editing per screen; consistent style management usually moves to Figma after export.",
        winner: "drawgle",
      },
      agentPack: {
        feature: "Agent Pack for AI coding tools",
        drawgle: "Includes a .drawgle/ folder with design tokens, handoff, and skill files for Cursor, Copilot, and Claude Code.",
        competitor: "Provides API and agent skills for Claude Code, Codex, and Cursor on Pro+ tiers.",
        winner: "tie",
      },
      pricingVolume: {
        feature: "Pricing volume",
        drawgle: "Starter, Pro, and Studio plans tuned for both generation volume and code export value.",
        competitor: "Starter, Pro, and Team plans publish very high AI credit limits.",
        winner: "competitor",
      },
      visualEditing: {
        feature: "Visual editing depth",
        drawgle: "Pinpoint element edits that propagate to global tokens.",
        competitor: "Faster localized visual edits across many generated variations.",
        winner: "competitor",
      },
    },
    pricing: {
      drawglePlans: [
        {
          name: "Starter",
          price: "$9 / month",
          subtitle: "600 AI credits per month (about 30 full screens), AI-powered element edits, agent-ready HTML, and full commercial license.",
        },
        {
          name: "Pro",
          price: "$21.75 / month (launch)",
          subtitle: "2,400 AI credits per month (about 120 full screens), priority generation speed, advanced layout options, and premium support. Launch price for the first 10 seats, then $29/mo.",
        },
        {
          name: "Studio",
          price: "$79 / month",
          subtitle: "8,000 AI credits per month (about 400 full screens), ultra-priority processing, agency/team collaboration, custom design system presets, and a dedicated account manager.",
        },
      ],
      competitorPlans: [
        {
          name: "Free",
          price: "Free",
          subtitle: "Trial credits, limited code and Figma exports, single project.",
        },
        {
          name: "Starter",
          price: "$24.99 / month",
          subtitle: "Unlimited code and Figma exports, early-bird pricing.",
        },
        {
          name: "Pro",
          price: "$49.99 / month",
          subtitle: "High-volume credit pool, REST API and agent skill access.",
        },
        {
          name: "Team",
          price: "$99 / user / month",
          subtitle: "Collaboration, centralized billing, and priority support.",
        },
      ],
      verdict:
        "Drawgle's pricing is built around the value of the code export itself, not just the screen generation. The Starter tier at $9/mo covers production-ready code in HTML, React Native, SwiftUI, Jetpack Compose, and Flutter for solo builders, while Studio at $79/mo competes with Sleek's $99/user/mo Team tier for design-led teams. Sleek's Free and Starter tiers are still cheaper for pure ideation volume, but Drawgle's credit pools are tuned to the moment after design approval, where each screen ships as a complete code package rather than a single asset.",
    },
    features: [
      {
        title: "Five production-ready code export targets",
        content:
          "From the same canvas, Drawgle can export standalone HTML with Tailwind, React Native (TypeScript), SwiftUI, Jetpack Compose (Kotlin), or Flutter (Dart). Each scaffold includes the screen, a shared navigation component, and a theme file mapped from your design tokens, so the result is something a team can build on rather than redesign.",
        winner: "drawgle",
      },
      {
        title: "Change one color, update the whole app",
        content:
          "Drawgle's token system is the foundation of the editor. Adjust a color, font, spacing value, corner radius, or shadow once and every connected screen updates live, without regenerating any work. Sleek's published workflow emphasizes visual editing per screen; consistent style management usually moves to Figma after export.",
        winner: "drawgle",
      },
      {
        title: "Click exactly what you want to change",
        content:
          "Drawgle lets you select a card, button, section, or navigation item and describe the improvement in plain text. The edit is applied locally while preserving everything around it, which prevents the 'AI design drift' problem where a regeneration rewrites styling you already approved.",
        winner: "drawgle",
      },
      {
        title: "Recreate screenshots into editable UI",
        content:
          "Upload a UI screenshot and Drawgle rebuilds its layout as a real, editable screen rather than a flattened image. This is most useful when porting an old design or matching a reference without copying it pixel for pixel.",
        winner: "drawgle",
      },
      {
        title: "Borrow the style, not the product",
        content:
          "Use any interface as visual inspiration. Drawgle carries over its mood, surfaces, typography, and rhythm while designing your own app and features. This is a more controlled take on 'style transfer' than the typical screenshot-to-output pipeline.",
        winner: "drawgle",
      },
      {
        title: "Agent Pack for AI-assisted implementation",
        content:
          "Drawgle's Agent Pack is a downloadable .drawgle/ folder containing design tokens, handoff, manifest, and SKILL files for Cursor, Copilot, and Claude Code. It is one of the five export targets rather than the headline, and it works best when paired with the native or HTML scaffold the team is actually shipping.",
        winner: "tie",
      },
      {
        title: "Mobile-first generation quality",
        content:
          "Sleek's positioning is exclusively tuned for mobile app design and ships very high generation quality for that surface. Drawgle is also mobile-first but its end goal is a code export, not a polished screenshot.",
        winner: "competitor",
      },
      {
        title: "High-volume credit pools",
        content:
          "Sleek's Starter, Pro, and Team tiers publish very large monthly credit pools, which makes it cheaper per screen for high-volume ideation. Drawgle's credit model is tuned more conservatively; the per-screen value is higher because each export produces a complete code package.",
        winner: "competitor",
      },
    ],
    verdict: {
      competitorText:
        "Choose Sleek.design when Figma is the center of your design workflow, when you need high-volume AI credit pools, and when you want a tool that is exclusively tuned for mobile app mockups without pushing toward native code export.",
      drawgleText:
        "Choose Drawgle when you need production-ready code from the canvas. The same project can export HTML, React Native, SwiftUI, Jetpack Compose, or Flutter, alongside design tokens and a navigation shell, so the result is something a team can build on instead of redesign.",
      competitorIf: [
        "Your team already lives in Figma and wants native editable layer export.",
        "You want to generate many variations quickly and iterate visually at high volume.",
        "Your pricing model rewards high credit pools over per-screen code export value.",
      ],
      drawgleIf: [
        "Your next step after design is shipping a real codebase in HTML, React Native, SwiftUI, Jetpack Compose, or Flutter.",
        "You want design tokens, a navigation shell, and screen code to land in a repository as a complete package.",
        "You need consistent design tokens across many screens without managing Figma variables manually.",
        "You want to recreate a screenshot as editable UI instead of a flattened image.",
      ],
    },
    bestForNiche: [
      {
        niche: "Indie hackers shipping MVPs",
        bestTool: "drawgle",
        reason: "Drawgle's Starter tier at $9/mo and production-ready code export (HTML, React Native, SwiftUI, Compose, Flutter) compresses the loop from prompt to shipping a real app for solo builders.",
      },
      {
        niche: "Design-led agencies",
        bestTool: "competitor",
        reason: "Agencies that operate inside Figma and ship Figma files to clients will benefit from Sleek's native layer export and high-volume credit pools.",
      },
      {
        niche: "Native mobile teams (iOS / Android)",
        bestTool: "drawgle",
        reason: "Built-in scaffolds for SwiftUI, Jetpack Compose, React Native, and Flutter mean teams targeting real devices get code in the framework they already use.",
      },
      {
        niche: "Investor pitch decks and quick mockups",
        bestTool: "competitor",
        reason: "Sleek's mobile-first visual quality and rapid variation generation are well suited to presentation-grade mockups.",
      },
      {
        niche: "Large credit-volume ideation",
        bestTool: "competitor",
        reason: "Sleek's published credit limits on paid tiers are higher than Drawgle's, which matters for high-volume exploration.",
      },
      {
        niche: "Teams porting an old design from a screenshot",
        bestTool: "drawgle",
        reason: "Drawgle rebuilds a screenshot into editable UI with the same token system, then exports that UI as production-ready code in your target framework.",
      },
    ],
    idealUsers: {
      drawgle: [
        {
          role: "Solo developer building an MVP",
          goal: "Go from prompt to a running app UI as fast as possible.",
          whyFit: "Drawgle's $9 Starter tier and five production-ready code export targets are built for that exact loop, no matter what stack the MVP lives on.",
        },
        {
          role: "Native mobile engineer (iOS / Android)",
          goal: "Generate a UI in SwiftUI, Compose, or React Native without hand-writing the scaffold.",
          whyFit: "Built-in native scaffolds include a theme file, screen file, and shared navigation component, so the export drops into an Xcode or Android Studio project as something buildable.",
        },
        {
          role: "Startup CTO rebuilding a UI from scratch",
          goal: "Replace an old front-end with a coherent, token-driven mobile UI.",
          whyFit: "Token propagation prevents design drift, and the code export lands in the repository as a complete package rather than a polished screenshot.",
        },
      ],
      competitor: [
        {
          role: "Figma-native design team",
          goal: "Use AI to accelerate mockups that end up as Figma files.",
          whyFit: "Sleek's native editable layer export is the most direct path from AI to Figma in this category.",
        },
        {
          role: "Marketing-led mobile app founder",
          goal: "Generate investor-ready mobile mockups without learning a design tool.",
          whyFit: "Sleek's mobile-first positioning and presentation-grade output are tuned for that exact use case.",
        },
        {
          role: "Agency running high-volume mock production",
          goal: "Produce large batches of mobile concepts quickly.",
          whyFit: "Sleek's high credit limits and rapid variation workflow fit this volume-oriented model.",
        },
      ],
    },
    limitations: {
      drawgle: [
        "Not a Figma-first workflow: teams that live entirely in Figma will need to import or rebuild screens manually.",
        "Lower published credit pools than Sleek on comparable paid tiers; the cost calculus favors per-screen code value over ideation volume.",
        "Newer product surface: fewer public case studies and third-party integrations than established alternatives.",
      ],
      competitor: [
        "Code export is generic HTML or React with Tailwind; there are no native framework scaffolds for iOS, Android, React Native, or Flutter.",
        "Design system control happens largely outside the tool, in Figma variables, which adds a second source of truth.",
        "API and agent skill access is gated behind Pro and Team tiers, which raises the entry cost for developer-led teams.",
      ],
    },
    faqs: [
      {
        question: "Is Drawgle a direct replacement for Sleek.design?",
        answer:
          "Not exactly. Both are AI mobile UI tools, but they optimize for different handoffs. Sleek is strong for Figma-first output, while Drawgle is built around editable UI, design tokens, and coding-agent handoff. Choosing one is really about whether your bottleneck is design file production or implementation speed.",
      },
      {
        question: "Does Drawgle export to Figma like Sleek does?",
        answer:
          "No. This comparison does not claim Drawgle has Figma export. Sleek publicly emphasizes native editable Figma-layer export, while Drawgle emphasizes HTML, design tokens, and implementation context. If Figma export is mandatory for your workflow, Sleek is the more direct fit.",
      },
      {
        question: "Does Sleek support code export and agent workflows?",
        answer:
          "Sleek says all plans include HTML or React with Tailwind CSS export. API and agent access for tools like Claude Code, Codex, and Cursor are documented on the Pro and Team pricing tiers, while the public agent skill repository on GitHub is positioned for Pro+ users.",
      },
      {
        question: "Which tool should developers choose?",
        answer:
          "Developers who want a UI handoff that includes code-oriented context, design tokens, and framework implementation paths should look closely at Drawgle. Developers whose workflow begins in Figma and ends in a design file may prefer Sleek.",
      },
      {
        question: "Is Sleek cheaper than Drawgle at scale?",
        answer:
          "Sleek's published credit limits on paid tiers are higher, which can make it cheaper per generated screen for pure ideation. Drawgle's pricing is built around the value of the handoff itself, so the cost-per-shipped-feature is usually lower for engineering-led teams.",
      },
      {
        question: "Why compare Drawgle and Sleek at all?",
        answer:
          "Sleek is one of the clearest AI mobile app design tools in this category, which makes it a useful benchmark for explaining where Drawgle's repo-ready workflow is different. The comparison helps buyers decide based on the actual handoff they need.",
      },
    ],
    sources: sleekSources,
    finalVerdict: {
      title: "Our Recommendation",
      body: [
        "If your primary goal is to generate many polished mobile mockups and continue inside Figma, Sleek is the more direct tool. Its mobile-first output, native Figma export, and high credit limits are genuinely strong for that loop.",
        "If your primary goal is to move from design to production-ready code in HTML, React Native, SwiftUI, Jetpack Compose, or Flutter, Drawgle is the better fit. The same canvas can export a real, buildable code package into the framework your team already ships in.",
        "If you operate both loops, treat Sleek as the ideation tool and Drawgle as the production tool. Many teams use both rather than forcing one to do both jobs.",
      ],
      recommendation:
        "Final Recommendation: choose Sleek for Figma-first mobile design. Choose Drawgle when you need production-ready code in the framework your team already uses.",
      drawgleCta: {
        label: "Try Drawgle",
        href: "/project/new",
      },
      competitorCta: {
        label: "Visit Sleek.design",
        href: "https://sleek.design/",
      },
    },
  },
  {
    slug: "google-stitch",
    status: "draft",
    competitor: {
      name: "Google Stitch",
      productUrl: "https://stitch.withgoogle.com/",
    },
    metadata: {
      title: "Drawgle vs Google Stitch",
      description: "Draft comparison page pending source review.",
      publishedDate: "2026-07-01",
      modifiedDate: "2026-07-05",
    },
    heroTitle: "Drawgle vs Google Stitch",
    sonicBoomSummary: "Draft comparison page pending source review.",
    quickVerdict: {
      competitorTitle: "Choose Google Stitch if...",
      competitorDescription: "Draft comparison page pending source review.",
      drawgleTitle: "Choose Drawgle if...",
      drawgleDescription: "Draft comparison page pending source review.",
    },
    methodology: {
      summary: "Draft comparison page pending source review.",
      checks: [],
    },
    matrix: {},
    pricing: {
      drawglePlans: [],
      competitorPlans: [],
      verdict: "Draft comparison page pending source review.",
    },
    features: [],
    verdict: {
      competitorText: "Draft comparison page pending source review.",
      drawgleText: "Draft comparison page pending source review.",
      competitorIf: [],
      drawgleIf: [],
    },
    bestForNiche: [],
    idealUsers: {
      drawgle: [],
      competitor: [],
    },
    limitations: {
      drawgle: [],
      competitor: [],
    },
    faqs: [],
    sources: [],
    finalVerdict: {
      title: "Our Recommendation",
      body: ["Draft comparison page pending source review."],
      recommendation: "Draft comparison page pending source review.",
      drawgleCta: {
        label: "Try Drawgle",
        href: "/project/new",
      },
      competitorCta: {
        label: "Visit Google Stitch",
        href: "https://stitch.withgoogle.com/",
      },
    },
  },
];

export const publishedComparisonPages = comparisonPages.filter(
  (page) => page.status === "published",
);

export function getComparisonPage(slug: string) {
  return comparisonPages.find((page) => page.slug === slug && page.status === "published") ?? null;
}
