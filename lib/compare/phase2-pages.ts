import type { ComparisonPageData, PricingPlan } from "@/lib/compare/pages";

const drawglePlans: PricingPlan[] = [
  {
    name: "Starter",
    price: "$9 / month",
    subtitle:
      "600 AI credits per month (about 30 screens), screenshot and reference workflows, standalone HTML/Tailwind export, and design context.",
  },
  {
    name: "Pro",
    price: "$29 / month",
    subtitle:
      "2,400 AI credits per month (about 120 screens), priority generation, larger multi-screen projects, and full-project Agent Packs.",
  },
  {
    name: "Studio",
    price: "$79 / month",
    subtitle:
      "8,000 AI credits per month (about 400 screens), team-scale volume, project Agent Packs, beta scaffolds, and priority developer support.",
  },
];

const publicSourceDisclosure =
  "We reviewed current public product, pricing, documentation, help-center, and release pages. We did not run a paid-account benchmark, so workflow judgments are limited to capabilities the companies publicly document.";

export const phase2ComparisonPages: ComparisonPageData[] = [
  {
    slug: "magicpath",
    status: "published",
    competitor: {
      name: "MagicPath",
      productUrl: "https://www.magicpath.ai/",
    },
    metadata: {
      title: "Best MagicPath Alternative (2026): Drawgle vs MagicPath",
      description:
        "Compare Drawgle and MagicPath for mobile UI generation, React code export, Figma workflows, AI-agent collaboration, pricing, and developer handoff.",
      publishedDate: "2026-07-17",
      modifiedDate: "2026-07-17",
    },
    heroTitle: "Drawgle vs MagicPath: Mobile UI System or Collaborative Agent Canvas?",
    sonicBoomSummary:
      "MagicPath is the stronger general-purpose choice for editable Figma roundtrips, multiplayer agent work, and real React source; Drawgle is the narrower choice for mobile-only generation and framework-neutral implementation context.",
    researchDisclosure: publicSourceDisclosure,
    quickVerdict: {
      competitorTitle: "Choose MagicPath for React source, Figma, and live agent collaboration:",
      competitorDescription:
        "MagicPath treats every design as React, TypeScript, and Tailwind code and lets teams export it as a zip, open it in an IDE, send it to an external coding agent, or paste it into Figma as editable layers. It is the more complete design-to-React workspace.",
      drawgleTitle: "Choose Drawgle for a focused mobile UI system and non-React handoff:",
      drawgleDescription:
        "Drawgle is built around mobile screens, screenshot and reference-led generation, shared visual tokens, and an Agent Pack that asks a coding agent to implement the approved UI in the repository's actual framework rather than assuming React is the destination.",
    },
    premiumMoat: {
      eyebrow: "The honest workflow split",
      title: "MagicPath and Drawgle solve different versions of design-to-code",
      intro:
        "MagicPath is a collaborative canvas whose rendered artifact is already React code. Drawgle is a mobile UI generator whose exported HTML is a visual source of truth for a repository-aware coding agent. The decisive question is whether you want portable React source now or a mobile design system that can be adapted into the stack you already use.",
    },
    methodology: {
      summary:
        "We compared the products on the decisions most likely to change implementation cost: product scope, code artifact, framework assumptions, Figma interoperability, agent workflow, mobile specialization, and published pricing.",
      checks: [
        "Reviewed MagicPath's current documentation for code export, external agents, Figma import/export, and website capture.",
        "Reviewed MagicPath's current Free, Builder, Pro, and Teams pricing allowances.",
        "Checked Drawgle's public pricing language against the current HTML export, Agent Pack, and beta scaffold implementation.",
        "Separated directly exported source code from agent instructions that adapt a visual reference into an existing repository.",
      ],
    },
    comparisonRows: [
      {
        title: "Direct source-code artifact",
        shortCompetitor: "Exports a ready-to-run React, TypeScript, and Tailwind project.",
        shortDrawgle: "Exports standalone HTML plus repository implementation context.",
        competitorBehavior:
          "MagicPath says every design is already real React code. Its code panel can download a zip, open a fresh project in Cursor or Antigravity, or send the selected design to Claude Code, Codex, or Cursor for integration into an existing repository.",
        drawgleBehavior:
          "Drawgle exports standalone HTML/Tailwind as the visual source of truth and a .drawgle Agent Pack containing screens, tokens, assets, navigation context, and implementation instructions. The downstream agent is expected to rebuild the UI using the repository's own components and conventions.",
        proofPoint:
          "MagicPath gives you React source immediately; Drawgle gives an implementation agent richer mobile design context but still requires framework-specific implementation.",
        winner: "competitor",
        featured: true,
      },
      {
        title: "Framework flexibility",
        shortCompetitor: "Excellent when the destination is React and Tailwind.",
        shortDrawgle: "Agent handoff can target the framework already used by the app.",
        competitorBehavior:
          "MagicPath's documented export is deliberately opinionated: clean React, TypeScript, Tailwind, dependencies, and design-system tokens. That is a major advantage for a React product and a constraint for a native or non-React codebase.",
        drawgleBehavior:
          "Drawgle's Agent Pack is framework-neutral at the source-of-truth layer. A coding agent can be instructed to implement the screen in HTML/Tailwind, React Native, SwiftUI, Jetpack Compose, or Flutter using the receiving repository's architecture. Drawgle's native scaffolds remain beta and should not be confused with finished application source.",
        proofPoint:
          "Choose the opinionated React artifact for React teams; choose repository adaptation when the app's framework is already established elsewhere.",
        winner: "drawgle",
        featured: true,
      },
      {
        title: "Figma import and editable export",
        shortCompetitor: "Imports Figma and exports fully editable Figma layers.",
        shortDrawgle: "No native Figma file or editable-layer export.",
        competitorBehavior:
          "MagicPath supports Figma imports and can convert canvas content into editable Figma frames, text, fills, strokes, and effects. Paid allowances range from limited imports on Builder to unlimited import and export on Pro and Teams.",
        drawgleBehavior:
          "Drawgle can use screenshots and visual references, but it does not provide a Figma plugin or editable Figma-layer export. Its handoff is oriented toward HTML, tokens, assets, and coding-agent context.",
        proofPoint:
          "If Figma must remain the design team's source of truth, MagicPath has the clear workflow advantage.",
        winner: "competitor",
        featured: true,
      },
      {
        title: "Human and AI-agent collaboration",
        shortCompetitor: "Live shared canvas for people and external agents.",
        shortDrawgle: "Focused project canvas with a portable Agent Pack at handoff.",
        competitorBehavior:
          "MagicPath 2.0 is explicitly built as a shared workspace for humans and agents. External agents can work on the canvas, teams can see work appear in real time, and several designer agents can explore a brief in parallel.",
        drawgleBehavior:
          "Drawgle keeps product context, screens, tokens, navigation, and edits together in its own mobile canvas, then packages that context for coding agents. It does not currently document the same live multiplayer agent presence inside the design canvas.",
        proofPoint:
          "MagicPath is the stronger collaborative agent surface; Drawgle's strength appears later, when approved mobile UI moves into a repository.",
        winner: "competitor",
        featured: true,
      },
      {
        title: "Mobile-only product focus",
        shortCompetitor: "Covers apps, websites, components, and broader interface work.",
        shortDrawgle: "Strictly focused on mobile app screens and flows.",
        competitorBehavior:
          "MagicPath is intentionally broad. Its documentation covers applications, web pages, components, imported websites, design systems, and multiple canvas artifacts. That breadth suits mixed product work.",
        drawgleBehavior:
          "Drawgle is constrained to mobile UI. The planner, screen canvas, shared navigation, screenshot rebuilding, and design-token workflow are all optimized around a phone product rather than a general interface canvas.",
        proofPoint:
          "MagicPath wins on breadth; Drawgle wins when mobile specialization is the reason for choosing a separate tool.",
        winner: "tie",
        featured: false,
      },
      {
        title: "Screenshot and reference-led rebuilding",
        shortCompetitor: "Accepts screenshots, sketches, existing designs, and captured websites.",
        shortDrawgle: "Dedicated screenshot-to-editable-mobile-UI workflow.",
        competitorBehavior:
          "MagicPath can start from a screenshot, an existing design, a sketch, or a captured website and dispatch an appropriate design agent. It is flexible about the input artifact and broader about the output.",
        drawgleBehavior:
          "Drawgle's public product is more narrowly centered on rebuilding mobile screenshots and using visual references inside the same tokenized screen system, including selected-element edits and multi-screen continuity.",
        proofPoint:
          "Both accept visual starting points; Drawgle is the more specialized choice when the reference is specifically a mobile app screen.",
        winner: "tie",
        featured: false,
      },
      {
        title: "Entry price and free access",
        shortCompetitor: "Real free tier; Builder is $7/month billed annually.",
        shortDrawgle: "Paid entry starts at $9/month.",
        competitorBehavior:
          "MagicPath's Free plan includes daily credits, code download, limited Figma import/export, and a weekly external-agent allowance. Builder is listed at $7 per month billed annually and unlocks unlimited external-agent calls and Figma exports.",
        drawgleBehavior:
          "Drawgle starts at $9 per month with 600 credits, about 30 screens, screenshot/reference generation, HTML export, and design context. There is no comparable permanent free plan on the public pricing page.",
        proofPoint:
          "MagicPath is easier to evaluate without payment and cheaper at its annual Builder entry point.",
        winner: "competitor",
        featured: false,
      },
    ],
    pricing: {
      drawglePlans,
      competitorPlans: [
        {
          name: "Free",
          price: "$0",
          subtitle:
            "20 credits per day up to 120 per month, code download, 5 Figma imports and 3 exports per month, plus 125 external-agent calls per week.",
        },
        {
          name: "Builder",
          price: "$7 / month",
          subtitle:
            "Billed $84 annually. Unlimited external-agent calls and Figma exports, 5 Figma imports per month, code download, design systems, fonts, and the Chrome extension.",
        },
        {
          name: "Pro",
          price: "From $21 / month",
          subtitle:
            "Billed annually for the 600-credit pack. Higher credit packs are available, with unlimited Figma import/export, external-agent calls, and premium support.",
        },
        {
          name: "Teams",
          price: "Custom",
          subtitle:
            "1,000 shared credits per seat, team workspaces, SSO, admin controls, dedicated support, and annual invoicing.",
        },
      ],
      verdict:
        "MagicPath offers more free and low-cost capability, particularly for React and Figma workflows. Drawgle's pricing makes more sense only when the narrower mobile UI workflow, screenshot recreation, and framework-neutral Agent Pack are the features you are specifically buying.",
    },
    verdict: {
      competitorText:
        "Choose MagicPath when your team designs across web and app surfaces, wants real React source immediately, keeps work in Figma, or expects humans and external agents to collaborate live on the same canvas.",
      drawgleText:
        "Choose Drawgle when the work is strictly mobile, the product begins from prompts or app screenshots, and the approved visual system needs to be implemented inside an existing native or cross-platform repository rather than exported as a new React project.",
      competitorIf: [
        "React, TypeScript, and Tailwind are the intended production stack.",
        "Editable Figma import and export are non-negotiable.",
        "Designers and external coding agents need to share a live canvas.",
        "You design websites, dashboards, components, and apps in the same workspace.",
        "A permanent free tier and lower annual entry price matter.",
      ],
      drawgleIf: [
        "The product is a mobile app rather than a general web or interface project.",
        "Screenshots and mobile visual references are core starting points.",
        "The receiving repository uses React Native, SwiftUI, Compose, Flutter, or another established framework.",
        "You want shared mobile tokens, navigation context, and multi-screen continuity packaged for a coding agent.",
        "You prefer a narrower mobile workflow over a broader collaborative design canvas.",
      ],
    },
    bestForNiche: [
      {
        niche: "React and Tailwind product teams",
        bestTool: "competitor",
        reason:
          "MagicPath exports the same React, TypeScript, and Tailwind artifact it renders, reducing translation for this exact stack.",
      },
      {
        niche: "Native or cross-platform mobile repositories",
        bestTool: "drawgle",
        reason:
          "Drawgle's handoff is designed to be adapted into the repository's existing framework rather than delivered as a separate React web project.",
      },
      {
        niche: "Figma-centered design organizations",
        bestTool: "competitor",
        reason:
          "MagicPath supports both Figma import and fully editable Figma-layer export; Drawgle does not.",
      },
      {
        niche: "Mobile screenshot recreation",
        bestTool: "drawgle",
        reason:
          "Drawgle's product scope and editing system are specifically organized around rebuilding and evolving mobile screens.",
      },
      {
        niche: "Mixed web, component, and app design work",
        bestTool: "competitor",
        reason:
          "MagicPath's general-purpose canvas and React artifact are a better fit when mobile is only one of several surfaces.",
      },
      {
        niche: "Teams evaluating before paying",
        bestTool: "competitor",
        reason:
          "MagicPath publishes a meaningful free tier with code and limited Figma/agent access.",
      },
    ],
    idealUsers: {
      drawgle: [
        {
          role: "Mobile founder with an existing app stack",
          goal: "Turn approved screens into implementation work without changing frameworks.",
          whyFit:
            "The Agent Pack carries visual source, tokens, assets, and navigation intent into the repository the team already uses.",
        },
        {
          role: "Mobile product designer working from references",
          goal: "Rebuild and evolve app screenshots inside a coherent visual system.",
          whyFit:
            "Drawgle is narrower and more explicit about screenshot-to-editable-mobile-UI work.",
        },
        {
          role: "Native or cross-platform engineer",
          goal: "Give a coding agent enough design context to implement in SwiftUI, Compose, React Native, or Flutter.",
          whyFit:
            "The handoff does not assume that React web source is the target artifact.",
        },
      ],
      competitor: [
        {
          role: "React product team",
          goal: "Move from canvas output to real React source with minimal translation.",
          whyFit:
            "MagicPath's core artifact is already React, TypeScript, and Tailwind.",
        },
        {
          role: "Design team centered on Figma",
          goal: "Import, generate, refine, and export editable layers without breaking the Figma workflow.",
          whyFit:
            "MagicPath documents both directions of the Figma roundtrip.",
        },
        {
          role: "Agent-heavy product organization",
          goal: "Let Claude Code, Codex, Cursor, designers, and teammates share one live workspace.",
          whyFit:
            "Live human-agent collaboration is central to MagicPath 2.0's positioning.",
        },
      ],
    },
    limitations: {
      drawgle: [
        "Does not export editable Figma layers or import a Figma file as a first-class design document.",
        "The exported HTML is a visual source of truth, not finished React Native, SwiftUI, Compose, or Flutter application source.",
        "Does not document MagicPath-style live multiplayer presence for external agents on the design canvas.",
        "Paid-only entry is harder to trial than MagicPath's Free plan.",
      ],
      competitor: [
        "The documented source artifact is opinionated around React, TypeScript, and Tailwind.",
        "Its general-purpose scope can be more workspace than a team needs for mobile-only screen generation.",
        "Credits do not roll over, and higher generation volume requires Pro credit packs.",
        "Teams targeting native mobile frameworks still need an adaptation step even when the React source is high quality.",
      ],
    },
    faqs: [
      {
        question: "Is MagicPath better than Drawgle for code export?",
        answer:
          "MagicPath is better if you want direct React, TypeScript, and Tailwind source. Drawgle exports standalone HTML plus an Agent Pack that guides implementation inside an existing repository, so it is more flexible about the receiving framework but requires an implementation step.",
      },
      {
        question: "Can Drawgle export to Figma like MagicPath?",
        answer:
          "No. MagicPath can import Figma and export editable Figma layers. Drawgle uses screenshots and visual references but does not provide a native Figma file or editable-layer export.",
      },
      {
        question: "Which tool is better for React Native or SwiftUI?",
        answer:
          "Drawgle is the better handoff fit when the receiving repository is React Native, SwiftUI, Jetpack Compose, or Flutter because its Agent Pack tells a coding agent to implement within that framework. MagicPath's direct source export is React and Tailwind, not native mobile source.",
      },
      {
        question: "Does MagicPath have a free plan?",
        answer:
          "Yes. Its current Free plan includes daily AI credits, code download, limited monthly Figma imports and exports, and a weekly allowance for external-agent calls.",
      },
      {
        question: "Which tool is more collaborative?",
        answer:
          "MagicPath. It publicly documents live multiplayer work for teammates and agents on the same canvas. Drawgle keeps project context together and exports it to agents, but does not present the same live shared-agent canvas.",
      },
      {
        question: "Which is better for mobile screenshot recreation?",
        answer:
          "Drawgle is more specialized for rebuilding and evolving mobile app screenshots inside a tokenized multi-screen system. MagicPath accepts screenshots too, but its workflow covers a broader range of app, website, and component design.",
      },
    ],
    sources: [
      {
        label: "MagicPath documentation",
        href: "https://www.magicpath.ai/documentation",
        note: "Primary reference for the shared human-agent canvas, input types, Figma workflows, website capture, and MagicPath 2.0 positioning.",
      },
      {
        label: "MagicPath code export",
        href: "https://www.magicpath.ai/documentation/features/code-export",
        note: "Primary reference for React, TypeScript, and Tailwind output, IDE opening, zip download, and external-agent integration.",
      },
      {
        label: "MagicPath Figma export",
        href: "https://www.magicpath.ai/documentation/features/figma-export",
        note: "Primary reference for converting canvas content into editable Figma frames and layers.",
      },
      {
        label: "MagicPath pricing",
        href: "https://www.magicpath.ai/pricing",
        note: "Primary reference for plan prices, credit packs, Figma allowances, external-agent calls, and rollover policy.",
      },
    ],
    finalVerdict: {
      title: "Our Recommendation",
      body: [
        "MagicPath is the more capable general design-to-React workspace. Its combination of real React source, editable Figma roundtrips, external-agent integration, and live shared canvas makes it the honest recommendation for React teams and design organizations that still depend on Figma.",
        "Drawgle earns its place by being narrower. It is more aligned with teams building a mobile screen system from prompts, screenshots, and references, then handing that system to a coding agent inside an existing mobile repository.",
        "The products overlap in AI-assisted UI work but not in the final artifact. MagicPath gives you an opinionated React project. Drawgle gives you a mobile visual system and repository implementation context.",
      ],
      recommendation:
        "Choose MagicPath for collaborative design-to-React and Figma workflows. Choose Drawgle when mobile-only specialization and framework-neutral repository handoff are more important than receiving React source immediately.",
      drawgleCta: {
        label: "Try Drawgle",
        href: "/login",
      },
      competitorCta: {
        label: "Visit MagicPath",
        href: "https://www.magicpath.ai/",
      },
    },
  },
  {
    slug: "tapui",
    status: "published",
    competitor: {
      name: "TapUI",
      productUrl: "https://tapui.app/",
    },
    metadata: {
      title: "Best TapUI Alternative (2026): Drawgle vs TapUI",
      description:
        "Compare Drawgle and TapUI for AI mobile screen generation, pricing, editing, Figma claims, code handoff, screenshot recreation, and product workflow fit.",
      publishedDate: "2026-07-17",
      modifiedDate: "2026-07-17",
    },
    heroTitle: "Drawgle vs TapUI: Which AI Mobile UI Generator Fits the Work After Ideation?",
    sonicBoomSummary:
      "TapUI is an accessible prompt-to-mobile-screen generator with a free tier and high generation allowances; Drawgle is the stronger fit when screenshots, shared tokens, selected edits, and explicit developer handoff matter.",
    researchDisclosure:
      "We reviewed TapUI's current public site and first-party articles. Several older TapUI articles conflict with newer June 2026 pages about Figma and native-code export, so this comparison gives precedence to the newer explicit statements and flags the inconsistency.",
    quickVerdict: {
      competitorTitle: "Choose TapUI for fast mobile concepts and lower-friction volume:",
      competitorDescription:
        "TapUI turns a plain-language app idea into polished mobile screens, has a permanent free tier, and publishes 100 monthly generations on Starter and 650 on Pro. It is a simple choice when the desired outcome is a set of designs to review or hand to developers.",
      drawgleTitle: "Choose Drawgle when the design must carry implementation context:",
      drawgleDescription:
        "Drawgle adds screenshot rebuilding, shared design tokens, multi-screen planning, selected-element edits, standalone HTML, and a project Agent Pack. It is better when the UI needs to stay coherent and move into an existing codebase after approval.",
    },
    premiumMoat: {
      eyebrow: "Where the products diverge",
      title: "TapUI optimizes generation volume; Drawgle optimizes the handoff system",
      intro:
        "Both products generate mobile UI from text. The practical difference appears after the first polished screen: TapUI's newest first-party pages frame the result as designs for developers to build, while Drawgle packages visual source, tokens, navigation, assets, and agent instructions for that implementation step.",
    },
    methodology: {
      summary:
        "We focused on TapUI's currently published product and pricing language and treated newer, explicit first-party statements as more reliable than older blog guides when the claims conflict.",
      checks: [
        "Reviewed TapUI's live homepage, current June 2026 pricing explainer, and current TapUI-vs-Figma comparison.",
        "Compared those pages with older TapUI articles that claim native code, design-system packages, and a Figma plugin.",
        "Reviewed Drawgle's current public export surface and plan allowances.",
        "Avoided presenting any disputed TapUI export capability as settled fact.",
      ],
    },
    comparisonRows: [
      {
        title: "Prompt-to-mobile-screen generation",
        shortCompetitor: "Plain-language app descriptions become polished mobile screens.",
        shortDrawgle: "Prompts become planned, editable mobile screens in a shared project system.",
        competitorBehavior:
          "TapUI's core promise is direct and narrow: describe an app idea in plain language and receive polished mobile UI screens with consistent structure, styling, and hierarchy.",
        drawgleBehavior:
          "Drawgle also starts from a prompt, but its workflow emphasizes a product brief, multi-screen planning, shared navigation and tokens, and subsequent selected-element edits inside the same mobile project.",
        proofPoint:
          "TapUI is optimized for getting screens quickly; Drawgle is optimized for keeping a growing mobile product coherent.",
        winner: "tie",
        featured: true,
      },
      {
        title: "Developer handoff and code claims",
        shortCompetitor: "Newest official pages say designs are handed to developers, with no native source export.",
        shortDrawgle: "Standalone HTML plus tokens, assets, navigation, and an Agent Pack.",
        competitorBehavior:
          "TapUI's June 2026 pricing and comparison pages explicitly say it does not export React Native, Swift, Flutter, or other platform-specific code. They describe the output as mobile UI designs for a development team to implement.",
        drawgleBehavior:
          "Drawgle exports standalone HTML/Tailwind visual source and a .drawgle Agent Pack that tells a coding agent how to adapt the approved screens into the receiving repository. It is not a claim of finished native source, but it provides more explicit implementation context.",
        proofPoint:
          "Drawgle offers a documented bridge into implementation; TapUI's newest public pages stop at the design handoff.",
        winner: "drawgle",
        featured: true,
      },
      {
        title: "Public documentation consistency",
        shortCompetitor: "Recent and older first-party articles contradict each other on export capabilities.",
        shortDrawgle: "Public pricing and the current product export menu describe the same core artifacts.",
        competitorBehavior:
          "Older TapUI guides describe native code export, a Figma plugin, design-token packages, and several export formats. Newer June 2026 first-party pages explicitly deny native source export and frame TapUI as a design generator. Buyers should verify the live product before relying on older guides.",
        drawgleBehavior:
          "Drawgle's current pricing and in-product export surface consistently describe HTML/Tailwind, design variables, Agent Packs, and beta scaffolds. The Agent Pack is explicitly framed as implementation context rather than finished app source.",
        proofPoint:
          "Clear artifact definitions reduce procurement and handoff risk, especially when code export is a purchase requirement.",
        winner: "drawgle",
        featured: true,
      },
      {
        title: "Screenshot-to-editable UI",
        shortCompetitor: "Current core positioning centers text descriptions.",
        shortDrawgle: "Dedicated screenshot recreation and visual-reference modes.",
        competitorBehavior:
          "TapUI's current homepage and pricing explainer lead with plain-text generation. Its public material contains broader claims in older articles, but screenshot recreation is not explained as clearly or consistently as the core prompt workflow.",
        drawgleBehavior:
          "Drawgle publicly centers both screenshot recreation and style-reference generation. The resulting screen remains editable and connected to the project's shared tokens and navigation context.",
        proofPoint:
          "Drawgle is the safer choice when an existing app screenshot or visual reference is the main source artifact.",
        winner: "drawgle",
        featured: true,
      },
      {
        title: "Cross-screen consistency and targeted edits",
        shortCompetitor: "Editable screens and consistent generated styling; public control details are limited.",
        shortDrawgle: "Shared tokens plus selected-element edits across a planned mobile project.",
        competitorBehavior:
          "TapUI says generated screens use consistent structure, styling, and hierarchy and that paid plans include project history and exports. Its newest public pages provide less detail about global token propagation or scoped element editing.",
        drawgleBehavior:
          "Drawgle exposes shared colors, typography, spacing, radius, navigation context, and visual assets across the project. A user can select a specific card, button, section, or text block and request a localized change.",
        proofPoint:
          "Drawgle documents the mechanisms that preserve continuity after generation, not only the consistency of the first result.",
        winner: "drawgle",
        featured: false,
      },
      {
        title: "Free tier and generation allowance",
        shortCompetitor: "Free tier; 100 Starter and 650 Pro generations per month.",
        shortDrawgle: "Paid entry; about 30 Starter, 120 Pro, or 400 Studio screens.",
        competitorBehavior:
          "TapUI can be tried without a card. Starter publishes 100 screen generations per month and Pro publishes 650, with annual billing discounts and support differences rather than a complex feature gate.",
        drawgleBehavior:
          "Drawgle starts at $9 per month. Its screen estimates are lower than TapUI's published generation counts, but include screenshot/reference workflows, HTML export, tokens, and Agent Pack context.",
        proofPoint:
          "TapUI wins for inexpensive generation volume; Drawgle's value depends on whether the additional system and handoff artifacts reduce later work.",
        winner: "competitor",
        featured: false,
      },
      {
        title: "Figma workflow",
        shortCompetitor: "Older official guide claims a plugin; current core pages do not clearly confirm it.",
        shortDrawgle: "No native Figma export; handoff goes to code and agents.",
        competitorBehavior:
          "A March 2026 TapUI guide describes a direct Figma plugin, SVG/PDF/PNG formats, and token export. Newer June 2026 product comparisons do not foreground or consistently confirm those capabilities. Treat the Figma path as verify-before-buy.",
        drawgleBehavior:
          "Drawgle does not claim editable Figma export. Teams that require a Figma roundtrip should choose another tool rather than assume the HTML or Agent Pack replaces a design file.",
        proofPoint:
          "TapUI may offer the broader design-export path, but its own documentation currently makes the exact capability difficult to verify.",
        winner: "competitor",
        featured: false,
      },
    ],
    pricing: {
      drawglePlans,
      competitorPlans: [
        {
          name: "Free",
          price: "$0",
          subtitle:
            "No-card entry tier intended for a small number of trial screens and evaluation before upgrading.",
        },
        {
          name: "Starter",
          price: "$20 / month",
          subtitle:
            "$17 per month when billed yearly. Includes 100 screen generations per month, project history and exports, and email support.",
        },
        {
          name: "Pro",
          price: "$40 / month",
          subtitle:
            "$27 per month when billed yearly. Includes 650 screen generations per month, all Starter features, and priority support.",
        },
      ],
      verdict:
        "TapUI is cheaper per published screen generation and easier to try. Drawgle costs more per raw screen but includes a more explicit screenshot, token, and implementation-handoff system. Compare the cost of the next workflow step, not only the generation counter.",
    },
    verdict: {
      competitorText:
        "Choose TapUI when you already know the app idea, want polished mobile screens quickly, value a free trial path, and are comfortable handing the designs to developers for implementation.",
      drawgleText:
        "Choose Drawgle when the starting point may be a screenshot or visual reference, the project must stay consistent across many screens, and the developer handoff should include visual HTML, tokens, assets, navigation, and instructions for a coding agent.",
      competitorIf: [
        "Raw mobile screen generation volume is the main buying metric.",
        "You want a permanent free tier before paying.",
        "A clean design handoff is enough and your developers will implement from the screens.",
        "You prefer a simpler plan structure with few feature differences.",
        "You can verify any required Figma/export capability inside the current product before purchase.",
      ],
      drawgleIf: [
        "You need to rebuild an existing mobile screenshot or use a style reference.",
        "Shared tokens and cross-screen continuity matter after the first generation.",
        "You want selected-element edits instead of relying on whole-screen regeneration.",
        "The handoff should include HTML, design context, assets, and repository instructions.",
        "Clear public definitions of the exported artifact are important to procurement.",
      ],
    },
    bestForNiche: [
      {
        niche: "High-volume prompt-to-mobile concepts",
        bestTool: "competitor",
        reason:
          "TapUI publishes substantially higher monthly screen-generation allowances at Starter and Pro.",
      },
      {
        niche: "Screenshot-led mobile redesign",
        bestTool: "drawgle",
        reason:
          "Drawgle publicly documents screenshot recreation as a core workflow and keeps the result editable inside shared project tokens.",
      },
      {
        niche: "Teams handing visual designs to an engineering department",
        bestTool: "competitor",
        reason:
          "TapUI's newest pages are candid that developers receive designs to implement, which may be all a mature engineering team needs.",
      },
      {
        niche: "Small team using coding agents for implementation",
        bestTool: "drawgle",
        reason:
          "The Agent Pack packages visual source and implementation context specifically for repository-aware AI coding tools.",
      },
      {
        niche: "Free product evaluation",
        bestTool: "competitor",
        reason:
          "TapUI offers a permanent free tier, while Drawgle begins with a paid plan.",
      },
      {
        niche: "Buyers with strict export requirements",
        bestTool: "drawgle",
        reason:
          "Drawgle's current export artifact is clearer; TapUI's first-party articles currently conflict and should be verified before purchase.",
      },
    ],
    idealUsers: {
      drawgle: [
        {
          role: "Founder rebuilding or modernizing a mobile app",
          goal: "Use existing screens as a starting point and move the new UI toward implementation.",
          whyFit:
            "Screenshot recreation, shared tokens, and the Agent Pack keep the redesign connected to the build workflow.",
        },
        {
          role: "Mobile product lead managing a multi-screen system",
          goal: "Prevent visual drift while screens and navigation evolve.",
          whyFit:
            "Drawgle documents project-level tokens, navigation context, and targeted edits rather than only generation volume.",
        },
        {
          role: "Developer using Cursor, Claude Code, or Codex",
          goal: "Receive a portable visual source and implementation brief inside the repository.",
          whyFit:
            "The exported Agent Pack is built for that exact handoff.",
        },
      ],
      competitor: [
        {
          role: "Solo founder validating several app ideas",
          goal: "Generate polished mobile concepts cheaply and quickly.",
          whyFit:
            "TapUI's free tier and larger published generation allowances lower the cost of exploration.",
        },
        {
          role: "Product manager handing designs to an established engineering team",
          goal: "Communicate the intended UI without needing application source from the design tool.",
          whyFit:
            "TapUI's newest positioning treats the generated screens as the handoff artifact.",
        },
        {
          role: "Small design team prioritizing output volume",
          goal: "Produce many mobile screens without paying for a larger systems layer.",
          whyFit:
            "Starter and Pro are differentiated mainly by monthly generation capacity and support.",
        },
      ],
    },
    limitations: {
      drawgle: [
        "No permanent free tier for low-risk evaluation.",
        "Published screen estimates are lower than TapUI's Starter and Pro generation allowances.",
        "The Agent Pack still requires a coding agent or developer to implement the production UI.",
        "No native editable Figma export.",
      ],
      competitor: [
        "Newest first-party pages say there is no React Native, Swift, Flutter, or other platform-specific source export.",
        "Older and newer first-party articles conflict on Figma, code, token, and export capabilities.",
        "Current public pages give less detail about global token propagation, selected-element edits, and screenshot recreation.",
        "The generated designs still require a development team to build the final app.",
      ],
    },
    faqs: [
      {
        question: "Does TapUI export React Native, Swift, or Flutter code?",
        answer:
          "TapUI's newer June 2026 first-party pricing and comparison pages say no: the product generates mobile UI designs for developers to implement. Older TapUI articles make conflicting native-code claims, so verify the live export menu before buying for code output.",
      },
      {
        question: "Why do some TapUI articles claim code export?",
        answer:
          "TapUI's public blog currently contains inconsistent generations of product content. Older guides describe native code, design-system packages, and a Figma plugin, while newer pages explicitly deny platform-specific source export. This comparison gives precedence to the newer explicit statements.",
      },
      {
        question: "Is TapUI cheaper than Drawgle?",
        answer:
          "TapUI is cheaper for raw generation volume and offers a free tier. Drawgle starts at $9 per month and includes fewer estimated screens, but adds screenshot/reference workflows, tokenized projects, HTML export, and Agent Pack context.",
      },
      {
        question: "Which tool is better for screenshot-to-UI?",
        answer:
          "Drawgle. Screenshot recreation is a clearly documented core workflow, while TapUI's current core product pages focus on generating screens from plain-language app descriptions.",
      },
      {
        question: "Can TapUI export to Figma?",
        answer:
          "An older March 2026 TapUI guide describes a Figma plugin and several export formats, but newer core pages do not consistently confirm the capability. Treat Figma export as a feature to verify directly in the current product.",
      },
      {
        question: "Which tool is better for developers using AI coding tools?",
        answer:
          "Drawgle is more explicit about this workflow. Its Agent Pack contains HTML visual references, design tokens, assets, navigation context, and implementation instructions for repository-aware coding agents.",
      },
    ],
    sources: [
      {
        label: "TapUI home",
        href: "https://tapui.app/",
        note: "Primary reference for current prompt-to-mobile-screen positioning and annual plan summaries.",
      },
      {
        label: "TapUI pricing explained (June 2026)",
        href: "https://tapui.app/blog/tapui-pricing",
        note: "Primary reference for current monthly and annual prices, generation allowances, support, and the statement that TapUI does not export native application source.",
      },
      {
        label: "TapUI vs Figma AI (June 2026)",
        href: "https://tapui.app/blog/tapui-vs-figma-ai",
        note: "Primary current reference explicitly stating that TapUI does not export React Native, Swift, or Flutter code.",
      },
      {
        label: "TapUI to Figma guide (March 2026)",
        href: "https://tapui.app/blog/import-tapui-figma",
        note: "Older first-party reference containing Figma plugin and export claims that conflict with the product's newer public content.",
      },
    ],
    finalVerdict: {
      title: "Our Recommendation",
      body: [
        "TapUI is the honest value pick when the job is simply to turn many app ideas into polished mobile screens. Its free tier and published monthly generation allowances are materially more generous than Drawgle's screen estimates.",
        "Drawgle is the stronger system after ideation. Screenshot recreation, shared tokens, selected-element edits, HTML visual export, and the Agent Pack make it easier to carry the approved UI into a repository without losing the product's visual decisions.",
        "TapUI's documentation inconsistency is the main caution. If Figma or source-code export is a hard requirement, verify the current product behavior rather than relying on an older blog guide.",
      ],
      recommendation:
        "Choose TapUI for inexpensive, high-volume prompt-to-mobile concepts. Choose Drawgle when the UI must remain coherent across screens and move into implementation with explicit visual and agent context.",
      drawgleCta: {
        label: "Try Drawgle",
        href: "/login",
      },
      competitorCta: {
        label: "Visit TapUI",
        href: "https://tapui.app/",
      },
    },
  },
  {
    slug: "bravo-studio",
    status: "published",
    competitor: {
      name: "Bravo Studio",
      productUrl: "https://www.bravostudio.app/",
    },
    metadata: {
      title: "Best Bravo Studio Alternative (2026): Drawgle vs Bravo",
      description:
        "Compare Drawgle and Bravo Studio for Figma-to-app publishing, Bravo MCP React Native source, backend features, mobile UI generation, pricing, and code ownership.",
      publishedDate: "2026-07-17",
      modifiedDate: "2026-07-17",
    },
    heroTitle: "Drawgle vs Bravo Studio: Generate the Mobile UI or Publish the App?",
    sonicBoomSummary:
      "Bravo Studio is the stronger choice when a finished Figma design must become a working, publishable app; Drawgle is the stronger choice when the team still needs to generate, rebuild, and systematize the mobile UI before implementation.",
    researchDisclosure: publicSourceDisclosure,
    quickVerdict: {
      competitorTitle: "Choose Bravo when Figma is the source of truth and shipping is the goal:",
      competitorDescription:
        "Classic Bravo Studio turns tagged Figma files into native iOS and Android app builds with APIs, auth, payments, maps, and store publication. Bravo MCP 4.0 adds a beta path to owned React Native source and a Convex backend inside an AI client.",
      drawgleTitle: "Choose Drawgle when the UI itself still has to be invented or rebuilt:",
      drawgleDescription:
        "Drawgle starts from prompts, screenshots, and visual references, builds a coherent mobile screen system, and exports visual HTML plus implementation context. It does not require a finished Figma file or lock the team into Bravo's app runtime.",
    },
    premiumMoat: {
      eyebrow: "Two different stages of the app journey",
      title: "Bravo is a design-to-app platform; Drawgle is a mobile UI-to-repository workflow",
      intro:
        "Bravo begins with a structured design file and turns it into an app. Drawgle begins earlier, when the team still needs product screens, visual direction, tokens, navigation, and reference-led iteration. Bravo wins more of the shipping checklist; Drawgle wins the blank-page and redesign problem.",
    },
    methodology: {
      summary:
        "Bravo now has two materially different output paths, so this comparison treats classic Bravo Studio 3.x and the Bravo MCP 4.0 beta separately. Combining them into one generic 'code export' claim would be misleading.",
      checks: [
        "Reviewed Bravo's current Figma-to-app workflow, feature catalog, pricing, and app-publication language.",
        "Reviewed the Bravo MCP 4.0 beta page for React Native source, Convex, AI-client support, and code ownership.",
        "Distinguished classic Studio app binaries from MCP-generated React Native source.",
        "Compared both Bravo paths with Drawgle's earlier-stage mobile UI generation and Agent Pack workflow.",
      ],
    },
    comparisonRows: [
      {
        title: "Starting artifact",
        shortCompetitor: "Starts from a tagged Figma or supported design file.",
        shortDrawgle: "Starts from a prompt, screenshot, or visual reference.",
        competitorBehavior:
          "Bravo's design-first workflow assumes the team has already created the screens in Figma and applied Bravo Tags that describe screens, lists, forms, actions, and data behavior. The design file remains the source of truth.",
        drawgleBehavior:
          "Drawgle is designed for the stage before that file exists. It generates and edits mobile screens from product prompts, screenshots, and style references, then maintains tokens and navigation across the project.",
        proofPoint:
          "Choose Bravo to operationalize an approved design; choose Drawgle to create or rebuild the approved design.",
        winner: "tie",
        featured: true,
      },
      {
        title: "App-store publication",
        shortCompetitor: "Generates iOS and Android builds for store publication.",
        shortDrawgle: "Exports visual source and implementation context, not signed app builds.",
        competitorBehavior:
          "Bravo Studio can request IPA and AAB/APK packages, preview the app through Bravo Vision, and publish to the App Store or Google Play. Solo includes unlimited app builds for stores.",
        drawgleBehavior:
          "Drawgle does not compile, sign, or publish an application. Its output is intended to help developers or coding agents implement the screen system in a real repository that owns its own build and release process.",
        proofPoint:
          "Bravo is objectively closer to a shipped app when the design file is already ready.",
        winner: "competitor",
        featured: true,
      },
      {
        title: "Source-code ownership",
        shortCompetitor: "Classic Studio exports binaries; Bravo MCP beta exports owned React Native source.",
        shortDrawgle: "HTML and Agent Pack are portable, but native implementation is downstream.",
        competitorBehavior:
          "Classic Bravo Studio uses proprietary technology and exports app bundles rather than source code. Bravo MCP 4.0 is a separate beta path that generates a clean React Native codebase with a Convex backend and explicitly says the customer owns the source.",
        drawgleBehavior:
          "Drawgle's HTML, assets, tokens, and Agent Pack are portable and meant to live in the customer's repository. The production React Native, SwiftUI, Compose, or Flutter implementation is created by the developer or coding agent rather than exported as finished source by Drawgle.",
        proofPoint:
          "Bravo MCP is the stronger direct source-code proposition today, provided the team accepts a live beta and React Native/Convex architecture.",
        winner: "competitor",
        featured: true,
      },
      {
        title: "Backend, data, and native capability",
        shortCompetitor: "REST APIs, auth, payments, maps, charts, push, and data binding.",
        shortDrawgle: "Focuses on UI generation and implementation handoff.",
        competitorBehavior:
          "Bravo's Studio feature set includes API collections, multiple request types, authentication, Stripe, Firebase, OAuth, deep links, maps, charts, conditional visibility, push notifications, and app publication. Bravo MCP adds Convex as an included backend.",
        drawgleBehavior:
          "Drawgle is not a no-code backend or app runtime. It helps define and hand off the UI, while application logic, data, authentication, and native services belong in the receiving codebase.",
        proofPoint:
          "Bravo covers more of the working product; Drawgle deliberately stops at design and implementation context.",
        winner: "competitor",
        featured: true,
      },
      {
        title: "Prompt and screenshot-led UI creation",
        shortCompetitor: "AI build path reads a prepared, tagged design file.",
        shortDrawgle: "Creates and rebuilds mobile UI before a Figma file exists.",
        competitorBehavior:
          "Bravo MCP brings app building into Claude, Cursor, ChatGPT, and other MCP clients, but the visual source remains the tagged design file. Bravo is not primarily positioned as a prompt-to-polished-mobile-screen ideation canvas.",
        drawgleBehavior:
          "Drawgle's core workflow is generating the visual product itself from prompts, recreating screenshots as editable layouts, and applying visual references while preserving a project-wide mobile system.",
        proofPoint:
          "Drawgle is the stronger blank-page and redesign tool; Bravo is the stronger build-from-approved-design tool.",
        winner: "drawgle",
        featured: false,
      },
      {
        title: "Figma as source of truth",
        shortCompetitor: "Figma changes can sync into the app workflow.",
        shortDrawgle: "Independent mobile canvas with no editable Figma roundtrip.",
        competitorBehavior:
          "Bravo is built around keeping the Figma file authoritative. Tags, bindings, design updates, and the MCP workflow all read that source and preserve the designer's visual control.",
        drawgleBehavior:
          "Drawgle is a self-contained mobile canvas. It accepts screenshots and references but does not make Figma the canonical file or export fully editable layers back to Figma.",
        proofPoint:
          "Bravo fits established Figma organizations; Drawgle fits teams that want to skip or precede the Figma stage.",
        winner: "competitor",
        featured: false,
      },
      {
        title: "Maturity and workflow risk",
        shortCompetitor: "Studio is mature; MCP source export is explicitly beta.",
        shortDrawgle: "Core HTML and Agent Pack path is simpler; native scaffolds are beta.",
        competitorBehavior:
          "Bravo's classic design-to-native-build workflow has years of product history. The React Native source and Convex path is labeled Bravo 4.0 live beta and the company warns users to expect rough edges.",
        drawgleBehavior:
          "Drawgle's stable public handoff is HTML plus design context and Agent Packs. Its native scaffolds are also described as beta, so neither product's beta path should be treated as equivalent to a mature custom engineering pipeline.",
        proofPoint:
          "Compare stable Studio binaries with stable Drawgle handoff; evaluate both beta source/scaffold paths separately.",
        winner: "tie",
        featured: false,
      },
      {
        title: "Entry price",
        shortCompetitor: "Free Starter; Solo is $22/month with publication and MCP beta.",
        shortDrawgle: "Starts at $9/month for UI generation and handoff.",
        competitorBehavior:
          "Bravo Starter is free for unlimited app projects with up to 15 screens per app and Bravo Vision preview. Solo is $22 per month billed monthly, supports up to 30 screens per app, store builds, advanced integrations, and Bravo MCP beta.",
        drawgleBehavior:
          "Drawgle starts at $9 per month with about 30 screens and its design-to-handoff features. It is less expensive because it does not include an app runtime, backend, store publishing, or equivalent Figma pipeline.",
        proofPoint:
          "Bravo delivers more product surface for a higher price; Drawgle is cheaper because it solves an earlier and narrower stage.",
        winner: "tie",
        featured: false,
      },
    ],
    pricing: {
      drawglePlans,
      competitorPlans: [
        {
          name: "Starter",
          price: "$0",
          subtitle:
            "Unlimited app projects, up to 15 screens per app, Bravo Vision preview, Bravo Tags, API basics, and community support.",
        },
        {
          name: "Solo",
          price: "$22 / month",
          subtitle:
            "Billed monthly. Up to 30 screens per app, unlimited store builds, Stripe, OAuth, Firebase, deep links, maps, charts, conditional UI, and Bravo MCP 4.0 beta.",
        },
        {
          name: "Bravo To Go",
          price: "From €999",
          subtitle:
            "Concierge service positioned to turn a design into an owned React Native app, separate from the self-serve Studio subscription.",
        },
      ],
      verdict:
        "Bravo's Solo plan costs more because it includes real app functionality, publication, and beta React Native generation. Drawgle is the lower-cost choice only when the team needs UI generation and repository handoff rather than a no-code app platform.",
    },
    verdict: {
      competitorText:
        "Choose Bravo when the Figma design is approved and the team wants to connect data, preview a real app, publish store binaries, or use the MCP beta to receive an owned React Native/Convex codebase.",
      drawgleText:
        "Choose Drawgle when the team still needs to discover the visual product, rebuild references, create a coherent mobile screen system, or hand the approved UI into a codebase that is not organized around Bravo, React Native, and Convex.",
      competitorIf: [
        "Figma must remain the application's visual source of truth.",
        "You need IPA/AAB builds and a direct route to the app stores.",
        "REST APIs, auth, payments, maps, charts, or push are part of the no-code build.",
        "You want to evaluate Bravo MCP's owned React Native source and Convex backend.",
        "The team is comfortable with a tagged-design workflow and a beta AI path.",
      ],
      drawgleIf: [
        "The app screens do not exist yet and must be generated from prompts.",
        "An existing mobile screenshot or visual reference is the starting point.",
        "The production repository already uses SwiftUI, Compose, Flutter, React Native, or another custom architecture.",
        "You want portable HTML and design context without adopting a no-code runtime.",
        "The immediate bottleneck is UI direction, not backend binding or store publication.",
      ],
    },
    bestForNiche: [
      {
        niche: "Designers publishing a Figma app without a native team",
        bestTool: "competitor",
        reason:
          "Bravo connects the design to data and produces store-ready app builds without requiring a traditional native implementation.",
      },
      {
        niche: "Founders who need the mobile UI invented first",
        bestTool: "drawgle",
        reason:
          "Drawgle starts from prompts and references instead of requiring a prepared, tagged Figma source file.",
      },
      {
        niche: "Teams wanting owned React Native source from Figma",
        bestTool: "competitor",
        reason:
          "Bravo MCP explicitly offers owned React Native source and a Convex backend, although the workflow is still beta.",
      },
      {
        niche: "Existing native or cross-platform repositories",
        bestTool: "drawgle",
        reason:
          "Drawgle's Agent Pack is intended to be adapted into the repository's current architecture rather than define a new Bravo runtime.",
      },
      {
        niche: "No-code apps with APIs, auth, payments, and publication",
        bestTool: "competitor",
        reason:
          "Bravo covers functional app behavior and distribution that Drawgle does not attempt to provide.",
      },
      {
        niche: "Screenshot-led mobile redesign",
        bestTool: "drawgle",
        reason:
          "Drawgle is more directly organized around recreating and evolving existing mobile UI references.",
      },
    ],
    idealUsers: {
      drawgle: [
        {
          role: "Founder before the final Figma stage",
          goal: "Find a strong mobile direction and generate the core screens.",
          whyFit:
            "Drawgle is useful before a polished, tagged design file exists.",
        },
        {
          role: "Mobile team with an established repository",
          goal: "Implement a new visual system without adopting a new app platform.",
          whyFit:
            "The Agent Pack carries UI context into the team's current framework and conventions.",
        },
        {
          role: "Product designer rebuilding an existing app",
          goal: "Use screenshots and references as editable starting points.",
          whyFit:
            "Screenshot recreation is central to Drawgle's product rather than an incidental input to an app builder.",
        },
      ],
      competitor: [
        {
          role: "Figma-first product designer",
          goal: "Turn an approved design into a functional mobile app.",
          whyFit:
            "Bravo preserves the design file as source of truth and adds tags, bindings, preview, and publication.",
        },
        {
          role: "No-code founder",
          goal: "Connect APIs and launch iOS and Android without assembling a native engineering team.",
          whyFit:
            "Bravo Studio includes the functional and publishing surfaces needed for that route.",
        },
        {
          role: "React Native team exploring AI-assisted design-to-code",
          goal: "Generate owned application source from a tagged design file.",
          whyFit:
            "Bravo MCP is built for this exact workflow, with the important caveat that it remains a live beta.",
        },
      ],
    },
    limitations: {
      drawgle: [
        "Does not publish IPA, AAB, or APK builds.",
        "Does not supply a backend, database, auth, payments, or no-code app runtime.",
        "Does not keep Figma as a synchronized source of truth.",
        "Native scaffolds are beta and the stable handoff still requires implementation in a repository.",
      ],
      competitor: [
        "Classic Bravo Studio app projects remain tied to Bravo's proprietary platform and do not export source code.",
        "Owned React Native source is provided through the separate Bravo MCP 4.0 beta path, not the classic Studio binary workflow.",
        "The workflow assumes a prepared and correctly tagged design file, typically in Figma.",
        "Solo limits apps to 30 screens per project before considering other arrangements or services.",
      ],
    },
    faqs: [
      {
        question: "Does Bravo Studio export source code?",
        answer:
          "Classic Bravo Studio exports app builds for publication, not source code. Bravo MCP 4.0 is a separate live-beta path that generates an owned React Native codebase with a Convex backend.",
      },
      {
        question: "Can Bravo publish to the App Store and Google Play?",
        answer:
          "Yes. Bravo Studio can generate iOS and Android build files for publication, and the Solo plan currently lists unlimited app builds for stores.",
      },
      {
        question: "Does Drawgle turn Figma into an app?",
        answer:
          "No. Drawgle generates and edits mobile UI from prompts, screenshots, and references, then exports HTML and an Agent Pack for implementation. It is not a Figma-to-native-app runtime.",
      },
      {
        question: "Which is better for React Native?",
        answer:
          "Bravo MCP is stronger if you want direct owned React Native source from a tagged design and accept a beta workflow with Convex. Drawgle is stronger when React Native is only one possible receiving framework and the team wants an agent to adapt the mobile UI into an existing repository.",
      },
      {
        question: "Which tool is better before the final design exists?",
        answer:
          "Drawgle. Bravo's strongest workflow begins with a prepared design file, while Drawgle is built to generate, rebuild, and systematize the mobile screens themselves.",
      },
      {
        question: "Is Bravo Studio no-code?",
        answer:
          "Classic Bravo Studio is a design-first no-code app platform that binds a design to APIs and native capabilities. Bravo MCP adds an AI-assisted source-code path, but it is a distinct beta workflow.",
      },
    ],
    sources: [
      {
        label: "Bravo Figma-to-app",
        href: "https://www.bravostudio.app/figma-to-app/",
        note: "Primary reference for the tagged Figma workflow, Bravo Vision preview, and store publication path.",
      },
      {
        label: "Bravo features",
        href: "https://www.bravostudio.app/features/",
        note: "Primary reference for native components, actions, APIs, auth, payments, maps, charts, push notifications, and publication.",
      },
      {
        label: "Bravo MCP 4.0",
        href: "https://www.bravostudio.app/bravo-mcp/",
        note: "Primary reference for the live-beta React Native source, Convex backend, AI-client integration, and code ownership.",
      },
      {
        label: "Bravo pricing",
        href: "https://www.bravostudio.app/pricing/",
        note: "Primary reference for Starter and Solo pricing, screen limits, app builds, integrations, and inclusion of Bravo MCP beta.",
      },
    ],
    finalVerdict: {
      title: "Our Recommendation",
      body: [
        "Bravo Studio is the stronger product once the design is approved. It covers functional data binding, native capability, preview, and app-store publication that Drawgle does not provide.",
        "Bravo MCP also makes the source-code comparison more interesting in 2026: it promises owned React Native source and Convex from the tagged design, but it must be evaluated as a live beta rather than blended into the mature Studio workflow.",
        "Drawgle remains the better fit earlier in the process, especially for prompt-led generation, screenshot recreation, mobile visual systems, and teams that want to keep implementation inside an existing non-Bravo repository.",
      ],
      recommendation:
        "Choose Bravo Studio to turn a finished design into a functional or publishable app. Choose Drawgle to create and hand off the mobile UI before that design-to-app stage begins.",
      drawgleCta: {
        label: "Try Drawgle",
        href: "/login",
      },
      competitorCta: {
        label: "Visit Bravo Studio",
        href: "https://www.bravostudio.app/",
      },
    },
  },
];
