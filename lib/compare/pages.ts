export type ComparisonStatus = "published" | "draft";

export type ComparisonSource = {
  label: string;
  url: string;
};

export type ComparisonFact = {
  label: string;
  detail: string;
  source: ComparisonSource;
};

export type ComparisonRow = {
  feature: string;
  drawgle: string;
  competitor: string;
  winner: "drawgle" | "competitor" | "tie";
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
  hero: {
    eyebrow: string;
    h1: string;
    summary: string;
  };
  verdict: {
    short: string;
    drawgleBestFor: string[];
    competitorBestFor: string[];
  };
  competitorFacts: ComparisonFact[];
  drawgleAdvantages: string[];
  comparisonRows: ComparisonRow[];
  workflow: {
    title: string;
    description: string;
    steps: Array<{
      title: string;
      drawgle: string;
      competitor: string;
    }>;
  };
  switchGuide: Array<{
    title: string;
    description: string;
  }>;
  faqs: Array<{
    question: string;
    answer: string;
  }>;
  sources: ComparisonSource[];
};

const sleekSources = {
  homepage: {
    label: "Sleek homepage",
    url: "https://sleek.design/",
  },
  pricing: {
    label: "Sleek pricing",
    url: "https://sleek.design/pricing",
  },
  agentSkills: {
    label: "Sleek agent skills GitHub repository",
    url: "https://github.com/sleekdotdesign/agent-skills",
  },
};

