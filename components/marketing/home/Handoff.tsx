import { Code2, FolderArchive, GitBranch } from "lucide-react";

import { Reveal, SectionHeader } from "@/components/marketing/Reveal";
import { HandoffGraphic } from "./HandoffGraphic";

const outputs = [
  {
    icon: Code2,
    title: "Tailwind HTML per screen",
    description: "Standalone source you can open, review, and reuse anywhere.",
  },
  {
    icon: FolderArchive,
    title: "An Agent Pack for your repo",
    description: "Screens, design tokens, shared navigation, a manifest, Design.md, and agent skills.",
  },
  {
    icon: GitBranch,
    title: "Built in your stack",
    description: "Cursor, Claude Code, Copilot, or Codex implements it with your framework and conventions.",
  },
];

export function Handoff() {
  return (
    <section id="handoff" className="relative scroll-mt-24 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeader
          kicker="Developer handoff"
          lead="Hand it to your coding agent,"
          emphasis="with every design decision attached."
          breakBeforeEmphasis
          description="Export standalone Tailwind HTML, or an Agent Pack your coding agent reads inside the repository. Drawgle designs and hands off. Your agent writes the production code."
        />

        <Reveal y={30} className="mk-surface rounded-[36px] p-3 sm:p-5 md:p-6">
          <HandoffGraphic />
        </Reveal>

        <div className="mt-8 grid gap-6 sm:mt-10 sm:grid-cols-3 sm:gap-8">
          {outputs.map(({ icon: Icon, title, description }, index) => (
            <Reveal key={title} delay={0.1 * index} y={16} className="flex gap-3.5">
              <span className="mk-surface flex size-9 shrink-0 items-center justify-center rounded-xl">
                <Icon className="size-4 text-mk-accent" />
              </span>
              <div>
                <h3 className="text-[15px] font-semibold tracking-tight text-mk-ink">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-neutral-500">{description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
