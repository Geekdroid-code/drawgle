"use client";

import { useMemo, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, Check, ImagePlus, Paperclip, Plus, Sparkles } from "lucide-react";

import { AgentThinkingIndicator } from "@/components/AgentBall";
import { DrawgleLogo } from "@/components/DrawgleLogo";
import { cn } from "@/lib/utils";
import { AppFrame, HomeScreen, InsightsScreen, StatusBar, TransferScreen, WalletScreen, calmTheme } from "../motion/demo-app";
import { EASE, usePlayback, useSequence, useTypedText } from "../motion/hooks";
import { Caret, Cursor, HoverOutline, PrecisionFrame, StatusChip } from "../motion/primitives";
import { ScaledStage } from "../motion/Stage";

type Step<T> = T & { d: number };

function useSteps<T>(steps: Step<T>[], playing: boolean, reduced: boolean, staticIndex: number) {
  const durations = useMemo(() => steps.map((step) => step.d), [steps]);
  const [index] = useSequence(durations, playing);
  const current = reduced ? staticIndex : index;
  return { index: current, step: steps[current] };
}

/* ───────────────────────── 1 · Describe ───────────────────────── */

type DescribeStep = {
  typing?: boolean;
  attached?: boolean;
  cursor?: string;
  press?: boolean;
  phase?: "compose" | "plan" | "q1" | "q2" | "done";
};

const DESCRIBE_PROMPT = "A calm banking app with cards & spending insights";

const describeSteps: Step<DescribeStep>[] = [
  { d: 700, phase: "compose" },
  { d: 2100, phase: "compose", typing: true },
  { d: 750, phase: "compose", cursor: "attach" },
  { d: 380, phase: "compose", cursor: "attach", press: true },
  { d: 800, phase: "compose", attached: true, cursor: "send" },
  { d: 380, phase: "compose", attached: true, cursor: "send", press: true },
  { d: 1500, phase: "plan", attached: true },
  { d: 900, phase: "q1", attached: true, cursor: "choice-0" },
  { d: 420, phase: "q1", attached: true, cursor: "choice-0", press: true },
  { d: 900, phase: "q2", attached: true, cursor: "choice-0" },
  { d: 420, phase: "q2", attached: true, cursor: "choice-0", press: true },
  { d: 1900, phase: "done", attached: true },
];

const questions = {
  q1: {
    index: 1,
    title: "What should Home lead with?",
    choices: [
      { label: "Balance & quick actions", detail: "Money first, one tap to send" },
      { label: "Spending insights", detail: "Charts and budgets up top" },
      { label: "Cards overview", detail: "Wallet-style card stack" },
    ],
  },
  q2: {
    index: 2,
    title: "How should it feel?",
    choices: [
      { label: "Soft, calm & rounded", detail: "Quiet surfaces, generous radius" },
      { label: "Dense & high-contrast", detail: "More data per screen" },
      { label: "Bold & expressive", detail: "Big type, saturated color" },
    ],
  },
};