export const comparisonPages = [
  {
    slug: "sleek-design",
    status: "published",
    competitor: {
      name: "Sleek.design",
      productUrl: "https://sleek.design/",
    },
    metadata: {
      title: "Drawgle vs Sleek.design: AI Mobile UI Design Comparison",
      description:
        "Compare Drawgle and Sleek.design for AI mobile UI generation, screenshot/reference workflows, Figma/code export, design tokens, agent handoff, and pricing.",
      publishedDate: "2026-06-28",
      modifiedDate: "2026-06-28",
    },
    hero: {
      eyebrow: "Sleek.design alternative",
      h1: "Drawgle vs Sleek.design",
      summary:
        "Both tools help builders turn app ideas into mobile UI. Sleek is strong when your end point is editable Figma layers; Drawgle is built for repository-ready handoff with editable HTML, design tokens, and implementation context for coding agents.",
    },
    verdict: {
      short:
        "Choose Drawgle when you want a design-to-implementation workflow that stays close to code. Choose Sleek when Figma-first mobile app design and very high credit limits are the center of your process.",
      drawgleBestFor: [
        "Builders who want agent-ready HTML, design tokens, and handoff context.",
        "Teams recreating screenshots as editable UI and refining selected elements visually.",
        "Developers who want exports that can be carried into Tailwind, React Native, SwiftUI, Flutter, or Compose workflows.",
      ],
      competitorBestFor: [
        "Teams that need native editable Figma-layer export.",
        "Users who value Sleek's very high published AI-credit limits.",
        "Pro or Team users who want Sleek API and agent-skill access.",
      ],
    },
    competitorFacts: [
      {
        label: "AI mobile app designer",
        detail:
          "Sleek describes itself as an AI mobile app designer that generates iOS and Android designs from a prompt or reference image.",
        source: sleekSources.homepage,
      },
      {
        label: "Visual editing and export",
        detail:
          "Sleek says users can visually edit generated screens and export designs to Figma or code.",
        source: sleekSources.homepage,
      },
      {
        label: "Figma export",
        detail:
          "Sleek's pricing FAQ says generated app designs can be pasted into Figma as native, fully editable layers without a plugin.",
        source: sleekSources.pricing,
      },
      {
        label: "Code export",
        detail:
          "Sleek says all plans include code exports as HTML or React with Tailwind CSS.",
        source: sleekSources.pricing,
      },
      {
        label: "Agent and API access",
        detail:
          "Sleek's Pro and Team pricing mention API and agent access for Claude Code, Codex, Cursor, and scripts; its GitHub agent-skill repository requires a Pro plan or higher.",
        source: sleekSources.agentSkills,
      },
      {
        label: "Published plan limits",
        detail:
          "Sleek publishes Free, Starter, Pro, and Team plans with project, export, AI-credit, API, and collaboration limits.",
        source: sleekSources.pricing,
      },
    ],
    drawgleAdvantages: [
      "Agent-ready exports include HTML, design tokens, and implementation context for coding workflows.",
      "Screenshot recreation focuses on turning references into editable UI instead of a flat mockup.",
      "Visual element edits let you change a selected card, button, section, image, or navigation element without regenerating the full screen.",
      "Shared design tokens keep colors, spacing, radius, typography, and shadows consistent across generated screens.",
      "Native app scaffolds are part of the Drawgle positioning for React Native, SwiftUI, Flutter, and Compose handoff.",
    ],
    comparisonRows: [
      {
        feature: "Primary workflow",
        drawgle: "Prompt or screenshot to editable mobile UI with agent-ready implementation context.",
        competitor: "Prompt or reference image to mobile app designs that can be edited and exported.",
        winner: "tie",
      },
      {
        feature: "Figma handoff",
        drawgle: "Not positioned as a Figma-first export workflow.",
        competitor: "Publishes native editable Figma-layer export without a plugin.",
        winner: "competitor",
      },
      {
        feature: "Code handoff",
        drawgle: "Exports Tailwind-oriented HTML, design tokens, and repository handoff context.",
        competitor: "Publishes HTML or React with Tailwind CSS export.",
        winner: "tie",
      },
      {
        feature: "Agent workflow",
        drawgle: "Designed around agent-ready context and implementation handoff inside a codebase.",
        competitor: "Offers Pro+ API and agent skills for Claude Code, Codex, Cursor, and scripts.",
        winner: "tie",
      },
      {
        feature: "Design system control",
        drawgle: "Central design tokens can update connected screens consistently.",
        competitor: "Focuses on visual editing and Figma/code export; public pages emphasize generated mobile screens.",
        winner: "drawgle",
      },
      {
        feature: "Native app scaffolds",
        drawgle: "Positions Pro+ exports around React Native, SwiftUI, Flutter, and Compose scaffolds.",
        competitor: "Public export copy emphasizes Figma, HTML, and React with Tailwind CSS.",
        winner: "drawgle",
      },
      {
        feature: "Published usage limits",
        drawgle: "Starter, Pro, and Studio plans are optimized around lower-cost UI generation volume.",
        competitor: "Publishes high AI-credit limits: Starter, Pro, and Team tiers include large monthly credit pools.",
        winner: "competitor",
      },
    ],
    workflow: {
      title: "How the workflow feels in practice",
      description:
        "The important difference is not whether either product can generate a nice mobile screen. It is where the work goes next: a design file, a codebase, or an agent handoff.",
      steps: [
        {
          title: "Start",
          drawgle: "Begin with a prompt, screenshot, or style reference, then keep refining inside the same project context.",
          competitor: "Begin with a prompt or reference image, then let Sleek generate mobile app screens.",
        },
        {
          title: "Refine",
          drawgle: "Edit selected UI elements and shared tokens so local changes and global style decisions stay connected.",
          competitor: "Use Sleek's visual editing workflow and Figma/code export path for downstream refinement.",
        },
        {
          title: "Hand off",
          drawgle: "Export HTML, tokens, and implementation context for coding agents and app frameworks.",
          competitor: "Export to editable Figma layers or HTML/React with Tailwind CSS; Pro+ users can connect agents via API/skills.",
        },
      ],
    },
    switchGuide: [
      {
        title: "If you already rely on Figma",
        description:
          "Sleek may be the cleaner fit because its public positioning is built around native editable Figma layers. Drawgle is better when Figma is not the final source of truth.",
      },
      {
        title: "If your next step is implementation",
        description:
          "Drawgle is built for the moment after design approval: design tokens, HTML, and context that a coding workflow can actually consume.",
      },
      {
        title: "If you need both",
        description:
          "Use Sleek when editable Figma output is mandatory; use Drawgle when your team wants the generated UI to arrive closer to code and design-system decisions.",
      },
    ],
    faqs: [
      {
        question: "Is Drawgle a direct replacement for Sleek.design?",
        answer:
          "Not exactly. Both are AI mobile UI tools, but they optimize for different handoffs. Sleek is strong for Figma-first output, while Drawgle is built around editable UI, design tokens, and coding-agent handoff.",
      },
      {
        question: "Does Drawgle export to Figma like Sleek?",
        answer:
          "No. This comparison does not claim Drawgle has Figma export. Sleek publicly emphasizes native editable Figma-layer export, while Drawgle emphasizes HTML, design tokens, and implementation context.",
      },
      {
        question: "Does Sleek support code export and agents?",
        answer:
          "Yes. Sleek says all plans include HTML or React with Tailwind CSS export, and its Pro and Team plans include API and agent access for tools such as Claude Code, Codex, Cursor, and scripts.",
      },
      {
        question: "Which tool should developers choose?",
        answer:
          "Developers who want a UI handoff that includes code-oriented context, design tokens, and framework implementation paths should look closely at Drawgle. Developers whose workflow begins in Figma may prefer Sleek.",
      },
      {
        question: "Why compare Drawgle with Sleek?",
        answer:
          "Sleek is one of the clearest AI mobile app design tools in this category, so it is a useful benchmark for explaining where Drawgle's repo-ready workflow is different.",
      },
    ],
    sources: [sleekSources.homepage, sleekSources.pricing, sleekSources.agentSkills],
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
      publishedDate: "2026-06-28",
      modifiedDate: "2026-06-28",
    },
    hero: {
      eyebrow: "Draft",
      h1: "Drawgle vs Google Stitch",
      summary: "Draft comparison page pending source review.",
    },
    verdict: {
      short: "Draft comparison page pending source review.",
      drawgleBestFor: [],
      competitorBestFor: [],
    },
    competitorFacts: [],
    drawgleAdvantages: [],
    comparisonRows: [],
    workflow: {
      title: "Draft",
      description: "Draft comparison page pending source review.",
      steps: [],
    },
    switchGuide: [],
    faqs: [],
    sources: [],
  },
] satisfies ComparisonPageData[];

export const publishedComparisonPages = comparisonPages.filter(
  (page) => page.status === "published",
);

export function getComparisonPage(slug: string) {
  return comparisonPages.find((page) => page.slug === slug && page.status === "published") ?? null;
}
