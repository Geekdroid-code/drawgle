import { ArrowUpRight, Plus } from "lucide-react";

export const homeFaqs = [
  {
    question: "What is an AI mobile app designer?",
    answer:
      "An AI mobile app designer turns a product brief or visual reference into editable mobile interface screens. Drawgle adds shared design tokens, navigation context, editable screen structure, and developer handoff files so the result can continue beyond a static mockup.",
  },
  {
    question: "How does Drawgle turn a text prompt into mobile app UI?",
    answer:
      "Describe the app, audience, visual direction, and screens you need in plain language. Drawgle uses that brief to plan the flow, create a shared design system, and generate connected mobile screens that remain editable.",
  },
  {
    question: "Can AI design a complete multi-screen mobile app flow?",
    answer:
      "Yes. Drawgle can plan and generate a set of related screens instead of treating every screen as an isolated mockup. The flow can share navigation, product context, and design tokens across dashboards, detail views, forms, onboarding, and other screens.",
  },
  {
    question: "Can Drawgle rebuild a screenshot as editable UI?",
    answer:
      "Yes. Upload a UI screenshot and Drawgle rebuilds its layout as editable mobile screens with live HTML, design tokens, and components you can refine.",
  },
  {
    question: "What is the difference between screenshot recreation and a style reference?",
    answer:
      "Screenshot recreation rebuilds the reference layout as editable UI. Style-reference mode uses only the visual direction—such as typography, color, surfaces, and spacing—to create an original layout for your own product.",
  },
  {
    question: "Can it keep a multi-screen app visually consistent?",
    answer:
      "Yes. Drawgle connects every screen to one shared design system for colors, typography, spacing, radii, shadows, and navigation context.",
  },
  {
    question: "Can I edit one element without regenerating a screen?",
    answer:
      "Yes. Select a card, button, section, image, or navigation element and describe the exact change. Drawgle refines that selection while preserving the rest of the screen.",
  },
  {
    question: "Can I design mobile app UI without Figma or coding experience?",
    answer:
      "Yes. You can start with a plain-language brief, edit the generated screens visually, and adjust shared design tokens without writing code or preparing a Figma file first. Designers and developers can still use the exported files in their later workflow.",
  },
  {
    question: "What does Drawgle export for developers?",
    answer:
      "Drawgle exports standalone Tailwind HTML and an Agent Pack containing screen files, design tokens, assets, navigation context, and implementation instructions for coding agents.",
  },
  {
    question: "Can I use Drawgle designs with Cursor, Claude Code, Copilot, or Codex?",
    answer:
      "Yes. The Agent Pack gives coding agents the approved screens, design tokens, assets, navigation context, and implementation instructions they need as reference inside your repository. The coding agent still implements the application in your chosen stack.",
  },
  {
    question: "Does Drawgle export editable Figma layers?",
    answer:
      "No. Drawgle currently keeps designs editable in its own visual canvas and exports standalone Tailwind HTML plus an Agent Pack. If native Figma layers are required for your workflow, Drawgle does not currently replace that part of Figma.",
  },
  {
    question: "Does Drawgle generate React Native, Flutter, SwiftUI, or Kotlin code?",
    answer:
      "Not as a production source-code export. Drawgle exports Tailwind HTML and structured implementation context rather than a finished React Native, Flutter, SwiftUI, or Kotlin application. Your developer or coding agent translates the approved design into the target framework.",
  },
  {
    question: "Is Drawgle an AI app builder or a mobile UI design tool?",
    answer:
      "Drawgle is an AI mobile UI design tool. It helps you plan, generate, edit, and hand off mobile app screens, but it does not build the backend, connect production data, or publish an app to the App Store or Google Play.",
  },
  {
    question: "Does Drawgle export a production iOS or Android app?",
    answer:
      "Drawgle does not export a finished production iOS or Android application. It exports standalone Tailwind HTML plus an Agent Pack containing screens, design tokens, assets, navigation context, and implementation instructions. Developers or coding agents use those approved design artifacts as context inside the target repository.",
  },

];

function FAQItem({
  question,
  answer,
  index,
}: {
  question: string;
  answer: string;
  index: number;
}) {
  return (
    <details className="faq-disclosure group border-b border-black/[0.09]">
      <summary className="flex cursor-pointer list-none items-center gap-4 py-5 text-left marker:content-none sm:py-6">
        <span className="w-6 shrink-0 font-mono text-[9px] tracking-[0.12em] text-black/30">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="flex-1 text-[15px] font-semibold tracking-[-0.015em] text-black sm:text-base">
          {question}
        </span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-black/[0.1] bg-white text-black/45 transition-all duration-300 group-open:rotate-45 group-open:border-[#1b7fcc]/30 group-open:text-[#1b7fcc]">
          <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
        </span>
      </summary>
      <div className="overflow-hidden">
        <p className="max-w-2xl pb-6 pl-10 pr-10 text-sm leading-6 text-black/55 sm:pb-7 sm:text-[15px]">
          {answer}
        </p>
      </div>
    </details>
  );
}

export default function FAQSection() {
  const faqColumnBreak = Math.ceil(homeFaqs.length / 2);

  return (
    <section className="relative overflow-hidden border-y border-black/[0.07] bg-[#f8f8f6] px-4 py-20 sm:px-6 sm:py-28">
   

      <div className="relative mx-auto max-w-6xl">
        <div className="grid gap-10 border-b border-black/[0.09] pb-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-end lg:gap-16 lg:pb-14">
          <div>
            <div className="mb-4 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#1b7fcc]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1b7fcc]" />
              Questions, answered
            </div>
            <h2 className="max-w-xl font-pixel-square text-[34px] font-semibold leading-[1.05] tracking-tight text-black sm:text-5xl">
              Questions about mobile
              <span className="block text-[#1b7fcc]">app UI design.</span>
            </h2>
          </div>

          <div className="max-w-xl lg:justify-self-end">
            <p className="text-sm leading-6 text-black/55 sm:text-base sm:leading-7">
              How prompts, screenshots, visual references, editing, shared design tokens, multi-screen flows, and developer exports work in Drawgle.
            </p>
            <a
              href="mailto:support@drawgle.com"
              className="group mt-5 inline-flex items-center gap-2 text-sm font-semibold text-black transition-colors hover:text-[#1b7fcc]"
            >
              Still have a question?
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 lg:gap-x-14">
          <div>
            {homeFaqs.slice(0, faqColumnBreak).map((faq, index) => (
              <FAQItem key={faq.question} {...faq} index={index} />
            ))}
          </div>
          <div>
            {homeFaqs.slice(faqColumnBreak).map((faq, index) => (
              <FAQItem key={faq.question} {...faq} index={index + faqColumnBreak} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
