"use client";

import { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Bot,
  Check,
  ChevronRight,
  Clipboard,
  Code2,
  Copy,
  Download,
  FileCode2,
  FileDown,
  FolderArchive,
  Layers3,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PremiumDropdown } from "@/components/ui/premium-dropdown";
import {
  buildAgentHandoffPrompt,
  buildAgentPackZip,
  buildNativeScaffoldZip,
  buildStandaloneHtmlExport,
  resolveScreenNavigationCode,
  slugifyExportName,
  type ExportProjectContext,
  type NativeScaffoldTarget,
} from "@/lib/export-pipeline";
import { cn } from "@/lib/utils";
import type { DesignTokens, ProjectData, ProjectNavigationData, ScreenData } from "@/lib/types";

const SCAFFOLD_OPTIONS: Array<{
  id: NativeScaffoldTarget;
  label: string;
}> = [
  { id: "reactnative", label: "React Native" },
  { id: "swiftui", label: "SwiftUI" },
  { id: "compose", label: "Compose" },
  { id: "flutter", label: "Flutter" },
];

const HANDOFF_INSTRUCTION = "Read .drawgle/handoff.md and implement the Drawgle screens in this repository.";

function downloadBlob(contents: BlobPart[], type: string, filename: string) {
  const blob = new Blob(contents, { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatScreenCount(count: number) {
  return `${count} ${count === 1 ? "screen" : "screens"}`;
}

function ActionCard({
  icon: Icon,
  title,
  description,
  meta,
  recommended,
  disabled,
  selected,
  onClick,
  trailing,
  testId,
}: {
  icon: typeof Bot;
  title: string;
  description: string;
  meta?: string;
  recommended?: boolean;
  disabled?: boolean;
  selected?: boolean;
  onClick?: () => void;
  trailing?: React.ReactNode;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        if (!disabled) onClick?.();
      }}
      disabled={disabled}
      data-testid={testId}
      className={cn(
        "group flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-150",
        "border-slate-950/[0.07] bg-white text-slate-900 hover:border-slate-950/[0.12] hover:bg-[#fbfbfc]",
        "dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.07]",
        selected && "border-slate-950/[0.12] bg-[#f8fafc] dark:bg-white/[0.07]",
        disabled && "cursor-not-allowed opacity-50 hover:bg-white dark:hover:bg-white/[0.04]",
      )}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-slate-950/[0.08] bg-[#f6f7f9] text-slate-700 dark:border-white/[0.08] dark:bg-white/[0.06] dark:text-slate-200">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[17px] font-semibold leading-5 tracking-[-0.01em]">{title}</span>
          {recommended ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-emerald-700 ring-1 ring-emerald-600/10 dark:bg-emerald-400/10 dark:text-emerald-300">
              Recommended
            </span>
          ) : null}
        </span>
        <span className="mt-1 block truncate text-[13px] font-medium leading-5 text-slate-500 dark:text-slate-400">{description}</span>
      </span>
      {meta ? <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{meta}</span> : null}
      {trailing ? <span className="shrink-0 text-slate-400">{trailing}</span> : null}
    </button>
  );
}

function ScreenExportRow({
  screen,
  active,
  disabled,
  onSelect,
  onCopy,
  onDownload,
}: {
  screen: ScreenData;
  active: boolean;
  disabled?: boolean;
  onSelect: () => void;
  onCopy: () => void;
  onDownload: () => void;
}) {
  return (
    <div
      className={cn(
        "group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-4 py-3 transition-colors",
        active ? "bg-[#f5f6f8] dark:bg-white/[0.07]" : "hover:bg-[#f8f9fb] dark:hover:bg-white/[0.05]",
      )}
    >
      <button type="button" onClick={onSelect} className="min-w-0 text-left">
        <span className="block truncate text-[17px] font-semibold leading-6 tracking-[-0.01em] text-slate-900 dark:text-white">{screen.name}</span>
        <span className="mt-0.5 block text-[13px] font-medium text-slate-400 dark:text-slate-500">Mobile screen</span>
      </button>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Copy ${screen.name} for AI agent`}
          title="Copy for AI agent"
          disabled={disabled}
          onClick={onCopy}
          className="size-9 rounded-xl text-slate-500 hover:bg-white hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Download ${screen.name} HTML`}
          title="Download HTML"
          disabled={disabled}
          onClick={onDownload}
          className="size-9 rounded-xl text-slate-500 hover:bg-white hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function ExportMenu({
  trigger,
  open,
  onOpenChange,
  project,
  screens,
  initialScreenId,
  projectNavigation,
  designTokens,
  tokenCss,
  googleFontAssetLinks,
  tokenDirty,
  generationActive,
}: {
  trigger: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectData;
  screens: ScreenData[];
  initialScreenId?: string | null;
  projectNavigation?: ProjectNavigationData | null;
  designTokens?: DesignTokens | null;
  tokenCss?: string;
  googleFontAssetLinks?: string;
  tokenDirty?: boolean;
  generationActive?: boolean;
}) {
  const [activeScreenId, setActiveScreenId] = useState(initialScreenId || screens[0]?.id || "");
  const [previousOpen, setPreviousOpen] = useState(open);
  const [previousInitialScreenId, setPreviousInitialScreenId] = useState(initialScreenId);
  const [scaffoldsOpen, setScaffoldsOpen] = useState(false);
  const [scaffoldError, setScaffoldError] = useState<string | null>(null);
  const [copiedAction, setCopiedAction] = useState<string | null>(null);
  const [packDownloaded, setPackDownloaded] = useState(false);

  if (open !== previousOpen || initialScreenId !== previousInitialScreenId) {
    setPreviousOpen(open);
    setPreviousInitialScreenId(initialScreenId);
    if (open) {
      setActiveScreenId(initialScreenId || screens[0]?.id || "");
      setScaffoldsOpen(false);
      setScaffoldError(null);
      setPackDownloaded(false);
    }
  }

  const activeScreen = screens.find((screen) => screen.id === activeScreenId) || screens[0] || null;
  const context = useMemo<ExportProjectContext>(() => ({
    project,
    screens,
    projectNavigation,
    designTokens,
    tokenCss,
    googleFontAssetLinks,
  }), [designTokens, googleFontAssetLinks, project, projectNavigation, screens, tokenCss]);

  const buildScreenHtml = useCallback((screen: ScreenData) => {
    const navigationCode = resolveScreenNavigationCode(screen, projectNavigation);
    return buildStandaloneHtmlExport({
      screen,
      navigationCode,
      activeNavigationItemId: screen.navigationItemId,
      designTokens,
      tokenCss,
      googleFontAssetLinks,
    });
  }, [designTokens, googleFontAssetLinks, projectNavigation, tokenCss]);

  const activeNavigationCode = activeScreen ? resolveScreenNavigationCode(activeScreen, projectNavigation) : "";
  const agentPrompt = useMemo(
    () => activeScreen ? buildAgentHandoffPrompt({ context, screen: activeScreen, target: "auto" }) : "",
    [activeScreen, context],
  );
  const htmlExport = useMemo(
    () => activeScreen ? buildScreenHtml(activeScreen) : "",
    [activeScreen, buildScreenHtml],
  );

  const markCopied = async (key: string, value: string) => {
    await navigator.clipboard?.writeText(value).catch(() => undefined);
    setCopiedAction(key);
    window.setTimeout(() => setCopiedAction(null), 1400);
  };

  const copyScreenForAgent = (screen: ScreenData) => {
    const prompt = buildAgentHandoffPrompt({ context, screen, target: "auto" });
    void markCopied(`screen:${screen.id}`, prompt);
  };

  const downloadScreenHtml = (screen: ScreenData) => {
    downloadBlob([buildScreenHtml(screen)], "text/html;charset=utf-8", `${slugifyExportName(screen.name, "screen")}.html`);
  };

  const downloadAgentPack = () => {
    if (agentPackDisabled) return;
    const bytes = buildAgentPackZip({ context, target: "auto" });
    downloadBlob(
      [new Uint8Array(bytes)],
      "application/zip",
      `drawgle-agent-pack-${slugifyExportName(project.name, "project")}.zip`,
    );
    setPackDownloaded(true);
  };

  const downloadScaffold = (target: NativeScaffoldTarget) => {
    if (!activeScreen) return;
    const result = buildNativeScaffoldZip({
      screen: activeScreen,
      target,
      navigationCode: activeNavigationCode,
      designTokens,
      tokenCss,
    });
    if (result.error || !result.bytes) {
      setScaffoldError(result.error || "This native scaffold could not be generated.");
      return;
    }
    setScaffoldError(null);
    downloadBlob(
      [new Uint8Array(result.bytes)],
      "application/zip",
      `drawgle-${target}-${slugifyExportName(activeScreen.name, "screen")}-scaffold.zip`,
    );
  };

  const screenName = activeScreen?.name || "Screen";
  const screenSlug = slugifyExportName(screenName, "screen");
  const selectedScreenBlockedReason = tokenDirty
    ? "Save or discard design token changes before exporting."
    : activeScreen?.status === "building"
    ? "This screen is still building."
    : null;
  const agentPackBlockedReason = tokenDirty ? "Save or discard design token changes before exporting." : null;
  const selectedActionsDisabled = !!selectedScreenBlockedReason;
  const agentPackDisabled = !!agentPackBlockedReason;
  const menuWidth = typeof window !== "undefined" ? Math.max(360, Math.min(960, window.innerWidth - 24)) : 920;
  const wideLayout = menuWidth >= 720;

  return (
    <PremiumDropdown
      open={open}
      onOpenChange={onOpenChange}
      align="end"
      side="bottom"
      width={menuWidth}
      trigger={trigger}
      menuClassName="dg-export-drawer !overflow-hidden !rounded-[22px] !border-slate-950/[0.10] !bg-white !shadow-[0_24px_80px_rgba(15,23,42,0.18)] dark:!bg-[#171717] dark:!shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
    >
      <div style={{ width: menuWidth }} className="max-h-[min(720px,calc(100dvh-32px))] overflow-y-auto p-3" data-testid="export-menu">
        <div className="mb-3 flex items-center justify-between gap-4 px-2 pt-1">
          <div className="min-w-0">
            <h2 className="truncate text-[22px] font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
              Export {formatScreenCount(screens.length)}
            </h2>
            <p className="mt-1 truncate text-[13px] font-medium text-slate-500 dark:text-slate-400">{project.name}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {generationActive ? (
              <span className="rounded-full bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-700 ring-1 ring-amber-600/10 dark:bg-amber-400/10 dark:text-amber-300">
                Building
              </span>
            ) : null}
            <span className="rounded-full bg-[#f3f4f6] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500 ring-1 ring-slate-950/[0.06] dark:bg-white/[0.06] dark:text-slate-300 dark:ring-white/[0.08]">
              HTML / Agent
            </span>
          </div>
        </div>

        <div className={cn("grid gap-3", wideLayout ? "grid-cols-[minmax(290px,0.42fr)_minmax(360px,0.58fr)]" : "grid-cols-1")}>
          <section className="rounded-[20px] bg-[#f4f5f7] p-3 dark:bg-white/[0.04]">
            <div className="space-y-2">
              {selectedScreenBlockedReason ? (
                <div className="flex items-start gap-2 rounded-2xl bg-amber-50 px-3 py-2.5 text-[12px] font-semibold leading-5 text-amber-800 dark:bg-amber-400/10 dark:text-amber-200" data-testid="selected-export-blocked">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {selectedScreenBlockedReason}
                </div>
              ) : null}
              <ActionCard
                icon={Bot}
                title={copiedAction === "agent" ? "Copied for AI Agent" : "Copy Designs for AI Agent"}
                description="Build with Cursor, Claude Code, Codex"
                recommended
                onClick={() => void markCopied("agent", agentPrompt)}
                disabled={selectedActionsDisabled}
                testId="copy-for-agent"
                trailing={<Clipboard className="h-5 w-5" />}
              />
              <ActionCard
                icon={Code2}
                title="Download HTML / Tailwind"
                description="Standalone source for the selected screen"
                meta="HTML"
                onClick={() => downloadBlob([htmlExport], "text/html;charset=utf-8", `${screenSlug}.html`)}
                disabled={selectedActionsDisabled}
                testId="download-screen-html"
                trailing={<Download className="h-5 w-5" />}
              />
              <ActionCard
                icon={Layers3}
                title="Native Scaffolds"
                description="React Native, SwiftUI, Compose, Flutter"
                meta="Beta"
                selected={scaffoldsOpen}
                onClick={() => {
                  if (selectedActionsDisabled) return;
                  setScaffoldsOpen((value) => !value);
                  setScaffoldError(null);
                }}
                disabled={selectedActionsDisabled}
                testId="toggle-scaffolds"
                trailing={<ChevronRight className={cn("h-5 w-5 transition-transform", scaffoldsOpen && "rotate-90")} />}
              />
              <AnimatePresence initial={false}>
                {scaffoldsOpen && !selectedActionsDisabled ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-2 gap-2 px-1 pb-1 pt-1" data-testid="scaffold-options">
                      {SCAFFOLD_OPTIONS.map((option) => (
                        <button
                          type="button"
                          key={option.id}
                          disabled={selectedActionsDisabled}
                          onClick={() => downloadScaffold(option.id)}
                          className="flex h-10 items-center justify-between rounded-xl border border-slate-950/[0.07] bg-white px-3 text-[12px] font-semibold text-slate-600 transition hover:bg-[#fbfbfc] hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-slate-300 dark:hover:bg-white/[0.08] dark:hover:text-white"
                        >
                          {option.label}
                          <Download className="h-3.5 w-3.5 text-slate-400" />
                        </button>
                      ))}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
              {scaffoldError ? (
                <div className="flex items-start gap-2 rounded-2xl bg-rose-50 px-3 py-2.5 text-[12px] font-semibold leading-5 text-rose-700 dark:bg-rose-400/10 dark:text-rose-200" data-testid="scaffold-error">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {scaffoldError}
                </div>
              ) : null}
              <ActionCard
                icon={FileDown}
                title="Agent Prompt Markdown"
                description="Download the selected screen handoff"
                meta="MD"
                onClick={() => downloadBlob([agentPrompt], "text/markdown;charset=utf-8", `${screenSlug}-agent-prompt.md`)}
                disabled={selectedActionsDisabled}
                trailing={<FileCode2 className="h-5 w-5" />}
              />
              <div className="my-2 border-t border-slate-950/[0.06] dark:border-white/[0.08]" />
              {agentPackBlockedReason ? (
                <div className="flex items-start gap-2 rounded-2xl bg-amber-50 px-3 py-2.5 text-[12px] font-semibold leading-5 text-amber-800 dark:bg-amber-400/10 dark:text-amber-200" data-testid="agent-pack-blocked">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {agentPackBlockedReason}
                </div>
              ) : null}
              <ActionCard
                icon={FolderArchive}
                title="Download Agent Pack"
                description="Every screen + Design.md + agent skills"
                meta="ZIP"
                onClick={downloadAgentPack}
                disabled={agentPackDisabled}
                testId="download-agent-pack"
                trailing={<Download className="h-5 w-5" />}
              />
              {packDownloaded ? (
                <button
                  type="button"
                  onClick={() => void markCopied("pack-instruction", HANDOFF_INSTRUCTION)}
                  className="flex w-full items-center gap-2 rounded-2xl border border-emerald-600/10 bg-emerald-50 px-3 py-3 text-left text-[12px] font-semibold leading-5 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200"
                  data-testid="pack-after-download"
                >
                  {copiedAction === "pack-instruction" ? <Check className="h-4 w-4 shrink-0" /> : <Clipboard className="h-4 w-4 shrink-0" />}
                  <span className="min-w-0 flex-1">{copiedAction === "pack-instruction" ? "Instruction copied" : "Copy instruction for your agent"}</span>
                  <Sparkles className="h-3.5 w-3.5 shrink-0 opacity-60" />
                </button>
              ) : null}
            </div>
          </section>

          <section className="rounded-[20px] border border-slate-950/[0.08] bg-white p-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <div className="mb-2 flex items-center justify-between gap-3 px-3 py-2">
              <div>
                <h3 className="text-[20px] font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">Screens</h3>
                <p className="mt-0.5 text-[12px] font-medium text-slate-400">Select a screen or export directly</p>
              </div>
              <span className="shrink-0 text-[14px] font-semibold tracking-[0.02em] text-slate-400">HTML / AI</span>
            </div>
            <div className="space-y-1.5">
              {screens.map((screen) => {
                const disabled = tokenDirty || screen.status === "building";
                return (
                  <ScreenExportRow
                    key={screen.id}
                    screen={screen}
                    active={screen.id === activeScreen?.id}
                    disabled={disabled}
                    onSelect={() => {
                      setActiveScreenId(screen.id);
                      setScaffoldError(null);
                    }}
                    onCopy={() => copyScreenForAgent(screen)}
                    onDownload={() => downloadScreenHtml(screen)}
                  />
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </PremiumDropdown>
  );
}
