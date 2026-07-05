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

export type PremiumMoatItem = {
  title: string;
  shortCompetitor: string;
  shortDrawgle: string;
  competitorBehavior: string;
  drawgleBehavior: string;
  proofPoint: string;
  winner: "drawgle" | "competitor" | "tie";
  featured: boolean;
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
  premiumMoat: {
    eyebrow: string;
    title: string;
    intro: string;
  };
  methodology: {
    summary: string;
    checks: string[];
  };
  comparisonRows: PremiumMoatItem[];
  pricing: PricingComparison;
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
    label: "Sleek.design",
    href: "https://sleek.design/",
    note: "Primary reference for mobile-first positioning, AI generation, and Figma and code export claims.",
  },
  {
    label: "Sleek.design pricing",
    href: "https://sleek.design/pricing",
    note: "Primary reference for plan structure, credit limits, API and agent skill access, and code export availability.",
  },
];

const stitchSources: ComparisonSource[] = [
  {
    label: "Google Stitch on Google Labs",
    href: "https://stitch.withgoogle.com/",
    note: "Primary reference for Stitch's positioning, mode split, monthly generation limits, and export options.",
  },
  {
    label: "Google I/O 2025: Stitch keynote",
    href: "https://blog.google/technology/google-labs/google-io-2025-stitch/",
    note: "Primary reference for Stitch's origin, Galileo AI lineage, and Gemini 2.5 Flash and Pro model usage.",
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
      title: "Drawgle vs Sleek.design (2026): AI Mobile UI Builder Comparison",
      description:
        "Drawgle exports production-ready code in HTML, React Native, SwiftUI, Jetpack Compose, and Flutter from a curated 2026 design system. Sleek.design is Figma-first. Compare features, pricing, and the real workflow differences.",
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
    premiumMoat: {
      eyebrow: "Why Drawgle over Sleek.design",
      title: "How Drawgle and Sleek.design actually differ",
      intro:
        "Sleek.design and Drawgle both turn prompts into mobile UI, but the question is not whether a screen can be generated. It is what happens to that screen after the design is approved. The differences below are the ones that decide whether you ship a real product or hand a polished screenshot to a developer who has to rebuild it from scratch.",
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
    comparisonRows: [
      {
        title: "Production-ready native code, not web-style HTML",
        shortCompetitor: "HTML or React with Tailwind. No native framework scaffolds.",
        shortDrawgle: "Five native export targets: HTML, React Native, SwiftUI, Jetpack Compose, Flutter.",
        competitorBehavior:
          "Sleek.design exports HTML or React with Tailwind CSS. There are no native framework scaffolds for iOS, Android, React Native, or Flutter, so the result has to be rewritten in the team's actual stack before it can ship.",
        drawgleBehavior:
          "Drawgle exports the same screen as standalone HTML, React Native, SwiftUI, Jetpack Compose, or Flutter, each including a theme file and a shared navigation component, so the result lands in Xcode, Android Studio, or a real web project as something a team can build on.",
        proofPoint:
          "Five production-ready code export targets, not one web-style scaffold the developer has to translate.",
        winner: "drawgle",
        featured: true,
      },
      {
        title: "A curated 2026 mobile system, not a generic AI baseline",
        shortCompetitor: "Mobile-first generation with a generic mobile UI baseline.",
        shortDrawgle: "iOS 26 and Material 3 patterns built into the foundation.",
        competitorBehavior:
          "Sleek.design's public positioning emphasizes speed of mobile mockup generation and Figma export. Its design language posture is much less documented and lands close to a generic mobile UI baseline that the team then has to push further in Figma.",
        drawgleBehavior:
          "Drawgle is built around an opinionated 2026 mobile design system: iOS 26 and Material 3 patterns, soft glass, refined typography, and motion that feels native to a real device, so the output already looks like a real product on the first pass.",
        proofPoint:
          "iOS 26 and Material 3 patterns, refined type, and motion built into the foundation rather than patched in after the fact.",
        winner: "drawgle",
        featured: true,
      },
      {
        title: "Token-driven consistency that survives a rebrand",
        shortCompetitor: "Per-screen visual editing; design system moves to Figma after export.",
        shortDrawgle: "Central tokens (color, spacing, type, radius) update every connected screen live.",
        competitorBehavior:
          "In Sleek.design, consistent style management is mostly a per-screen concern, and a real design system usually lives in Figma variables after export, which adds a second source of truth and a second cleanup pass.",
        drawgleBehavior:
          "In Drawgle, color, spacing, typography, radius, and shadow are tokenized once, and every connected screen updates live when a token changes, so a rebrand is a five-minute token edit rather than a multi-day cleanup.",
        proofPoint:
          "Update one token once and every connected screen in the project updates live, with no regeneration.",
        winner: "drawgle",
        featured: true,
      },
      {
        title: "An editable mobile product, not a Figma-first handoff",
        shortCompetitor: "Native editable Figma-layer export on every paid plan.",
        shortDrawgle: "A self-contained mobile canvas with project context memory.",
        competitorBehavior:
          "Sleek.design is positioned as a Figma-first mobile AI tool, with native editable Figma-layer export on every paid plan. Teams that do not live in Figma get less value from the tool, and design system control moves into Figma after export.",
        drawgleBehavior:
          "Drawgle is positioned as an editable mobile product on its own canvas, with a project context that remembers the audience, goals, features, visual direction, and earlier decisions as the project grows from one screen to ten.",
        proofPoint:
          "A self-contained mobile canvas that holds the product together as it grows, without a parallel Figma file to maintain.",
        winner: "competitor",
        featured: true,
      },
      {
        title: "Pricing and credit pool volume",
        shortCompetitor: "Very high monthly credit limits on paid tiers.",
        shortDrawgle: "Tuned for per-screen value of the shipped code, not raw generation volume.",
        competitorBehavior:
          "Sleek.design's Starter, Pro, and Team tiers publish very large monthly credit pools, which is useful for high-volume ideation and rapid variation across many concepts at once.",
        drawgleBehavior:
          "Drawgle's pricing is built around the value of the code export itself: each screen ships as production-ready code in a real framework, so the cost per shipped screen is lower even if the raw monthly credit count is smaller.",
        proofPoint:
          "The right choice depends on whether the bottleneck is generating many ideas or shipping fewer, better-built screens.",
        winner: "competitor",
        featured: false,
      },
      {
        title: "Visual editing depth and per-screen iteration",
        shortCompetitor: "Faster localized visual edits across many generated variations.",
        shortDrawgle: "Pinpoint element edits that propagate to global tokens.",
        competitorBehavior:
          "Sleek.design's published workflow emphasizes fast single-screen visual editing per prompt, which is well suited to high-volume ideation where you want to test many variations quickly.",
        drawgleBehavior:
          "Drawgle's editing loop is built around selecting a specific card, button, section, or navigation item and describing the change, which is applied locally without regenerating the whole screen and without rewriting the global tokens.",
        proofPoint:
          "Two different editing philosophies: localized fast iteration versus pinpoint element editing with global token propagation.",
        winner: "competitor",
        featured: false,
      },
      {
        title: "Agent Pack and AI coding tool handoff",
        shortCompetitor: "API and agent skills for Claude Code, Codex, and Cursor on Pro+.",
        shortDrawgle: "A .drawgle/ folder with tokens, handoff, and skill files for Cursor, Copilot, Claude Code.",
        competitorBehavior:
          "Sleek.design provides API and agent skill access for Claude Code, Codex, and Cursor on the Pro and Team pricing tiers, with a public agent skill repository on GitHub positioned for Pro+ users.",
        drawgleBehavior:
          "Drawgle's Agent Pack is a downloadable .drawgle/ folder containing design tokens, handoff, manifest, and SKILL files for Cursor, Copilot, and Claude Code. It is one of the five export targets rather than the headline, and works best when paired with the native or HTML scaffold the team is shipping.",
        proofPoint:
          "Both tools ship a real AI coding tool handoff; Drawgle includes it as one of five export targets, Sleek gates it behind Pro and Team.",
        winner: "tie",
        featured: false,
      },
      {
        title: "Screenshot-to-UI rebuilding",
        shortCompetitor: "Mobile-first generation; screenshot reference inputs supported but framed as inspiration.",
        shortDrawgle: "Screenshot rebuilt as a real, editable screen inside the tokenized system.",
        competitorBehavior:
          "Sleek.design's primary input surface is text prompts and reference images, optimized for fast generation rather than for faithfully rebuilding a reference screen as a buildable artifact.",
        drawgleBehavior:
          "Drawgle can rebuild a UI screenshot as a real, editable screen inside the same tokenized design system, then export the result as production-ready code in the target framework. This is most useful when porting an old design or matching a reference without copying it pixel for pixel.",
        proofPoint:
          "A real, editable screen in the team's design system, not a flattened image or a one-off regeneration.",
        winner: "drawgle",
        featured: false,
      },
      {
        title: "Mobile-first design focus",
        shortCompetitor: "Mobile-only by design; Figma-first handoff.",
        shortDrawgle: "Mobile-only by design; production-ready code in mobile-native frameworks.",
        competitorBehavior:
          "Sleek.design is mobile-only by design, with a Figma-first handoff and a web-style HTML or React export path. The output is built to be edited in Figma or scaffolded into a web project.",
        drawgleBehavior:
          "Drawgle is mobile-only by design, with five production-ready code export targets that include the actual mobile-native frameworks: React Native, SwiftUI, Jetpack Compose, and Flutter on top of standalone HTML. Neither tool tries to be a general-purpose web or desktop design tool.",
        proofPoint:
          "Both tools are mobile-only; the difference is whether the mobile output is a Figma file or a buildable codebase in a real mobile framework.",
        winner: "tie",
        featured: false,
      },
    ],
    pricing: {
      drawglePlans: [
        {
          name: "Starter",
          price: "$9 / month",
          subtitle:
            "600 AI credits per month (about 30 full screens), AI-powered element edits, agent-ready HTML, and full commercial license.",
        },
        {
          name: "Pro",
          price: "$21.75 / month (launch)",
          subtitle:
            "2,400 AI credits per month (about 120 full screens), priority generation speed, advanced layout options, and premium support. Launch price for the first 10 seats, then $29/mo.",
        },
        {
          name: "Studio",
          price: "$79 / month",
          subtitle:
            "8,000 AI credits per month (about 400 full screens), ultra-priority processing, agency and team collaboration, custom design system presets, and a dedicated account manager.",
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
        reason:
          "Drawgle's Starter tier at $9/mo and production-ready code export (HTML, React Native, SwiftUI, Compose, Flutter) compresses the loop from prompt to shipping a real app for solo builders.",
      },
      {
        niche: "Design-led agencies",
        bestTool: "competitor",
        reason:
          "Agencies that operate inside Figma and ship Figma files to clients will benefit from Sleek's native layer export and high-volume credit pools.",
      },
      {
        niche: "Native mobile teams (iOS / Android)",
        bestTool: "drawgle",
        reason:
          "Built-in scaffolds for SwiftUI, Jetpack Compose, React Native, and Flutter mean teams targeting real devices get code in the framework they already use.",
      },
      {
        niche: "Investor pitch decks and quick mockups",
        bestTool: "competitor",
        reason:
          "Sleek's mobile-first visual quality and rapid variation generation are well suited to presentation-grade mockups.",
      },
      {
        niche: "Large credit-volume ideation",
        bestTool: "competitor",
        reason:
          "Sleek's published credit limits on paid tiers are higher than Drawgle's, which matters for high-volume exploration.",
      },
      {
        niche: "Teams porting an old design from a screenshot",
        bestTool: "drawgle",
        reason:
          "Drawgle rebuilds a screenshot into editable UI with the same token system, then exports that UI as production-ready code in your target framework.",
      },
    ],
    idealUsers: {
      drawgle: [
        {
          role: "Solo developer building an MVP",
          goal: "Go from prompt to a running app UI as fast as possible.",
          whyFit:
            "Drawgle's $9 Starter tier and five production-ready code export targets are built for that exact loop, no matter what stack the MVP lives on.",
        },
        {
          role: "Native mobile engineer (iOS / Android)",
          goal: "Generate a UI in SwiftUI, Compose, or React Native without hand-writing the scaffold.",
          whyFit:
            "Built-in native scaffolds include a theme file, screen file, and shared navigation component, so the export drops into an Xcode or Android Studio project as something buildable.",
        },
        {
          role: "Startup CTO rebuilding a UI from scratch",
          goal: "Replace an old front-end with a coherent, token-driven mobile UI.",
          whyFit:
            "Token propagation prevents design drift, and the code export lands in the repository as a complete package rather than a polished screenshot.",
        },
      ],
      competitor: [
        {
          role: "Figma-native design team",
          goal: "Use AI to accelerate mockups that end up as Figma files.",
          whyFit:
            "Sleek's native editable layer export is the most direct path from AI to Figma in this category.",
        },
        {
          role: "Marketing-led mobile app founder",
          goal: "Generate investor-ready mobile mockups without learning a design tool.",
          whyFit:
            "Sleek's mobile-first positioning and presentation-grade output are tuned for that exact use case.",
        },
        {
          role: "Agency running high-volume mock production",
          goal: "Produce large batches of mobile concepts quickly.",
          whyFit:
            "Sleek's high credit limits and rapid variation workflow fit this volume-oriented model.",
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
        href: "/login",
      },
      competitorCta: {
        label: "Visit Sleek.design",
        href: "https://sleek.design/",
      },
    },
  },
  {
    slug: "google-stitch",
    status: "published",
    competitor: {
      name: "Google Stitch",
      productUrl: "https://stitch.withgoogle.com/",
    },
    metadata: {
      title: "Drawgle vs Google Stitch (2026): Vibe Design vs Production Code",
      description:
        "Google Stitch is a free Google Labs experiment that turns text, sketches, and voice into mobile and web UI. Drawgle is a commercial mobile-only design tool that exports production-ready code in HTML, React Native, SwiftUI, Jetpack Compose, and Flutter. Compare the real differences before you build on a sunset-risk tool.",
      publishedDate: "2026-07-01",
      modifiedDate: "2026-07-05",
    },
    heroTitle:
      "Drawgle vs. Google Stitch: A Free Google Labs Experiment vs. a 2026 Mobile Product",
    sonicBoomSummary:
      "Google Stitch and Drawgle both use generative AI to produce UI from prompts, but they answer very different questions. Stitch is positioned by Google Labs as a 'vibe design' canvas for fast text, sketch, and voice-to-UI exploration, with hard monthly generation caps, Figma and HTML export, and no paid plan. Drawgle is a commercial mobile-only product built around a curated 2026 design system and five production-ready code export targets, including React Native, SwiftUI, Jetpack Compose, and Flutter. The right choice depends on whether you are exploring ideas for free or shipping a real product that has to survive past a Google Labs sunset.",
    quickVerdict: {
      competitorTitle: "Choose Google Stitch if free, fast exploration matters more than the final ship:",
      competitorDescription:
        "Stitch is the fastest way to try 'vibe design' without a subscription. If you want to throw prompts, sketches, and voice notes at a Gemini-powered canvas and get a high-fidelity mockup back, then iterate visually inside Figma or scaffold the result in HTML, Stitch is genuinely free and genuinely quick. The cost is hard monthly generation caps, no paid upgrade path, weak design system control, and the inherent risk of building a paid workflow on a Google Labs experiment.",
      drawgleTitle: "Choose Drawgle if the goal is a shippable mobile product, not a slick mockup:",
      drawgleDescription:
        "Drawgle is a commercial mobile-only product built around the moment after the mockup is approved. The canvas exports production-ready code in HTML, React Native, SwiftUI, Jetpack Compose, and Flutter, alongside design tokens and a navigation shell, so the result lands in a repository as something a team can build on. Pricing is predictable, design system control is built in, and the product is not at risk of being deprecated by a parent company's experiments portfolio.",
    },
    premiumMoat: {
      eyebrow: "Why Drawgle over Google Stitch",
      title: "How Drawgle and Google Stitch actually differ",
      intro:
        "Google Stitch and Drawgle both use generative AI to produce UI from prompts, but they answer very different questions. Stitch is positioned by Google Labs as a free, fast 'vibe design' canvas. Drawgle is positioned as a commercial mobile product built around the moment after a design is approved. The differences below are the ones that decide whether you walk away with a slick first draft or a real, shippable mobile product.",
    },
    methodology: {
      summary:
        "This comparison is based on the publicly available Google Labs page for Stitch, the Google I/O 2025 keynote, and Drawgle's product and pricing pages as of mid-2026. The focus is on the workflow tradeoffs a solo builder, founder, or design lead would feel over the first 30 days of a project, including the realistic risk of depending on a Google Labs experiment.",
      checks: [
        "Reviewed Stitch's product page on Google Labs, including the Standard and Experimental mode split and published monthly generation caps.",
        "Reviewed the Google I/O 2025 announcement covering Stitch's Galileo AI origin and Gemini 2.5 Flash and Pro model usage.",
        "Cross-checked Stitch's documented export options (Figma, HTML, React) against the public guidance that its code export is best treated as scaffolding.",
        "Cross-referenced Drawgle's export targets and design token system against the product docs and the public export pipeline reference.",
        "Tested the end-to-end 'vibe design' workflow against a typical mobile MVP loop to surface the gap between 'first screen' and 'ten-screen product'.",
      ],
    },
    comparisonRows: [
      {
        title: "Production-ready native code, not scaffolding HTML",
        shortCompetitor: "HTML and React export treated as scaffolding, not production code.",
        shortDrawgle: "Five native export targets: HTML, React Native, SwiftUI, Jetpack Compose, Flutter.",
        competitorBehavior:
          "Google Stitch's own public guidance is to treat its HTML and React export as scaffolding rather than as production code, so a developer still has to rewrite the export in the team's actual stack before it can ship.",
        drawgleBehavior:
          "Drawgle exports the same screen as standalone HTML, React Native, SwiftUI, Jetpack Compose, or Flutter, each including a theme file and a shared navigation component, so the result lands in Xcode, Android Studio, or a real web project as something a team can build on.",
        proofPoint:
          "Five production-ready code export targets, not one web-style scaffold the developer has to translate.",
        winner: "drawgle",
        featured: true,
      },
      {
        title: "A curated 2026 mobile system, not a generic Gemini output",
        shortCompetitor: "Gemini 2.5 Flash and Pro, general-purpose endpoint.",
        shortDrawgle: "iOS 26 and Material 3 patterns built into the foundation.",
        competitorBehavior:
          "Stitch runs on Gemini 2.5 Flash and Pro and produces impressive first drafts, but it is a general-purpose endpoint, not a 2026 mobile-specific point of view. Two screens generated from the same prompt can look like they came from two different products.",
        drawgleBehavior:
          "Drawgle is built around an opinionated 2026 mobile design system: iOS 26 and Material 3 patterns, soft glass, refined typography, and motion that feels native to a real device, so the output already looks like a real product on the first pass.",
        proofPoint:
          "iOS 26 and Material 3 patterns, refined type, and motion built into the foundation rather than patched in after the fact.",
        winner: "drawgle",
        featured: true,
      },
      {
        title: "Token-driven consistency that survives a rebrand",
        shortCompetitor: "System lives inside a single screen; coherence is the user's responsibility.",
        shortDrawgle: "Central tokens (color, spacing, type, radius) update every connected screen live.",
        competitorBehavior:
          "In Stitch, the 'system' lives mostly inside a single generated screen. Changing a brand color usually means re-prompting or editing every screen by hand, and cross-screen coherence is the user's responsibility rather than the tool's.",
        drawgleBehavior:
          "In Drawgle, color, spacing, typography, radius, and shadow are tokenized once, and every connected screen updates live when a token changes, so a rebrand is a five-minute token edit rather than a multi-day cleanup.",
        proofPoint:
          "Update one token once and every connected screen in the project updates live, with no regeneration.",
        winner: "drawgle",
        featured: true,
      },
      {
        title: "A commercial product with a published roadmap, not a Labs experiment",
        shortCompetitor: "Free Google Labs project with hard caps and no paid tier.",
        shortDrawgle: "Commercial product with Starter, Pro, and Studio plans and account support.",
        competitorBehavior:
          "Stitch is a Google Labs project with hard monthly generation caps, no paid tier, and no guarantee of long-term availability. Google Labs has a documented history of deprecating experimental products, which is real operational risk for a paid workflow.",
        drawgleBehavior:
          "Drawgle is a commercial product with published Starter, Pro, and Studio plans, account support, a dedicated account manager on Studio, and a public roadmap that is not at the mercy of a parent company's experiments portfolio.",
        proofPoint:
          "Predictable monthly pricing, published credit pools, and 12-month continuity for teams that ship real products.",
        winner: "drawgle",
        featured: true,
      },
      {
        title: "Sketch-to-UI and voice input as a first-class surface",
        shortCompetitor: "Experimental Mode supports sketch, voice, and image input via Gemini 2.5 Pro.",
        shortDrawgle: "Text prompts and screenshot-to-UI rebuilding only.",
        competitorBehavior:
          "Stitch's Experimental Mode accepts sketches, voice prompts, and images, powered by Gemini 2.5 Pro. This is genuinely useful for the early 'get it out of my head' phase and is one of the strongest reasons to keep a free Stitch account alongside any paid tool.",
        drawgleBehavior:
          "Drawgle's current input surface is text prompts and screenshot-to-UI rebuilding; sketch and voice input are not first-class. Teams that think in marks will likely want Stitch in the loop for the rough-out phase.",
        proofPoint:
          "Stitch has a clear input advantage for sketch and voice-led ideation; Drawgle focuses on text and screenshot inputs that lead to editable, code-ready output.",
        winner: "competitor",
        featured: false,
      },
      {
        title: "Figma export with editable layers and Auto Layout",
        shortCompetitor: "Native Figma export with editable layers and Auto Layout.",
        shortDrawgle: "Not a Figma-first export workflow.",
        competitorBehavior:
          "Stitch ships native Figma export with editable layers and Auto Layout, which is the fastest way to move a generated screen into a real Figma file.",
        drawgleBehavior:
          "Drawgle is not positioned as a Figma-first export workflow; teams that require Figma as the final deliverable will not find that handoff here. If Figma output is a hard requirement, Stitch is the more direct fit.",
        proofPoint:
          "A genuine Stitch advantage for any team whose final deliverable is a Figma file rather than a code repository.",
        winner: "competitor",
        featured: false,
      },
      {
        title: "Project context memory across many screens",
        shortCompetitor: "Each generation is prompt-led; coherence is the user's responsibility.",
        shortDrawgle: "Canvas keeps audience, goals, features, and earlier decisions in context.",
        competitorBehavior:
          "Stitch is prompt-led, which means cross-screen coherence is the user's responsibility. The result can drift between generations, which is the root cause of the '70% finished' feeling reported by heavy Stitch users.",
        drawgleBehavior:
          "Drawgle keeps the audience, goals, features, visual direction, and earlier decisions in context when new screens are added or existing ones are refined, so a ten-screen product stays coherent as it grows.",
        proofPoint:
          "Two different editing philosophies: prompt-led regeneration versus context-aware incremental refinement.",
        winner: "drawgle",
        featured: false,
      },
      {
        title: "Screenshot-to-UI rebuilding as a portable input",
        shortCompetitor: "Screenshots supported as input, framed as inspiration.",
        shortDrawgle: "Screenshot rebuilt as a real, editable screen in the tokenized system.",
        competitorBehavior:
          "Stitch can use screenshots as input, but the system is geared toward generating new UI from a sketch or prompt, not toward rebuilding a reference screen as a buildable artifact.",
        drawgleBehavior:
          "Drawgle rebuilds a UI screenshot as an editable screen inside the same tokenized design system, then exports the result as production-ready code in the target framework. This is most useful when porting an old design or matching a reference without copying it pixel for pixel.",
        proofPoint:
          "A real, editable screen in the team's design system, not a flattened image or a one-off regeneration.",
        winner: "drawgle",
        featured: false,
      },
      {
        title: "Mobile-only focus, by design",
        shortCompetitor: "Mobile and web surfaces supported; general-purpose vibe design.",
        shortDrawgle: "Strictly mobile; no web, tablet, or desktop design surface.",
        competitorBehavior:
          "Stitch is positioned as a general-purpose vibe design canvas that can target mobile and web surfaces. It is not strictly mobile-only.",
        drawgleBehavior:
          "Drawgle is strictly a mobile product: there is no web, tablet, or desktop design surface, and the export targets are React Native, SwiftUI, Jetpack Compose, and Flutter on top of standalone HTML. If your project is a real mobile app and your team is shipping to a real device, mobile-only is a feature, not a limitation.",
        proofPoint:
          "Different scope choices: general-purpose vibe design versus a focused, mobile-only product with mobile-native code export.",
        winner: "tie",
        featured: false,
      },
    ],
    pricing: {
      drawglePlans: [
        {
          name: "Starter",
          price: "$9 / month",
          subtitle:
            "600 AI credits per month (about 30 full screens), AI-powered element edits, agent-ready HTML export, and full commercial license.",
        },
        {
          name: "Pro",
          price: "$21.75 / month (launch)",
          subtitle:
            "2,400 AI credits per month (about 120 full screens), priority generation speed, advanced layout options, and premium support. Launch price for the first 10 seats, then $29/mo.",
        },
        {
          name: "Studio",
          price: "$79 / month",
          subtitle:
            "8,000 AI credits per month (about 400 full screens), ultra-priority processing, agency and team collaboration, custom design system presets, and a dedicated account manager.",
        },
      ],
      competitorPlans: [
        {
          name: "Google Stitch (Labs)",
          price: "Free",
          subtitle:
            "All current generation modes, Figma and HTML or React export, and roughly 350 Standard plus roughly 50 Experimental generations per month.",
        },
        {
          name: "Paid upgrade",
          price: "Not available",
          subtitle:
            "Stitch does not publish a paid tier; users cannot pay to lift the monthly generation caps or guarantee continuity.",
        },
      ],
      verdict:
        "Stitch is free, and that is a real advantage for early-stage exploration. The hidden cost shows up when a project graduates from 'first screen' to 'ten-screen product with native code': Stitch does not publish a paid tier, the monthly generation caps are hard, and the platform is a Google Labs experiment that can be deprecated. Drawgle's Starter tier at $9/mo is a fair benchmark for the price of one full screen per day; Pro at $21.75/mo and Studio at $79/mo are built for teams shipping real code, not exploring an idea for a weekend. The right framing is not 'Stitch is cheaper' but 'free exploration versus paid shipping'.",
    },
    verdict: {
      competitorText:
        "Choose Google Stitch when you want to explore UI ideas for free, you need sketch and voice input as a first-class surface, and you are comfortable treating the HTML or React export as scaffolding that a developer will rewrite. Stitch is at its best for early exploration, not for shipping a ten-screen product.",
      drawgleText:
        "Choose Drawgle when the goal after the mockup is a real, shippable mobile product. The same canvas can export production-ready code in HTML, React Native, SwiftUI, Jetpack Compose, or Flutter, with design tokens, a navigation shell, and a project context that survives a rebrand. Pricing is predictable, the product is commercial, and the roadmap is not at the mercy of a Labs deprecation cycle.",
      competitorIf: [
        "You want to try 'vibe design' for free before committing to any paid tool.",
        "Sketch-to-UI, voice-to-UI, and image-to-UI are central to how you think through a product.",
        "Your final deliverable is a Figma file, and you need Stitch's native editable layer export to get there.",
        "You are comfortable treating the HTML or React export as scaffolding that a developer will rewrite from scratch.",
        "You do not need to plan around a Google Labs deprecation cycle for the next 12 months.",
      ],
      drawgleIf: [
        "Your next step after a design is approved is committing real code to a real repository.",
        "You are targeting a native framework like React Native, SwiftUI, Jetpack Compose, or Flutter.",
        "You need design tokens that hold a multi-screen product together through a rebrand.",
        "You want a commercial product with a published roadmap, account support, and predictable monthly pricing.",
        "You are porting an old design from a screenshot and need it rebuilt as editable UI in a tokenized system.",
        "You cannot put a paid product launch behind a tool that might be deprecated by a parent company's experiments portfolio.",
      ],
    },
    bestForNiche: [
      {
        niche: "Solo founders running a weekend prototype",
        bestTool: "competitor",
        reason:
          "Stitch's free tier and Experimental Mode are ideal for the 'try ten ideas on a Saturday' loop, and the lack of a paid plan is not a problem at this stage.",
      },
      {
        niche: "Native mobile teams shipping to a real app store",
        bestTool: "drawgle",
        reason:
          "Built-in scaffolds for SwiftUI, Jetpack Compose, React Native, and Flutter, with theme files and navigation, land directly in an Xcode or Android Studio project as something buildable.",
      },
      {
        niche: "Sketch-led designers who think in marks",
        bestTool: "competitor",
        reason:
          "Stitch's Experimental Mode accepts sketches and voice notes, which is a more natural input than a typed prompt for designers who think in pen.",
      },
      {
        niche: "Figma-first design agencies",
        bestTool: "competitor",
        reason:
          "Stitch's native editable Figma export with Auto Layout is the fastest path from a generated screen to a Figma file in this category.",
      },
      {
        niche: "Engineering-led teams targeting production code",
        bestTool: "drawgle",
        reason:
          "Production-ready code in five frameworks, design tokens, and a commercial product with a public roadmap match the operational requirements of a shipping team.",
      },
      {
        niche: "Porting a legacy screenshot into a new system",
        bestTool: "drawgle",
        reason:
          "Drawgle rebuilds a screenshot as editable UI inside a tokenized mobile system, then exports the result as buildable code in the target framework.",
      },
      {
        niche: "Builders who need 12-month continuity",
        bestTool: "drawgle",
        reason:
          "Drawgle is a commercial product with a published pricing roadmap; Stitch is a Google Labs project with no paid tier and a real risk of being deprecated.",
      },
    ],
    idealUsers: {
      drawgle: [
        {
          role: "Solo founder building a real mobile MVP",
          goal: "Move from a prompt to a shippable mobile app as fast as possible.",
          whyFit:
            "Drawgle's $9 Starter tier and five production-ready code export targets compress the loop from idea to a real Xcode, Android Studio, or web project.",
        },
        {
          role: "Native mobile engineer (iOS / Android)",
          goal: "Generate a UI in SwiftUI, Compose, or React Native without writing the scaffold by hand.",
          whyFit:
            "Built-in native scaffolds include a theme file, a screen file, and a shared navigation component, so the export drops into a real project as something buildable rather than something to rewrite.",
        },
        {
          role: "Startup CTO rebuilding a UI from scratch",
          goal: "Replace an old front-end with a coherent, token-driven mobile product.",
          whyFit:
            "Token propagation prevents design drift, the project context memory keeps the product coherent as it grows, and the code export lands in a real repository.",
        },
        {
          role: "Founder allergic to Labs-tier operational risk",
          goal: "Build on a commercial product with a published roadmap.",
          whyFit:
            "Drawgle's published pricing, account support, and Studio-tier dedicated account manager are the operational guarantees that a Google Labs experiment cannot offer.",
        },
      ],
      competitor: [
        {
          role: "Product designer exploring ten ideas on a Saturday",
          goal: "Use sketches, voice notes, and prompts to rough out concepts.",
          whyFit:
            "Stitch's Experimental Mode is built for this loop, and the free tier means a single founder can try as many directions as time allows.",
        },
        {
          role: "Figma-native design team",
          goal: "Use AI to accelerate mockups that end up as Figma files.",
          whyFit:
            "Stitch's native Figma export with editable layers and Auto Layout is the most direct path from a prompt to a Figma file in this category.",
        },
        {
          role: "Workshop facilitator teaching vibe design",
          goal: "Demo a free, accessible AI UI tool to non-developers.",
          whyFit:
            "Stitch is free, runs in a browser, accepts voice and sketches, and the lack of a paid plan removes the friction of a paywall in a teaching context.",
        },
        {
          role: "Early-stage founder doing pure exploration",
          goal: "Validate a direction with the cheapest possible tool.",
          whyFit:
            "Stitch's free tier, fast text-to-UI loop, and sketch and voice input are the lowest-friction option for the 'is this idea even worth designing' stage.",
        },
      ],
    },
    limitations: {
      drawgle: [
        "No first-class sketch or voice input: the input surface is text prompts and screenshot-to-UI rebuilding.",
        "No native Figma export with editable layers, so teams that require a Figma deliverable will need to import or rebuild screens manually.",
        "Mobile-only by design; the canvas does not support web, tablet, or desktop surfaces, even when the underlying HTML export is web-compatible.",
        "Newer commercial product: fewer public case studies and a shorter track record than the Google brand behind Stitch.",
      ],
      competitor: [
        "Stitch is a Google Labs project with no paid tier; users cannot pay to lift the published monthly generation caps.",
        "Code export is explicitly described as scaffolding, not production code, which means a developer still has to rewrite before shipping.",
        "Limited design system control inside the canvas; cross-screen coherence depends on the user rather than the tool.",
        "Google Labs products have a documented history of being deprecated, which is a real operational risk for a paid workflow.",
        "Prompt adherence is a known weakness: complex flows, brand-specific design, and multi-screen consistency are the most common failure modes reported by heavy users.",
      ],
    },
    faqs: [
      {
        question: "Is Google Stitch really free?",
        answer:
          "Yes. Stitch is published as a free Google Labs experiment, with the monthly generation caps documented on its product page. The catch is that there is no paid tier: users cannot pay to lift the caps, and Google Labs projects can be deprecated without notice. Free is real, but the operational guarantees of a paid commercial product are not part of the deal.",
      },
      {
        question: "What is the biggest difference between Drawgle and Google Stitch?",
        answer:
          "Stitch is a free Google Labs experiment optimized for the 'first screen in under a minute' loop, with sketch and voice input as a strong suit. Drawgle is a commercial mobile-only product optimized for the 'ten-screen product that ships to a real device' loop, with design tokens, project context, and production-ready code in five frameworks. The tools are closer than they look at first glance, but they are aimed at very different stages of a project.",
      },
      {
        question: "Should I use both Drawgle and Google Stitch?",
        answer:
          "Many teams do. Stitch is well suited to the free, fast, sketch-led exploration phase, and Drawgle is well suited to the paid, token-driven, production-code phase. Treating Stitch as the ideation tool and Drawgle as the shipping tool is a reasonable architecture for a small team, especially while Stitch remains free and Drawgle's Starter tier is $9/mo.",
      },
    ],
    sources: stitchSources,
    finalVerdict: {
      title: "Our Recommendation",
      body: [
        "If your goal is to throw prompts, sketches, and voice notes at a free canvas and get an impressive first draft back, Google Stitch is genuinely good at that and genuinely free. It is a reasonable tool for the exploration phase of a product, and there is no reason not to keep an account as long as it remains available.",
        "If your goal is to move from an approved design to a real mobile product in a real codebase, Drawgle is the more direct path. The same canvas can export production-ready code in HTML, React Native, SwiftUI, Jetpack Compose, or Flutter, with design tokens and a navigation shell that hold a ten-screen product together. Pricing is predictable, the product is commercial, and the roadmap is not at the mercy of a Google Labs deprecation cycle.",
        "The honest answer for many teams is to use both: Stitch for the sketch-led exploration, Drawgle for the code-led shipping. The two tools are aimed at different stages of a product, and a small team can comfortably use one for ideation and the other for production.",
      ],
      recommendation:
        "Final Recommendation: choose Google Stitch for free, sketch-led exploration. Choose Drawgle when you need production-ready code in a real mobile framework and 12-month continuity.",
      drawgleCta: {
        label: "Try Drawgle",
        href: "/login",
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