export function DescribeGraphic() {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const { playing, reduced } = usePlayback(rootRef);
  const { index, step } = useSteps(describeSteps, playing, reduced, 8);
  const phase = step.phase ?? "compose";
  const composing = phase === "compose";
  const { typed } = useTypedText(DESCRIBE_PROMPT, playing && (step.typing || index > 1), index === 0 ? "reset" : "run", 36);
  const promptText = reduced || index > 1 ? DESCRIBE_PROMPT : typed;
  const question = phase === "q2" || phase === "done" ? questions.q2 : questions.q1;
  const answered = step.press || phase === "done" || (phase === "q1" && index > 8);

  return (
    <div ref={rootRef} aria-hidden="true">
      <ScaledStage width={390} height={470} innerRef={stageRef}>
        <div className="relative h-full w-full bg-white text-mk-ink">
          <StatusBar />
          <div className="flex items-center gap-2 px-5 pt-1">
            <DrawgleLogo className="size-[18px] text-mk-accent" />
            <span className="text-[17px] font-semibold tracking-tight">New project</span>
            <span className="ml-auto rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-500">Planning is free</span>
          </div>

          {/* Composer */}
          <motion.div
            initial={false}
            animate={{ opacity: composing ? 1 : 0, y: composing ? 0 : -18, scale: composing ? 1 : 0.97 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="absolute inset-x-4 top-[112px]"
          >
            <div className="rounded-[24px] bg-white p-4 shadow-[0_22px_50px_-28px_rgba(15,23,42,0.45)] ring-1 ring-black/[0.08]">
              <p className="min-h-[76px] text-[18px] font-medium leading-[1.45] text-mk-ink">
                {promptText ? (
                  <>
                    {promptText}
                    {composing && index < 4 ? <Caret /> : null}
                  </>
                ) : (
                  <span className="text-neutral-400">
                    Describe the app you want to design…
                    <Caret />
                  </span>
                )}
              </p>

              <AnimatePresence>
                {step.attached ? (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35, ease: EASE }}
                    className="mb-3 flex items-center gap-2.5 rounded-[14px] bg-neutral-50 p-2 ring-1 ring-black/[0.05]"
                  >
                    <span className="h-11 w-8 overflow-hidden rounded-[7px] bg-[linear-gradient(160deg,#1b1916,#3b2a1c)] p-1">
                      <span className="block h-2 w-full rounded-sm bg-[#c98b51]/80" />
                      <span className="mt-1 block h-4 w-full rounded-sm bg-white/15" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] font-semibold">reference.png</span>
                      <span className="block text-[11px] text-neutral-400">Mood and surfaces only</span>
                    </span>
                    <span className="flex rounded-full bg-white p-0.5 text-[11px] font-semibold text-neutral-500 ring-1 ring-black/[0.06]">
                      <span className="rounded-full px-2 py-1">Image to UI</span>
                      <span className="rounded-full bg-mk-ink px-2 py-1 text-white">Style Ref</span>
                    </span>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <div className="flex items-center justify-between border-t border-black/[0.05] pt-3">
                <span
                  data-anchor="attach"
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
                    step.attached ? "bg-mk-accent/10 text-mk-accent" : "text-neutral-500",
                  )}
                >
                  <Paperclip className="size-4" />
                  Attach
                </span>
                <motion.span
                  data-anchor="send"
                  animate={{ scale: step.press && step.cursor === "send" ? 0.88 : 1 }}
                  className="flex size-9 items-center justify-center rounded-full bg-mk-accent text-white"
                >
                  <ArrowUp className="size-[18px]" strokeWidth={2.5} />
                </motion.span>
              </div>
            </div>
          </motion.div>

          {/* Conversation */}
          <motion.div
            initial={false}
            animate={{ opacity: composing ? 0 : 1, y: composing ? 20 : 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: composing ? 0 : 0.1 }}
            className="absolute inset-x-4 top-[104px]"
          >
            <div className="ml-auto max-w-[82%] rounded-[20px] rounded-tr-[6px] bg-mk-accent/[0.08] px-4 py-3 text-[14px] font-medium leading-snug text-[#1f3a9e]">
              {DESCRIBE_PROMPT}
              <span className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-mk-accent/80">
                <ImagePlus className="size-3.5" /> reference.png · Style Ref
              </span>
            </div>

            <div className="mt-4 min-h-[260px]">
              <AnimatePresence mode="wait">
                {phase === "plan" ? (
                  <motion.div
                    key="plan"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.35, ease: EASE }}
                    className="flex items-center gap-3 rounded-[18px] bg-neutral-50 px-4 py-4 text-[15px] text-neutral-500 ring-1 ring-black/[0.04]"
                  >
                    <AgentThinkingIndicator label="Planning your screens…" className="[&_span]:text-[14px] [&_svg]:size-5 [&_svg]:text-mk-accent" />
                  </motion.div>
                ) : phase === "done" ? (
                  <motion.div
                    key="done"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4, ease: EASE }}
                    className="rounded-[20px] bg-white p-4 ring-1 ring-black/[0.09]"
                  >
                    <p className="text-[12px] font-medium text-neutral-500">Ready for your approval</p>
                    <p className="mt-0.5 text-[16px] font-semibold">Your screen flow</p>
                    <ol className="mt-3 divide-y divide-black/[0.06] border-y border-black/[0.06] text-[14px] font-medium">
                      {["Home", "Insights", "Wallet"].map((name, i) => (
                        <motion.li
                          key={name}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.12 + i * 0.12, duration: 0.35, ease: EASE }}
                          className="flex items-center gap-2 py-2.5"
                        >
                          <span className="font-mono text-[12px] text-neutral-400">0{i + 1}</span>
                          {name}
                        </motion.li>
                      ))}
                    </ol>
                    <div className="mt-3 rounded-full bg-mk-ink py-2.5 text-center text-[13px] font-semibold text-white">Approve & generate</div>
                  </motion.div>
                ) : (
                  <motion.div
                    key={question.title}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.38, ease: EASE }}
                    className="rounded-[20px] bg-white p-4 shadow-[0_8px_28px_-18px_rgba(15,23,42,0.3)] ring-1 ring-black/[0.09]"
                  >
                    <div className="mb-1.5 flex items-center justify-between text-[12px] text-neutral-500">
                      <span>Shape your screens · Optional</span>
                      <span className="font-mono tabular-nums">{question.index} / 3</span>
                    </div>
                    <div className="mb-3 flex gap-1">
                      {[1, 2, 3].map((segment) => (
                        <span key={segment} className={cn("h-0.5 flex-1 rounded-full", segment <= question.index ? "bg-mk-ink" : "bg-neutral-200")} />
                      ))}
                    </div>
                    <p className="text-[16px] font-semibold leading-snug">{question.title}</p>
                    <div className="mt-3 divide-y divide-black/[0.06] overflow-hidden rounded-[14px] bg-black/[0.025] ring-1 ring-black/[0.05]">
                      {question.choices.map((choice, choiceIndex) => {
                        const chosen = choiceIndex === 0 && answered;
                        return (
                          <div
                            key={choice.label}
                            data-anchor={`choice-${choiceIndex}`}
                            className={cn("flex items-center gap-3 px-3.5 py-2.5 transition-colors", chosen && "bg-white")}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 text-[13px] font-semibold">
                                {choice.label}
                                {choiceIndex === 0 ? (
                                  <span className="rounded bg-mk-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-mk-accent">Recommended</span>
                                ) : null}
                              </div>
                              <div className="text-[11px] text-neutral-500">{choice.detail}</div>
                            </div>
                            <span
                              className={cn(
                                "flex size-5 items-center justify-center rounded-full border transition-all",
                                chosen ? "border-mk-accent bg-mk-accent text-white" : "border-neutral-300 text-transparent",
                              )}
                            >
                              <Check className="size-3" strokeWidth={3} />
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          <Cursor stageRef={stageRef} target={step.cursor ?? null} pressed={Boolean(step.press)} hidden={!step.cursor || reduced} from={{ x: 400, y: 480 }} />
        </div>
      </ScaledStage>
    </div>
  );
}

/* ───────────────────────── 2 · Generate ───────────────────────── */

type GenerateStep = { screen: number; built: number; overview?: boolean };

function buildGenerateSteps(): Step<GenerateStep>[] {
  const steps: Step<GenerateStep>[] = [];
  for (let screen = 0; screen < 3; screen += 1) {
    steps.push({ d: screen === 0 ? 650 : 550, screen, built: 0 });
    for (let built = 1; built <= 5; built += 1) steps.push({ d: built === 5 ? 900 : 300, screen, built });
  }
  steps.push({ d: 2800, screen: 2, built: 5, overview: true });
  return steps;
}

const generateSteps = buildGenerateSteps();
const screenNames = ["Home", "Insights", "Wallet"];

export function GenerateGraphic() {
  const rootRef = useRef<HTMLDivElement>(null);
  const { playing, reduced } = usePlayback(rootRef);
  const { step } = useSteps(generateSteps, playing, reduced, generateSteps.length - 1);
  const builtFor = (screen: number) => (step.overview ? 5 : screen < step.screen ? 5 : screen === step.screen ? step.built : 0);
  const ready = Boolean(step.overview);

  const gap = 60;
  const stripScale = 390 / (390 * 3 + gap * 2 + 80);
  const stripX = step.overview ? 40 * stripScale : -step.screen * (390 + gap);

  return (
    <div ref={rootRef} aria-hidden="true">
      <ScaledStage width={390} height={470}>
        <div className="relative h-full w-full overflow-hidden bg-[#f6f7f9]">
          <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(15,23,42,0.12)_1px,transparent_1px)] [background-size:18px_18px]" />

          <motion.div
            className="absolute left-0 top-0 flex origin-top-left"
            style={{ gap }}
            initial={false}
            animate={{
              x: stripX,
              y: step.overview ? 470 / 2 - (844 * stripScale) / 2 - 18 : 0,
              scale: step.overview ? stripScale : 1,
            }}
            transition={{ duration: step.overview ? 1.1 : 0.7, ease: EASE }}
          >
            {[HomeScreen, InsightsScreen, WalletScreen].map((Screen, screen) => (
              <div
                key={screenNames[screen]}
                className={cn(
                  "relative h-[844px] w-[390px] shrink-0 overflow-hidden bg-white transition-[border-radius,box-shadow] duration-700",
                  step.overview && "rounded-[56px] shadow-[0_40px_80px_-30px_rgba(15,23,42,0.45)] ring-[10px] ring-[#e6e7ea]",
                )}
              >
                <AppFrame theme={calmTheme}>
                  <Screen built={builtFor(screen)} />
                </AppFrame>
              </div>
            ))}
          </motion.div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white via-white/70 to-transparent transition-opacity duration-500" style={{ opacity: ready ? 0 : 1 }} />
          <div className="absolute inset-x-0 bottom-5 flex justify-center">
            <AnimatePresence mode="wait">
              {ready ? (
                <motion.div
                  key="ready"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: EASE }}
                >
                  <StatusChip tone="dark" icon={<Check className="size-3.5 text-emerald-400" strokeWidth={3} />}>
                    3 connected screens · one design system
                  </StatusChip>
                </motion.div>
              ) : (
                <motion.div
                  key={`gen-${step.screen}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="flex items-center gap-2.5 rounded-full bg-mk-ink py-2 pl-3 pr-4 text-[13px] font-semibold text-white shadow-[0_14px_34px_-16px_rgba(15,23,42,0.8)]"
                >
                  <DrawgleLogo className="mk-spin size-4 text-[#8fb0ff]" />
                  Generating {screenNames[step.screen]}
                  <span className="font-mono text-[12px] text-white/50">{step.screen + 1}/3</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </ScaledStage>
    </div>
  );
}

/* ───────────────────────── 3 · Refine ───────────────────────── */

type RefineStep = {
  cursor?: string;
  press?: boolean;
  hover?: boolean;
  selected?: boolean;
  prompt?: "typing" | "sent" | "working";
  applied?: boolean;
  pushed?: boolean;
  out?: boolean;
};

const REFINE_PROMPT = "Make it deep blue with a soft glow";

const refineSteps: Step<RefineStep>[] = [
  { d: 700 },
  { d: 800, cursor: "balance", hover: true },
  { d: 420, cursor: "balance", hover: true, press: true, selected: true },
  { d: 1700, cursor: "balance", selected: true, prompt: "typing" },
  { d: 380, cursor: "edit-send", selected: true, prompt: "sent", press: true },
  { d: 1300, selected: true, prompt: "working" },
  { d: 1700, selected: true, applied: true },
  { d: 800, applied: true, cursor: "new-screen" },
  { d: 380, applied: true, cursor: "new-screen", press: true },
  { d: 2200, applied: true, pushed: true },
  { d: 420, applied: true, pushed: true, out: true },
  // Reset underneath the cover so the next loop starts clean.
  { d: 750, out: true },
];

export function RefineGraphic() {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const { playing, reduced } = usePlayback(rootRef);
  const { index, step } = useSteps(refineSteps, playing, reduced, 6);
  const { typed } = useTypedText(REFINE_PROMPT, playing && step.prompt === "typing", index <= 2 ? "reset" : "run", 34);
  const promptText = reduced || (step.prompt && step.prompt !== "typing") ? REFINE_PROMPT : typed;

  return (
    <div ref={rootRef} aria-hidden="true">
      <ScaledStage width={390} height={470} innerRef={stageRef}>
        <div className="relative h-full w-full overflow-hidden bg-white">
          <motion.div
            className="absolute inset-x-0 top-0 h-[844px]"
            initial={false}
            animate={{ x: step.pushed ? -120 : 0, opacity: step.pushed ? 0.6 : 1 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <AppFrame theme={calmTheme}>
              <HomeScreen
                balanceVariant={step.applied ? "deep" : "default"}
                overlays={{
                  balance: (
                    <>
                      <HoverOutline show={Boolean(step.hover) && !step.selected} />
                      <PrecisionFrame
                        show={Boolean(step.selected)}
                        label={step.applied ? "Total balance" : "selected"}
                        detail={step.applied ? "updated" : "card"}
                      />
                      {step.prompt === "working" ? (
                        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[var(--app-radius)]">
                          <div className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/70 to-transparent [animation:mk-sheen_1.1s_var(--ease-mk)_infinite]" />
                        </div>
                      ) : null}
                    </>
                  ),
                }}
              />
            </AppFrame>
          </motion.div>

          {/* Scoped edit composer, anchored under the selection */}
          <AnimatePresence>
            {step.prompt ? (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.35, ease: EASE }}
                className="absolute inset-x-5 top-[318px] z-50 rounded-[18px] bg-white p-3 shadow-[0_24px_50px_-20px_rgba(15,23,42,0.5)] ring-1 ring-black/[0.08]"
              >
                {step.prompt === "working" ? (
                  <div className="flex h-9 items-center px-1 text-neutral-500">
                    <AgentThinkingIndicator label="Editing the selection…" className="[&_span]:text-[13px] [&_svg]:size-4 [&_svg]:text-mk-accent" />
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 shrink-0 text-mk-accent" />
                    <p className="min-w-0 flex-1 truncate text-[14px] font-medium">
                      {promptText}
                      {step.prompt === "typing" ? <Caret /> : null}
                    </p>
                    <motion.span
                      data-anchor="edit-send"
                      animate={{ scale: step.press ? 0.86 : 1 }}
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-mk-accent text-white"
                    >
                      <ArrowUp className="size-4" strokeWidth={2.5} />
                    </motion.span>
                  </div>
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Confirmation + keep building */}
          <AnimatePresence>
            {step.applied && !step.pushed ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="absolute inset-x-5 top-[322px] z-50 flex flex-col items-start gap-2.5"
              >
                <StatusChip tone="success" icon={<Check className="size-3.5" strokeWidth={3} />}>
                  Only the selection changed
                </StatusChip>
                <motion.span
                  data-anchor="new-screen"
                  animate={{ scale: step.press ? 0.94 : 1 }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-mk-ink px-3.5 py-2 text-[12px] font-semibold text-white"
                >
                  <Plus className="size-3.5" strokeWidth={2.6} />
                  Add a send-money screen
                </motion.span>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* New screen pushed in, same system */}
          <motion.div
            className="absolute inset-x-0 top-0 z-[60] h-[844px] shadow-[-30px_0_60px_-30px_rgba(15,23,42,0.45)]"
            initial={false}
            animate={{ x: step.pushed ? 0 : 420 }}
            transition={{ duration: 0.65, ease: EASE }}
          >
            <AppFrame theme={calmTheme}>
              <TransferScreen />
            </AppFrame>
            <div className="absolute inset-x-0 top-[236px] flex justify-center">
              <StatusChip tone="dark" icon={<Sparkles className="size-3.5 text-[#8fb0ff]" />}>
                New screen · same tokens & navigation
              </StatusChip>
            </div>
          </motion.div>

          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 top-[54px] z-[70] bg-white"
            initial={false}
            animate={{ opacity: step.out ? 1 : 0 }}
            transition={{ duration: 0.35, ease: EASE }}
          />
          <Cursor stageRef={stageRef} target={step.cursor ?? null} pressed={Boolean(step.press)} hidden={!step.cursor || reduced} from={{ x: 400, y: 470 }} />
        </div>
      </ScaledStage>
    </div>
  );
}
