import { ArrowUpRight, Plus } from "lucide-react";

const faqs = [
  {
    question: "What does Drawgle actually create?",
    answer:
      "Drawgle turns a plain-language brief into polished, editable mobile app screens. It can design individual screens or a connected multi-screen product while keeping the same visual language throughout.",
  },
  {
    question: "Can I start from an existing screenshot?",
    answer:
      "Yes. Upload a UI screenshot and Drawgle can rebuild its structure as an editable screen. You can then change the content, visual direction, components, and layout instead of being stuck with a flat image.",
  },
  {
    question: "Can I use another interface only as a style reference?",
    answer:
      "Yes. A style reference transfers the visual qualities you like, such as typography, spacing, surfaces, color mood, and component treatment, without copying the original product or its features.",
  },
  {
    question: "Will all of my app screens look consistent?",
    answer:
      "That is a core part of Drawgle. Your project keeps a shared design system, navigation model, product context, and visual direction so new screens feel like they belong to the same app.",
  },
  {
    question: "Can I change one part without regenerating everything?",
    answer:
      "Yes. Select a card, button, section, image, or navigation element and describe the exact change. Drawgle refines that selection while preserving the rest of the screen.",
  },
  {
    question: "What happens when I update a design token?",
    answer:
      "Changing a shared token, such as a color, radius, spacing value, or shadow, updates every connected screen that uses it. This lets you refine the whole product without repeating the same edit screen by screen.",
  },
  {
    question: "Are the generated screens editable?",
    answer:
      "Yes. The first result is a starting point, not a flattened export. You can continue adding screens, replacing images, changing the design system, and refining individual details on the same canvas.",
  },
  {
    question: "Can I start from one of the curated designs?",
    answer:
      "Yes. Fork creates an editable copy of the complete curated project. Remix applies its reusable visual style to your own app brief, without copying the source product's features.",
  },
  {
    question: "Does Drawgle generate real app structure or disconnected mockups?",
    answer:
      "Drawgle is built for complete mobile products. It can maintain shared navigation, screen relationships, project context, and reusable visual decisions across the app rather than producing isolated pages.",
  },
  {
    question: "Do I need design or coding experience?",
    answer:
      "No. You can describe what you want in normal language and refine it visually. Drawgle handles the underlying design system and screen structure while keeping the result editable for deeper control.",
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
              Everything you need
              <span className="block text-[#1b7fcc]">before you start.</span>
            </h2>
          </div>

          <div className="max-w-xl lg:justify-self-end">
            <p className="text-sm leading-6 text-black/55 sm:text-base sm:leading-7">
              Clear answers about how Drawgle turns references, prompts, and product ideas into coherent,
              editable mobile UI.
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
            {faqs.slice(0, 5).map((faq, index) => (
              <FAQItem key={faq.question} {...faq} index={index} />
            ))}
          </div>
          <div>
            {faqs.slice(5).map((faq, index) => (
              <FAQItem key={faq.question} {...faq} index={index + 5} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
