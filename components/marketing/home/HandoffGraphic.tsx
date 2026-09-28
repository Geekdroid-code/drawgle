"use client";

import { useMemo, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bot, Check, Clipboard, Code2, Download, FileText, FolderArchive, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { EASE, usePlayback, useSequence, useTypedText } from "../motion/hooks";
import { Caret, Cursor } from "../motion/primitives";
import { ScaledStage } from "../motion/Stage";

type HandoffStep = {
  d: number;
  cursor?: string;
  press?: boolean;
  packing?: boolean;
  packed?: boolean;
  copied?: boolean;
  terminal?: "idle" | "typing" | "running" | "done";
};

const steps: HandoffStep[] = [
  { d: 900 },
  { d: 800, cursor: "pack" },
  { d: 400, cursor: "pack", press: true, packing: true },
  { d: 2300, packing: true },
  { d: 900, packed: true },
  { d: 750, packed: true, cursor: "instruction" },
  { d: 420, packed: true, cursor: "instruction", press: true, copied: true },
  { d: 2500, packed: true, copied: true, terminal: "typing" },
  { d: 3900, packed: true, copied: true, terminal: "running" },
  { d: 2800, packed: true, copied: true, terminal: "done" },
];

const packFiles = [
  ".drawgle/handoff.md",
  ".drawgle/design.md",
  ".drawgle/design-tokens.json",
  ".drawgle/design-tokens.css",
  ".drawgle/manifest.json",
  ".drawgle/navigation.html",
  ".drawgle/screens/home.html",
  ".drawgle/screens/insights.html",
  ".drawgle/screens/wallet.html",
  ".claude/skills/drawgle-ui-handoff/SKILL.md",
];

const HANDOFF_INSTRUCTION = "Read .drawgle/handoff.md and implement the Drawgle screens in this repository.";

const agentLog = [
  { text: "Read .drawgle/handoff.md, design.md, manifest.json", tone: "muted" },
  { text: "Mapped 38 design tokens → src/theme/tokens.ts", tone: "muted" },
  { text: "Shared tab bar → src/navigation/TabBar.tsx", tone: "muted" },
  { text: "Home → src/screens/HomeScreen.tsx", tone: "muted" },
  { text: "Insights → src/screens/InsightsScreen.tsx", tone: "muted" },
  { text: "Wallet → src/screens/WalletScreen.tsx", tone: "muted" },
  { text: "Typecheck and tests passed", tone: "muted" },
] as const;

function ActionCard({
  icon: Icon,
  title,
  description,
  meta,
  recommended,
  anchor,
  pressed,
  trailing,
}: {
  icon: typeof Bot;
  title: string;
  description: string;
  meta?: string;
  recommended?: boolean;
  anchor?: string;
  pressed?: boolean;
  trailing: React.ReactNode;
}) {
  return (
    <motion.div
      data-anchor={anchor}
      animate={{ scale: pressed ? 0.975 : 1 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "flex items-center gap-4 rounded-2xl border bg-white p-4 text-slate-900",
        pressed ? "border-slate-950/[0.16] bg-[#f8fafc]" : "border-slate-950/[0.07]",
      )}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-slate-950/[0.08] bg-[#f6f7f9] text-slate-700">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[16px] font-semibold leading-5 tracking-[-0.01em]">{title}</span>
          {recommended ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-emerald-700 ring-1 ring-emerald-600/10">
              Recommended
            </span>
          ) : null}
        </span>
        <span className="mt-1 block truncate text-[13px] font-medium leading-5 text-slate-500">{description}</span>
      </span>
      {meta ? <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{meta}</span> : null}
      <span className="shrink-0 text-slate-400">{trailing}</span>
    </motion.div>
  );
}

function ExportPanel({ step, stageRef, reduced }: { step: HandoffStep; stageRef: React.RefObject<HTMLDivElement | null>; reduced: boolean }) {
  const showFiles = step.packing || step.packed;

  return (
    <div className="relative h-full w-full rounded-[28px] bg-white p-5 text-slate-900 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.45)] ring-1 ring-black/[0.06]">
      <div className="flex items-start justify-between gap-3 px-1">
        <div>
          <p className="text-[22px] font-semibold tracking-[-0.03em]">Export</p>
          <p className="mt-0.5 text-[13px] font-medium text-slate-500">Calm Bank</p>
        </div>
        <span className="rounded-full bg-[#f3f4f6] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500 ring-1 ring-slate-950/[0.06]">
          HTML / Agent
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-2 rounded-[20px] bg-[#f4f5f7] p-3">
        {/* Once the pack starts, the drawer focuses on it. */}
        <motion.div
          initial={false}
          animate={{ height: showFiles ? 0 : "auto", opacity: showFiles ? 0 : 1 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="flex flex-col gap-2 overflow-hidden"
        >
          <ActionCard
            icon={Bot}
            title="Copy Designs for AI Agent"
            description="Build with Cursor, Claude Code, Codex"
            recommended
            trailing={<Clipboard className="size-5" />}
          />
          <ActionCard
            icon={Code2}
            title="Download HTML / Tailwind"
            description="Standalone source for the selected screen"
            meta="HTML"
            trailing={<Download className="size-5" />}
          />
          <div className="my-1 border-t border-slate-950/[0.06]" />
        </motion.div>
        <ActionCard
          icon={FolderArchive}
          title="Download Agent Pack"
          description="Ready screens + saved context + agent skills"
          meta="ZIP"
          anchor="pack"
          pressed={step.press && step.cursor === "pack"}
          trailing={<Download className="size-5" />}
        />
        <p className="px-3 pb-1 text-[12px] text-slate-500">Included: Home, Insights, Wallet.</p>

        <AnimatePresence initial={false}>
          {showFiles ? (
            <motion.div
              key="files"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="overflow-hidden"
            >
              <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-950/[0.06]">
                <div className="mb-2 flex items-center justify-between font-mono text-[11px] text-slate-400">
                  <span>calm-bank-agent-pack.zip</span>
                  <span>{step.packed ? "184 KB" : "packing…"}</span>
                </div>
                <ul className="space-y-[3px] font-mono text-[12px] leading-[18px] text-slate-600">
                  {packFiles.map((file, index) => (
                    <motion.li
                      key={file}
                      initial={reduced ? false : { opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.25, delay: reduced || step.packed ? 0 : 0.15 + index * 0.18, ease: EASE }}
                      className="flex items-center gap-2"
                    >
                      <Check className="size-3 shrink-0 text-emerald-600" strokeWidth={3} />
                      <span className="truncate">{file}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {step.packed ? (
            <motion.div
              key="instruction"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
            >
              <motion.div
                data-anchor="instruction"
                animate={{ scale: step.press && step.cursor === "instruction" ? 0.975 : 1 }}
                className="flex w-full items-center gap-2 rounded-2xl border border-emerald-600/10 bg-emerald-50 px-3 py-3 text-[12px] font-semibold leading-5 text-emerald-800"
              >
                {step.copied ? <Check className="size-4 shrink-0" /> : <Clipboard className="size-4 shrink-0" />}
                <span className="min-w-0 flex-1">{step.copied ? "Instruction copied" : "Copy instruction for your agent"}</span>
                <Sparkles className="size-3.5 shrink-0 opacity-60" />
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <Cursor stageRef={stageRef} target={step.cursor ?? null} pressed={Boolean(step.press)} hidden={!step.cursor || reduced} from={{ x: 520, y: 600 }} nudge={{ x: 40, y: 6 }} />
    </div>
  );
}

function AgentTerminal({ step, playing, reduced, loopKey }: { step: HandoffStep; playing: boolean; reduced: boolean; loopKey: number }) {
  const typingActive = step.terminal === "typing";
  const { typed } = useTypedText(HANDOFF_INSTRUCTION, playing && typingActive, loopKey, 26);
  const prompt = reduced || step.terminal === "running" || step.terminal === "done" ? HANDOFF_INSTRUCTION : typed;
  const showLog = step.terminal === "running" || step.terminal === "done";

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-[28px] bg-[#0c0d10] text-[#d8dbe3] shadow-[0_40px_90px_-40px_rgba(15,23,42,0.7)] ring-1 ring-white/[0.06]">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-3.5">
        <span className="size-3 rounded-full bg-[#ff5f57]" />
        <span className="size-3 rounded-full bg-[#febc2e]" />
        <span className="size-3 rounded-full bg-[#28c840]" />
        <span className="ml-3 font-mono text-[12px] text-white/40">~/calm-bank — coding agent</span>
        <span className="ml-auto flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 font-mono text-[11px] text-white/50">
          <FileText className="size-3" /> .drawgle/
        </span>
      </div>

      <div className="flex-1 px-5 py-5 font-mono text-[13px] leading-[22px]">
        <div className="text-white/35">~/calm-bank <span className="text-[#8fb0ff]">main</span></div>
        <div className="mt-1 flex gap-2">
          <span className="text-[#8fb0ff]">❯</span>
          <span className="min-h-[44px] text-white">
            {step.terminal && step.terminal !== "idle" ? prompt : <span className="text-white/30">Paste the instruction from Drawgle…</span>}
            {typingActive ? <Caret className="bg-white" /> : null}
          </span>
        </div>

        <div className="mt-4 space-y-1.5">
          {agentLog.map((line, index) => (
            <motion.div
              key={line.text}
              initial={false}
              animate={{ opacity: showLog ? 1 : 0, y: showLog ? 0 : 4 }}
              transition={{ duration: 0.3, delay: showLog && step.terminal === "running" && !reduced ? 0.2 + index * 0.45 : 0, ease: EASE }}
              className="flex items-start gap-2.5"
            >
              <span className="mt-[8px] size-1.5 shrink-0 rounded-full bg-[#8fb0ff]" />
              <span className="text-white/70">{line.text}</span>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={false}
          animate={{ opacity: step.terminal === "done" ? 1 : 0, y: step.terminal === "done" ? 0 : 6 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="mt-4 flex items-center gap-2.5 rounded-xl bg-emerald-400/10 px-3 py-2 text-emerald-300 ring-1 ring-emerald-400/15"
        >
          <Check className="size-4" strokeWidth={3} />
          3 screens implemented with your design tokens
        </motion.div>
      </div>

      <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3 font-mono text-[11px] text-white/35">
        <span>Works with Cursor · Claude Code · Copilot · Codex</span>
        <span className="text-white/25">your repo · your stack</span>
      </div>
    </div>
  );
}

export function HandoffGraphic() {
  const rootRef = useRef<HTMLDivElement>(null);
  const exportStageRef = useRef<HTMLDivElement>(null);
  const { playing, reduced } = usePlayback(rootRef, 0.3);
  const durations = useMemo(() => steps.map((step) => step.d), []);
  const [index] = useSequence(durations, playing);
  const current = reduced ? steps.length - 1 : index;
  const step = steps[current];
  const loopKey = index === 0 ? 0 : 1;

  return (
    <div ref={rootRef} aria-hidden="true" className="grid gap-5 lg:grid-cols-[520fr_600fr] lg:gap-6">
      <ScaledStage width={520} height={600} innerRef={exportStageRef}>
        <ExportPanel step={step} stageRef={exportStageRef} reduced={reduced} />
      </ScaledStage>
      <ScaledStage width={600} height={600}>
        <AgentTerminal step={step} playing={playing} reduced={reduced} loopKey={loopKey} />
      </ScaledStage>
    </div>
  );
}
