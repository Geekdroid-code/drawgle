"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, Check, ImageUp, Redo2, Sparkles, Trash2, Undo2 } from "lucide-react";

import { AgentThinkingIndicator } from "@/components/AgentBall";
import { DrawgleLogo } from "@/components/DrawgleLogo";
import { cn } from "@/lib/utils";
import {
  AppFrame,
  GoalScreen,
  HomeScreen,
  InsightsScreen,
  TransferScreen,
  WalletScreen,
  calmTheme,
  warmDarkTheme,
  type AppTheme,
} from "../motion/demo-app";
import { EASE, useTypedText } from "../motion/hooks";
import { Caret, Cursor, HoverOutline, PrecisionFrame, StatusChip, TokenChip } from "../motion/primitives";

export const FEATURE_STAGE = { width: 390, height: 780 };

type Step<T> = T & { d: number };

export type DemoProps = {
  stageRef: RefObject<HTMLDivElement | null>;
  playing: boolean;
  reduced: boolean;
  onComplete: () => void;
};

/** Runs a demo once, then reports completion so the section can advance. */
function useDemoTimeline<T>(steps: Step<T>[], { playing, reduced, onComplete }: Omit<DemoProps, "stageRef">, staticIndex: number) {
  const [index, setIndex] = useState(0);
  const completeRef = useRef(onComplete);

  useEffect(() => {
    completeRef.current = onComplete;
  });

  useEffect(() => {
    if (!playing || reduced) return;
    const timeout = window.setTimeout(() => {
      if (index + 1 < steps.length) setIndex(index + 1);
      else completeRef.current();
    }, steps[index].d);
    return () => window.clearTimeout(timeout);
  }, [index, playing, reduced, steps]);

  const current = reduced ? staticIndex : index;
  return { index: current, step: steps[current] };
}

export function demoDuration(steps: { d: number }[]) {
  return steps.reduce((total, step) => total + step.d, 0);
}

function Screen({ theme, children }: { theme: AppTheme; children: ReactNode }) {
  return (
    <div className="absolute inset-0">
      <AppFrame theme={theme}>{children}</AppFrame>
    </div>
  );
}

/** Caption slot pinned near the top of the phone. */
function TopCaption({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[62px] z-[75] flex justify-center">
      <AnimatePresence mode="wait">
        {show ? (
          <motion.div
            key={typeof children === "string" ? children : undefined}
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function EditComposer({ show, text, typing, working, pressed, top = 318 }: { show: boolean; text: string; typing: boolean; working: boolean; pressed: boolean; top?: number }) {
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="absolute inset-x-5 z-50 rounded-[18px] bg-white p-3 shadow-[0_24px_50px_-20px_rgba(15,23,42,0.5)] ring-1 ring-black/[0.08]"
          style={{ top }}
        >
          {working ? (
            <div className="flex h-9 items-center px-1 text-neutral-500">
              <AgentThinkingIndicator label="Editing the selection…" className="[&_span]:text-[13px] [&_svg]:size-4 [&_svg]:text-mk-accent" />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 shrink-0 text-mk-accent" />
              <p className="min-w-0 flex-1 truncate text-[14px] font-medium text-mk-ink">
                {text}
                {typing ? <Caret /> : null}
              </p>
              <motion.span
                data-anchor="edit-send"
                animate={{ scale: pressed ? 0.86 : 1 }}
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-mk-accent text-white"
              >
                <ArrowUp className="size-4" strokeWidth={2.5} />
              </motion.span>
            </div>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Sheen({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-[inherit]">
      <div className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/70 to-transparent [animation:mk-sheen_1.1s_var(--ease-mk)_infinite]" />
    </div>
  );
}

/* ───────────────────────── 0 · Shared design tokens ───────────────────────── */

type TokensStep = { sheet?: boolean; cursor?: string; press?: boolean; accent?: boolean; radius?: boolean; chip?: "accent" | "radius" | "done" };

export const tokensSteps: Step<TokensStep>[] = [
  { d: 800 },
  { d: 700, sheet: true },
  { d: 750, sheet: true, cursor: "swatch-emerald" },
  { d: 380, sheet: true, cursor: "swatch-emerald", press: true, accent: true },
  { d: 1100, sheet: true, accent: true, chip: "accent" },
  { d: 750, sheet: true, accent: true, cursor: "radius-knob" },
  { d: 1100, sheet: true, accent: true, cursor: "radius-knob-end", press: true, radius: true, chip: "radius" },
  { d: 1200, sheet: true, accent: true, radius: true, chip: "done" },
  { d: 1700, accent: true, radius: true, chip: "done" },
];

const swatches = [
  { id: "blue", color: calmTheme.accent },
  { id: "emerald", color: "#0d9f6e" },
  { id: "violet", color: "#7c3aed" },
  { id: "ink", color: "#111827" },
];

export function TokensDemo(props: DemoProps) {
  const { step } = useDemoTimeline(tokensSteps, props, 7);
  const theme: AppTheme = {
    ...calmTheme,
    accent: step.accent ? "#0d9f6e" : calmTheme.accent,
    accentSoft: step.accent ? "rgb(13 159 110 / 0.14)" : calmTheme.accentSoft,
    radius: step.radius ? 28 : 18,
  };

  return (
    <>
      <Screen theme={theme}>
        <HomeScreen />
      </Screen>

      <TopCaption show={Boolean(step.chip)}>
        {step.chip === "accent" ? (
          <TokenChip name="--color-action-primary" value="#0D9F6E" swatch="#0d9f6e" />
        ) : step.chip === "radius" ? (
          <TokenChip name="--radius-card" value="28px" />
        ) : (
          <StatusChip tone="dark" icon={<Check className="size-3.5 text-emerald-400" strokeWidth={3} />}>
            Every screen updated · nothing regenerated
          </StatusChip>
        )}
      </TopCaption>

      <motion.div
        initial={false}
        animate={{ y: step.sheet ? 0 : 320 }}
        transition={{ duration: 0.55, ease: EASE }}
        className="absolute inset-x-0 bottom-0 z-[60] h-[300px] rounded-t-[30px] bg-white px-5 pt-3 text-mk-ink shadow-[0_-24px_60px_-28px_rgba(15,23,42,0.45)] ring-1 ring-black/[0.06]"
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-neutral-200" />
        <div className="mt-3 flex items-center justify-between">
          <p className="text-[17px] font-semibold tracking-tight">Design System</p>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-600/10">
            Live on 3 screens
          </span>
        </div>
        <div className="mt-3 flex justify-between rounded-[16px] bg-neutral-50 px-5 py-2.5 ring-1 ring-black/[0.04]">
          {[HomeScreen, InsightsScreen, WalletScreen].map((ScreenComponent, index) => (
            <div key={index} className="relative h-[100px] w-[78px] overflow-hidden rounded-[12px] bg-white shadow-[0_8px_18px_-10px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.08]">
              <div className="absolute left-0 top-0 h-[844px] w-[390px] origin-top-left" style={{ transform: "scale(0.2)" }}>
                <AppFrame theme={theme}>
                  <ScreenComponent />
                </AppFrame>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-[14px] font-medium">Primary action</span>
          <div className="flex items-center gap-2.5">
            {swatches.map((swatch) => {
              const selected = step.accent ? swatch.id === "emerald" : swatch.id === "blue";
              return (
                <span
                  key={swatch.id}
                  data-anchor={`swatch-${swatch.id}`}
                  className={cn("size-7 rounded-full ring-offset-2 transition-shadow duration-300", selected && "ring-2")}
                  style={{ backgroundColor: swatch.color, ["--tw-ring-color" as string]: swatch.color }}
                />
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          <span className="text-[14px] font-medium">Card radius</span>
          <div className="flex items-center gap-3">
            <div className="relative h-1.5 w-[150px] rounded-full bg-neutral-200">
              <div className="absolute inset-y-0 left-0 rounded-full bg-mk-ink transition-[width] duration-[900ms] ease-mk" style={{ width: step.radius ? "70%" : "45%" }} />
              <span
                data-anchor="radius-knob"
                className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_2px_8px_rgba(15,23,42,0.3)] ring-1 ring-black/10 transition-[left] duration-[900ms] ease-mk"
                style={{ left: step.radius ? "70%" : "45%" }}
              />
              <span data-anchor="radius-knob-end" className="absolute top-1/2 size-1 -translate-y-1/2" style={{ left: "70%" }} />
            </div>
            <span className="w-11 text-right font-mono text-[13px] font-semibold tabular-nums">{step.radius ? "28px" : "18px"}</span>
          </div>
        </div>
      </motion.div>

      <Cursor stageRef={props.stageRef} target={step.cursor ?? null} pressed={Boolean(step.press)} hidden={!step.cursor || props.reduced} from={{ x: 420, y: 820 }} />
    </>
  );
}

/* ───────────────────────── 1 · Selected element edit ───────────────────────── */

type SelectStep = { cursor?: string; press?: boolean; hover?: boolean; selected?: boolean; prompt?: "typing" | "sent" | "working"; applied?: boolean };

const SELECT_PROMPT = "Turn savings into a goal ring";

export const selectSteps: Step<SelectStep>[] = [
  { d: 700 },
  { d: 800, cursor: "stats", hover: true },
  { d: 420, cursor: "stats", hover: true, press: true, selected: true },
  { d: 1500, cursor: "stats", selected: true, prompt: "typing" },
  { d: 380, cursor: "edit-send", selected: true, prompt: "sent", press: true },
  { d: 1200, selected: true, prompt: "working" },
  { d: 1500, selected: true, applied: true },
  { d: 1500, applied: true },
];

export function SelectEditDemo(props: DemoProps) {
  const { index, step } = useDemoTimeline(selectSteps, props, 6);
  const { typed } = useTypedText(SELECT_PROMPT, props.playing && step.prompt === "typing", index <= 2 ? "reset" : "run", 36);
  const text = props.reduced || (step.prompt && step.prompt !== "typing") ? SELECT_PROMPT : typed;

  return (
    <>
      <Screen theme={calmTheme}>
        <HomeScreen
          savingsVariant={step.applied ? "ring" : "default"}
          overlays={{
            stats: (
              <>
                <HoverOutline show={Boolean(step.hover) && !step.selected} />
                <PrecisionFrame show={Boolean(step.selected)} label="stat tiles" detail={step.applied ? "updated" : "selected"} tagSide="bottom" />
                <Sheen show={step.prompt === "working"} />
              </>
            ),
          }}
        />
      </Screen>

      <EditComposer
        show={Boolean(step.prompt)}
        text={text}
        typing={step.prompt === "typing"}
        working={step.prompt === "working"}
        pressed={Boolean(step.press) && step.prompt === "sent"}
        top={352}
      />

      <TopCaption show={Boolean(step.applied)}>
        <StatusChip tone="success" icon={<Check className="size-3.5" strokeWidth={3} />}>
          Only this element changed
        </StatusChip>
      </TopCaption>

      <Cursor stageRef={props.stageRef} target={step.cursor ?? null} pressed={Boolean(step.press)} hidden={!step.cursor || props.reduced} from={{ x: 420, y: 820 }} />
    </>
  );
}

/* ───────────────────────── 2 · Screenshot to editable UI ───────────────────────── */

type ShotStep = { phase: "shot" | "scan" | "outlined" | "live" };

export const screenshotSteps: Step<ShotStep>[] = [
  { d: 1000, phase: "shot" },
  { d: 2300, phase: "scan" },
  { d: 1700, phase: "outlined" },
  { d: 1500, phase: "live" },
];

const SCAN_SECONDS = 2.1;
const detected = [
  { key: "header", label: "Header", y: 60 },
  { key: "balance", label: "Balance card", y: 150 },
  { key: "actions", label: "Quick actions", y: 330 },
  { key: "budget", label: "Budget list", y: 440 },
  { key: "nav", label: "Tab bar", y: 700 },
] as const;

function DetectedBox({ label, visible, delay }: { label: string; visible: boolean; delay: number }) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: visible ? 1 : 0, scale: visible ? 1 : 1.03 }}
      transition={{ duration: 0.3, delay: visible ? delay : 0, ease: EASE }}
      className="pointer-events-none absolute -inset-1.5 z-40 rounded-[inherit] border-[1.5px] border-mk-accent/80 bg-mk-accent/[0.04]"
    >
      <span className="absolute -top-[22px] left-0 rounded-[6px] bg-mk-accent px-1.5 py-0.5 font-mono text-[10px] font-medium text-white">{label}</span>
    </motion.div>
  );
}

export function ScreenshotDemo(props: DemoProps) {
  const { step } = useDemoTimeline(screenshotSteps, props, 2);
  const phase = step.phase;
  const scanning = phase === "scan";
  const revealed = phase !== "shot";
  const outlined = phase === "scan" || phase === "outlined";
  const delayFor = (y: number) => (phase === "scan" ? (y / FEATURE_STAGE.height) * SCAN_SECONDS : 0);

  const overlays = Object.fromEntries(
    detected.map((item) => [item.key, <DetectedBox key={item.key} label={item.label} visible={outlined} delay={delayFor(item.y)} />]),
  );

  return (
    <>
      <motion.div
        initial={false}
        animate={{ scale: phase === "shot" ? 0.86 : 1, borderRadius: phase === "shot" ? 28 : 0, y: phase === "shot" ? 14 : 0 }}
        transition={{ duration: 0.7, ease: EASE }}
        className="absolute inset-0 overflow-hidden bg-neutral-200 shadow-[0_30px_60px_-25px_rgba(15,23,42,0.55)]"
      >
        {/* The uploaded screenshot: flat pixels */}
        <div className="absolute inset-0 [filter:blur(1.4px)_saturate(0.8)_contrast(0.92)]">
          <AppFrame theme={calmTheme}>
            <HomeScreen />
          </AppFrame>
        </div>
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.22] mix-blend-multiply"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.5'/></svg>\")",
          }}
        />

        {/* Rebuilt, editable UI revealed by the scan */}
        <motion.div
          initial={false}
          animate={{ clipPath: revealed ? "inset(0% 0% 0% 0%)" : "inset(0% 0% 100% 0%)" }}
          transition={{ duration: revealed ? SCAN_SECONDS : 0, ease: [0.45, 0, 0.35, 1] }}
          className="absolute inset-0"
        >
          <AppFrame theme={calmTheme}>
            <HomeScreen overlays={overlays} />
          </AppFrame>
        </motion.div>

        <motion.div
          initial={false}
          animate={{ top: scanning ? "100%" : "0%", opacity: scanning ? 1 : 0 }}
          transition={{ top: { duration: scanning ? SCAN_SECONDS : 0, ease: [0.45, 0, 0.35, 1] }, opacity: { duration: 0.25 } }}
          className="pointer-events-none absolute inset-x-0 z-50 h-0"
        >
          <div className="h-[2px] w-full bg-mk-accent shadow-[0_0_18px_4px_rgba(48,93,222,0.55)]" />
          <div className="h-16 w-full -translate-y-full bg-gradient-to-t from-mk-accent/20 to-transparent" />
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {phase === "shot" ? (
          <motion.div
            key="file"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="absolute inset-x-0 top-[26px] z-[70] flex justify-center gap-2"
          >
            <StatusChip tone="light" icon={<ImageUp className="size-3.5 text-neutral-500" />}>
              screenshot.png
            </StatusChip>
            <StatusChip tone="dark">Image to UI</StatusChip>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <TopCaption show={phase === "outlined" || phase === "live"}>
        {phase === "outlined" ? (
          <StatusChip tone="dark" icon={<DrawgleLogo className="size-3.5 text-[#8fb0ff]" />}>
            5 sections rebuilt as live HTML
          </StatusChip>
        ) : (
          <StatusChip tone="success" icon={<Check className="size-3.5" strokeWidth={3} />}>
            Editable like any Drawgle screen
          </StatusChip>
        )}
      </TopCaption>
    </>
  );
}

/* ───────────────────────── 3 · Style reference ───────────────────────── */

type StyleStep = { reference?: boolean; extract?: boolean; fly?: boolean; applied?: boolean; chip?: boolean };

export const styleSteps: Step<StyleStep>[] = [
  { d: 700 },
  { d: 900, reference: true },
  { d: 1000, reference: true, extract: true },
  { d: 650, reference: true, extract: true, fly: true },
  { d: 1500, reference: true, applied: true },
  { d: 1900, applied: true, chip: true },
];

const referencePalette = ["#12100e", "#f3e8d7", "#c98b51", "#7a4b2c"];

export function StyleReferenceDemo(props: DemoProps) {
  const { step } = useDemoTimeline(styleSteps, props, 5);

  return (
    <>
      <Screen theme={step.applied ? warmDarkTheme : calmTheme}>
        <HomeScreen />
      </Screen>

      <AnimatePresence>
        {step.reference ? (
          <motion.div
            key="reference"
            initial={{ opacity: 0, x: 40, rotate: 6, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, rotate: 3, scale: 1 }}
            exit={{ opacity: 0, x: 30, scale: 0.92 }}
            transition={{ duration: 0.55, ease: EASE }}
            className="absolute right-4 top-[92px] z-[70] w-[150px] rounded-[20px] bg-white p-2 shadow-[0_30px_60px_-24px_rgba(15,23,42,0.6)] ring-1 ring-black/[0.06]"
          >
            <div className="relative h-[240px] overflow-hidden rounded-[14px] bg-[#12100e]">
              <Image
                src="/showcase-screenshots/midnight-bakery/home.webp"
                alt=""
                fill
                sizes="150px"
                className="object-cover object-top"
              />
            </div>
            <div className="mt-2 flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold text-mk-ink">Midnight Bakery</span>
              <span className="rounded-full bg-mk-ink px-2 py-0.5 text-[10px] font-semibold text-white">Style Ref</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 px-1 pb-1">
              {referencePalette.map((color, index) => (
                <motion.span
                  key={color}
                  initial={false}
                  animate={
                    step.fly
                      ? { x: -150 + index * 6, y: 60, scale: 0.4, opacity: 0 }
                      : { x: 0, y: 0, scale: step.extract ? 1 : 0, opacity: step.extract ? 1 : 0 }
                  }
                  transition={{ duration: step.fly ? 0.6 : 0.35, delay: step.fly ? index * 0.05 : index * 0.08, ease: EASE }}
                  className="size-5 rounded-full ring-1 ring-black/10"
                  style={{ backgroundColor: color }}
                />
              ))}
              <motion.span
                initial={false}
                animate={{ opacity: step.extract && !step.fly ? 1 : 0 }}
                className="ml-auto font-serif text-[13px] font-semibold text-neutral-500"
              >
                Aa
              </motion.span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <TopCaption show={Boolean(step.chip)}>
        <StatusChip tone="light">Its mood &amp; surfaces · your layout &amp; features</StatusChip>
      </TopCaption>
    </>
  );
}

/* ───────────────────────── 4 · Connected flows ───────────────────────── */

type FlowStep = { screen: number; map?: boolean };

export const flowSteps: Step<FlowStep>[] = [
  { d: 1300, screen: 0 },
  { d: 1500, screen: 1 },
  { d: 1500, screen: 2 },
  { d: 2400, screen: 2, map: true },
];

const flowNames = ["Home", "Insights", "Wallet"];

export function FlowsDemo(props: DemoProps) {
  const { step } = useDemoTimeline(flowSteps, props, 3);

  return (
    <>
      <motion.div
        className="absolute left-0 top-0 flex h-full"
        initial={false}
        animate={{ x: -step.screen * FEATURE_STAGE.width, opacity: step.map ? 0.35 : 1, filter: step.map ? "blur(2px)" : "blur(0px)" }}
        transition={{ duration: 0.7, ease: EASE }}
      >
        {[HomeScreen, InsightsScreen, WalletScreen].map((ScreenComponent, index) => (
          <div key={flowNames[index]} className="relative h-full shrink-0" style={{ width: FEATURE_STAGE.width }}>
            <AppFrame theme={calmTheme}>
              <ScreenComponent />
            </AppFrame>
          </div>
        ))}
      </motion.div>

      {/* Flow ribbon */}
      <motion.div
        initial={false}
        animate={{ opacity: step.map ? 0 : 1, y: step.map ? 8 : 0 }}
        className="absolute inset-x-0 bottom-[104px] z-[70] flex justify-center"
      >
        <div className="flex items-center gap-2 rounded-full bg-mk-ink px-3 py-2 text-[12px] font-semibold text-white/50 shadow-[0_14px_34px_-16px_rgba(15,23,42,0.8)]">
          {flowNames.map((name, index) => (
            <span key={name} className="flex items-center gap-2">
              {index > 0 ? <span className="h-px w-4 bg-white/25" /> : null}
              <span className={cn("flex items-center gap-1.5 transition-colors duration-300", index === step.screen && "text-white")}>
                <span className={cn("size-1.5 rounded-full transition-colors duration-300", index === step.screen ? "bg-[#8fb0ff]" : "bg-white/30")} />
                {name}
              </span>
            </span>
          ))}
        </div>
      </motion.div>

      {/* Flow map */}
      <AnimatePresence>
        {step.map ? (
          <motion.div
            key="map"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="absolute inset-x-5 top-[210px] z-[70] rounded-[26px] bg-white p-5 text-mk-ink shadow-[0_30px_70px_-30px_rgba(15,23,42,0.55)] ring-1 ring-black/[0.06]"
          >
            <p className="text-[12px] font-medium text-neutral-500">Screen flow</p>
            <p className="text-[17px] font-semibold tracking-tight">One product, three screens</p>
            <svg viewBox="0 0 310 90" className="mt-4 w-full" aria-hidden="true">
              <motion.path
                d="M40 45 C 90 45, 100 20, 155 20 S 220 70, 270 45"
                fill="none"
                stroke="#305dde"
                strokeWidth="2"
                strokeDasharray="4 5"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.9, delay: 0.2, ease: EASE }}
              />
              {[40, 155, 270].map((x, index) => (
                <g key={x}>
                  <circle cx={x} cy={index === 1 ? 20 : 45} r="7" fill="#fff" stroke="#305dde" strokeWidth="2" />
                  <circle cx={x} cy={index === 1 ? 20 : 45} r="3" fill="#305dde" />
                  <text x={x} y={index === 1 ? 44 : 70} textAnchor="middle" fontSize="12" fontWeight="600" fill="#141414">
                    {flowNames[index]}
                  </text>
                </g>
              ))}
            </svg>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] font-medium">
              <span className="rounded-[12px] bg-neutral-50 px-3 py-2 ring-1 ring-black/[0.04]">Shared tab bar · 4 tabs</span>
              <span className="rounded-[12px] bg-neutral-50 px-3 py-2 ring-1 ring-black/[0.04]">Same tokens everywhere</span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

/* ───────────────────────── 5 · Product context ───────────────────────── */

type ContextStep = { chat?: boolean; chips?: boolean; thinking?: boolean; pushed?: boolean; chip?: boolean };

export const contextSteps: Step<ContextStep>[] = [
  { d: 700 },
  { d: 900, chat: true },
  { d: 1700, chat: true, chips: true },
  { d: 1100, chat: true, chips: true, thinking: true },
  { d: 700, pushed: true },
  { d: 2000, pushed: true, chip: true },
];

const memory = [
  { label: "Audience", value: "first-time savers" },
  { label: "Feel", value: "calm & rounded" },
  { label: "Navigation", value: "4 tabs" },
  { label: "Tokens", value: "approved system" },
];

export function ContextDemo(props: DemoProps) {
  const { step } = useDemoTimeline(contextSteps, props, 2);

  return (
    <>
      <motion.div className="absolute inset-0" initial={false} animate={{ x: step.pushed ? -110 : 0 }} transition={{ duration: 0.6, ease: EASE }}>
        <AppFrame theme={calmTheme}>
          <HomeScreen />
        </AppFrame>
      </motion.div>

      <motion.div
        className="absolute inset-0 z-[55] shadow-[-30px_0_60px_-30px_rgba(15,23,42,0.45)]"
        initial={false}
        animate={{ x: step.pushed ? 0 : 420 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <AppFrame theme={calmTheme}>
          <TransferScreen />
        </AppFrame>
      </motion.div>

      <motion.div
        initial={false}
        animate={{ y: step.chat ? 0 : 440 }}
        transition={{ duration: 0.55, ease: EASE }}
        className="absolute inset-x-0 bottom-0 z-[60] h-[420px] rounded-t-[30px] bg-white px-5 pt-3 text-mk-ink shadow-[0_-24px_60px_-28px_rgba(15,23,42,0.45)] ring-1 ring-black/[0.06]"
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-neutral-200" />
        <div className="mt-4 flex items-center gap-2">
          <DrawgleLogo className="size-4 text-mk-accent" />
          <span className="text-[15px] font-semibold">Drawgle</span>
          <span className="ml-auto text-[11px] font-medium text-neutral-400">Calm Bank · project chat</span>
        </div>
        <div className="ml-auto mt-4 w-fit max-w-[80%] rounded-[18px] rounded-tr-[6px] bg-mk-accent/[0.08] px-4 py-2.5 text-[14px] font-medium text-[#1f3a9e]">
          Add a screen to send money to friends
        </div>
        <p className="mt-4 text-[12px] font-medium text-neutral-500">Using what this project already knows</p>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          {memory.map((item, index) => (
            <motion.div
              key={item.label}
              initial={false}
              animate={{ opacity: step.chips ? 1 : 0.35 }}
              transition={{ duration: 0.3, delay: step.chips ? index * 0.32 : 0 }}
              className="flex items-center gap-2 rounded-[14px] bg-neutral-50 px-3 py-2.5 ring-1 ring-black/[0.05]"
            >
              <motion.span
                initial={false}
                animate={{ scale: step.chips ? 1 : 0.6, backgroundColor: step.chips ? "#305dde" : "#e5e7eb" }}
                transition={{ duration: 0.3, delay: step.chips ? index * 0.32 : 0 }}
                className="flex size-4 shrink-0 items-center justify-center rounded-full text-white"
              >
                <Check className="size-2.5" strokeWidth={3.5} />
              </motion.span>
              <span className="min-w-0">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{item.label}</span>
                <span className="block truncate text-[12px] font-semibold">{item.value}</span>
              </span>
            </motion.div>
          ))}
        </div>
        <div className="mt-4 h-10">
          {step.thinking ? (
            <div className="flex items-center rounded-[14px] bg-neutral-50 px-3 py-2.5 text-neutral-500">
              <AgentThinkingIndicator label="Designing Send money…" className="[&_span]:text-[13px] [&_svg]:size-4 [&_svg]:text-mk-accent" />
            </div>
          ) : null}
        </div>
      </motion.div>

      <TopCaption show={Boolean(step.chip)}>
        <StatusChip tone="dark" icon={<Sparkles className="size-3.5 text-[#8fb0ff]" />}>
          New screen, built with the whole story
        </StatusChip>
      </TopCaption>
    </>
  );
}

/* ───────────────────────── 6 · Replace an image ───────────────────────── */

type ImageStep = { cursor?: string; press?: boolean; hover?: boolean; selected?: boolean; menu?: boolean; upload?: boolean; replaced?: boolean };

export const imageSteps: Step<ImageStep>[] = [
  { d: 700 },
  { d: 800, cursor: "goal-image", hover: true },
  { d: 420, cursor: "goal-image", hover: true, press: true, selected: true },
  { d: 750, cursor: "replace", selected: true, menu: true },
  { d: 380, cursor: "replace", selected: true, menu: true, press: true },
  { d: 1100, selected: true, upload: true },
  { d: 1500, selected: true, replaced: true },
  { d: 1500, replaced: true },
];

export function ImageDemo(props: DemoProps) {
  const { step } = useDemoTimeline(imageSteps, props, 6);

  return (
    <>
      <Screen theme={calmTheme}>
        <GoalScreen
          art={step.replaced ? "night" : "dusk"}
          overlays={{
            image: (
              <>
                <HoverOutline show={Boolean(step.hover) && !step.selected} inset={6} />
                <PrecisionFrame show={Boolean(step.selected)} label="image" detail={step.replaced ? "replaced" : "selected"} inset={6} radius={18} tagSide="bottom" />
              </>
            ),
          }}
        />
      </Screen>

      <AnimatePresence>
        {step.menu ? (
          <motion.div
            key="menu"
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="absolute left-[118px] top-[176px] z-[70] w-[190px] rounded-[16px] bg-white p-1.5 text-[13px] font-medium text-mk-ink shadow-[0_24px_50px_-20px_rgba(15,23,42,0.55)] ring-1 ring-black/[0.08]"
          >
            <span data-anchor="replace" className={cn("flex items-center gap-2 rounded-[11px] px-2.5 py-2", step.press ? "bg-mk-accent text-white" : "bg-neutral-100")}>
              <ImageUp className="size-4" />
              Replace image
            </span>
            <span className="flex items-center gap-2 rounded-[11px] px-2.5 py-2 text-neutral-600">
              <Sparkles className="size-4" />
              Edit with a prompt
            </span>
            <span className="flex items-center gap-2 rounded-[11px] px-2.5 py-2 text-neutral-600">
              <Trash2 className="size-4" />
              Remove
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {step.upload ? (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="absolute inset-x-8 top-[150px] z-[70] rounded-[16px] bg-white p-3 shadow-[0_24px_50px_-20px_rgba(15,23,42,0.55)] ring-1 ring-black/[0.08]"
          >
            <div className="flex items-center gap-3">
              <span className="h-10 w-10 overflow-hidden rounded-[10px]">
                <svg viewBox="0 0 40 40" className="size-full" aria-hidden="true">
                  <defs>
                    <linearGradient id="thumb-night" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#0b1437" />
                      <stop offset="1" stopColor="#6a4c8f" />
                    </linearGradient>
                  </defs>
                  <rect width="40" height="40" fill="url(#thumb-night)" />
                  <circle cx="28" cy="13" r="4" fill="#fff5d1" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-mk-ink">kyoto-night.jpg</p>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-neutral-100">
                  <motion.div initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 0.9, ease: EASE }} className="h-full rounded-full bg-mk-accent" />
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <TopCaption show={Boolean(step.replaced) && !step.selected}>
        <StatusChip tone="success" icon={<Check className="size-3.5" strokeWidth={3} />}>
          Swapped in place · layout untouched
        </StatusChip>
      </TopCaption>

      <Cursor stageRef={props.stageRef} target={step.cursor ?? null} pressed={Boolean(step.press)} hidden={!step.cursor || props.reduced} from={{ x: 420, y: 820 }} />
    </>
  );
}

/* ───────────────────────── 7 · Always editable ───────────────────────── */

type EditableStep = {
  cursor?: string;
  press?: boolean;
  hover?: boolean;
  editing?: boolean;
  typing?: boolean;
  value: "original" | "edited";
  history?: boolean;
  chip?: "edited" | "undo" | "live";
};

export const editableSteps: Step<EditableStep>[] = [
  { d: 700, value: "original" },
  { d: 800, value: "original", cursor: "budget-title", hover: true },
  { d: 420, value: "original", cursor: "budget-title", press: true, editing: true },
  { d: 1200, value: "edited", cursor: "budget-title", editing: true, typing: true },
  { d: 900, value: "edited", history: true, chip: "edited" },
  { d: 750, value: "edited", history: true, cursor: "undo" },
  { d: 900, value: "original", history: true, cursor: "undo", press: true, chip: "undo" },
  { d: 700, value: "original", history: true, cursor: "redo" },
  { d: 380, value: "edited", history: true, cursor: "redo", press: true },
  { d: 1600, value: "edited", history: true, chip: "live" },
];

const EDITED_TITLE = "This month";

export function EditableDemo(props: DemoProps) {
  const { index, step } = useDemoTimeline(editableSteps, props, 9);
  const { typed } = useTypedText(EDITED_TITLE, props.playing && Boolean(step.typing), index <= 2 ? "reset" : "run", 60);
  const title = step.typing && !props.reduced ? typed : step.value === "edited" ? EDITED_TITLE : "Monthly budget";

  const budgetTitle = (
    <>
      <span className={cn("rounded-[4px] transition-colors", step.press && step.editing && "bg-mk-accent/20")}>{title}</span>
      {step.editing ? <Caret /> : null}
      <HoverOutline show={Boolean(step.hover) || Boolean(step.editing)} inset={-5} />
    </>
  );

  return (
    <>
      <Screen theme={calmTheme}>
        <HomeScreen budgetTitle={budgetTitle} />
      </Screen>

      <AnimatePresence>
        {step.history ? (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="absolute inset-x-0 top-[636px] z-[70] flex justify-center"
          >
            <div className="flex items-center gap-1 rounded-full bg-white p-1 text-mk-ink shadow-[0_18px_40px_-18px_rgba(15,23,42,0.55)] ring-1 ring-black/[0.08]">
              <motion.span
                data-anchor="undo"
                animate={{ scale: step.press && step.cursor === "undo" ? 0.88 : 1 }}
                className="flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold hover:bg-neutral-100"
              >
                <Undo2 className="size-4" /> Undo
              </motion.span>
              <span className="h-5 w-px bg-black/10" />
              <motion.span
                data-anchor="redo"
                animate={{ scale: step.press && step.cursor === "redo" ? 0.88 : 1 }}
                className="flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold"
              >
                <Redo2 className="size-4" /> Redo
              </motion.span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <TopCaption show={Boolean(step.chip)}>
        {step.chip === "edited" ? (
          <StatusChip tone="dark">Edited directly on the canvas</StatusChip>
        ) : step.chip === "undo" ? (
          <StatusChip tone="light" icon={<Undo2 className="size-3.5 text-neutral-500" />}>
            Every change is reversible
          </StatusChip>
        ) : (
          <StatusChip tone="success" icon={<Check className="size-3.5" strokeWidth={3} />}>
            Live HTML, never a dead export
          </StatusChip>
        )}
      </TopCaption>

      <Cursor stageRef={props.stageRef} target={step.cursor ?? null} pressed={Boolean(step.press)} hidden={!step.cursor || props.reduced} from={{ x: 420, y: 820 }} />
    </>
  );
}

/* ───────────────────────── Registry ───────────────────────── */

export const featureDemos = [
  { Demo: TokensDemo, duration: demoDuration(tokensSteps) },
  { Demo: SelectEditDemo, duration: demoDuration(selectSteps) },
  { Demo: ScreenshotDemo, duration: demoDuration(screenshotSteps) },
  { Demo: StyleReferenceDemo, duration: demoDuration(styleSteps) },
  { Demo: FlowsDemo, duration: demoDuration(flowSteps) },
  { Demo: ContextDemo, duration: demoDuration(contextSteps) },
  { Demo: ImageDemo, duration: demoDuration(imageSteps) },
  { Demo: EditableDemo, duration: demoDuration(editableSteps) },
];

export function useFeatureDurations() {
  return useMemo(() => featureDemos.map((demo) => demo.duration), []);
}
