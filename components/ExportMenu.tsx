"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Code2,
  Download,
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-1 pt-1 mb-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
      {children}
    </div>
  );
}

function ExportRow({
  icon: Icon,
  title,
  description,
  meta,
  recommended,
  onClick,
  trailing,
  expanded,
  testId,
  disabled = false,
}: {
  icon: typeof Bot;
  title: string;
  description: string;
  meta?: string;
  recommended?: boolean;
  onClick?: () => void;
  trailing?: React.ReactNode;
  expanded?: boolean;
  testId?: string;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative group flex min-w-0 items-center gap-2.5 rounded-lg pl-3 py-2 pr-4 transition-colors duration-150 ease-out",
        onClick && !disabled && "cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5",
        disabled && "cursor-not-allowed opacity-55",
        expanded && "bg-slate-50 dark:bg-white/5",
      )}
      onClick={onClick ? (event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        onClick();
      } : undefined}
      onKeyDown={onClick ? (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (!disabled) onClick();
        }
      } : undefined}
      role={onClick ? "button" : undefined}
      aria-disabled={disabled || undefined}
      tabIndex={onClick ? 0 : undefined}
      data-testid={testId}
    >
      <Icon className={cn(
        "h-4 w-4 shrink-0 transition-colors z-10",
        onClick && !disabled ? "text-slate-500 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-white" : "text-slate-400"
      )} />
      <span className="min-w-0 flex-1 z-10">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className={cn(
            "truncate text-[13px] font-semibold transition-colors",
            onClick && !disabled ? "text-slate-700 group-hover:text-slate-900 dark:text-slate-300 dark:group-hover:text-white" : "text-slate-500 dark:text-slate-400"
          )}>{title}</span>
          {recommended ? (
            <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[7px] font-extrabold uppercase tracking-[0.1em] text-emerald-700 ring-1 ring-emerald-600/10">
              Recommended
            </span>
          ) : null}
        </span>
        <span className={cn(
          "mt-0.5 block truncate text-[10px] transition-colors",
          onClick && !disabled ? "text-slate-500 group-hover:text-slate-600 dark:text-slate-400 dark:group-hover:text-slate-300" : "text-slate-400 dark:text-slate-500"
        )}>{description}</span>
      </span>
      {meta ? <span className="shrink-0 text-[8px] font-bold uppercase tracking-[0.11em] text-slate-400 z-10">{meta}</span> : null}
      <div className="relative z-10">{trailing}</div>
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
  const [screenSelectorOpen, setScreenSelectorOpen] = useState(false);
  const [hoveredScreenId, setHoveredScreenId] = useState<string | null>(null);
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
      setScreenSelectorOpen(false);
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
  const navigationCode = activeScreen ? resolveScreenNavigationCode(activeScreen, projectNavigation) : "";
  const agentPrompt = useMemo(
    () => activeScreen ? buildAgentHandoffPrompt({ context, screen: activeScreen, target: "auto" }) : "",
    [activeScreen, context],
  );
  const htmlExport = useMemo(
    () => activeScreen ? buildStandaloneHtmlExport({
      screen: activeScreen,
      navigationCode,
      activeNavigationItemId: activeScreen.navigationItemId,
      designTokens,
      tokenCss,
      googleFontAssetLinks,
    }) : "",
    [activeScreen, designTokens, googleFontAssetLinks, navigationCode, tokenCss],
  );

  const markCopied = async (key: string, value: string) => {
    await navigator.clipboard?.writeText(value).catch(() => undefined);
    setCopiedAction(key);
    window.setTimeout(() => setCopiedAction(null), 1400);
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
      navigationCode,
      designTokens,
      tokenCss,
    });
    if (result.error || !result.bytes) {
      setScaffoldError(result.error || "This Beta Scaffold could not be generated.");
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
    ? "Save or discard design token changes"
    : activeScreen?.status === "building"
    ? "This screen is still building"
    : null;

  const agentPackBlockedReason = tokenDirty
    ? "Save or discard design token changes"
    : null;

  const selectedActionsDisabled = !!selectedScreenBlockedReason;
  const agentPackDisabled = !!agentPackBlockedReason;

  const menuWidth = typeof window !== "undefined"
    ? Math.min(380, window.innerWidth - 16)
    : 380;
  const innerWidth = menuWidth - 12;

  return (
    <PremiumDropdown
      open={open}
      onOpenChange={onOpenChange}
      align="end"
      side="bottom"
      width={menuWidth}
      trigger={trigger}
      menuClassName="!h-auto !overflow-visible bg-white/98 backdrop-blur-2xl dark:bg-[#1b1b1b]/98"
    >
      <div 
        style={{ width: innerWidth, minWidth: innerWidth }}
        className="max-h-[calc(100dvh-48px)] overflow-y-auto p-1"
        data-testid="export-menu"
      >
        <div className="flex items-center justify-between gap-3 pb-2 pt-1 pr-2.5">
          <div className="min-w-0">
            <SectionLabel>Selected screen</SectionLabel>
            {screens.length > 1 ? (
              <div className="relative mt-0.5 pl-3">
                <button
                  type="button"
                  onClick={() => setScreenSelectorOpen(!screenSelectorOpen)}
                  className="flex h-8 items-center justify-between w-max min-w-[180px] max-w-[280px] rounded-lg border border-slate-950/[0.08] bg-slate-50/50 px-3 text-[12px] font-semibold text-slate-800 outline-none hover:border-slate-950/[0.15] hover:bg-slate-50 dark:border-white/[0.08] dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10 transition-colors"
                >
                  <span className="truncate mr-3">{activeScreen?.name || ""}</span>
                  <ChevronDown className={cn("h-3.5 w-3.5 text-slate-400 transition-transform duration-200 shrink-0", screenSelectorOpen && "rotate-180")} />
                </button>
                <select
                  aria-label="Screen to export"
                  value={activeScreen?.id || ""}
                  onChange={(event) => {
                    setActiveScreenId(event.target.value);
                    setScaffoldError(null);
                  }}
                  className="sr-only"
                  tabIndex={-1}
                >
                  {screens.map((screen) => <option key={screen.id} value={screen.id}>{screen.name}</option>)}
                </select>
                {screenSelectorOpen && (
                  <div className="flex flex-col gap-0.5 min-w-[200px] mt-1.5">
                    {screens.map((screen) => {
                      const isScreenActive = screen.id === activeScreenId;
                      const showScreenIndicator = hoveredScreenId
                        ? hoveredScreenId === screen.id
                        : isScreenActive;
                      
                      return (
                        <div
                          key={screen.id}
                          onMouseEnter={() => setHoveredScreenId(screen.id)}
                          onMouseLeave={() => setHoveredScreenId(null)}
                          onClick={() => {
                            setActiveScreenId(screen.id);
                            setScreenSelectorOpen(false);
                            setScaffoldError(null);
                          }}
                          className={cn(
                            "relative flex items-center justify-between rounded-lg text-[12px] font-semibold cursor-pointer select-none pl-3 py-1.5 pr-3 transition-colors duration-150 ease-out whitespace-nowrap",
                            isScreenActive
                              ? "text-slate-900 dark:text-white"
                              : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                          )}
                        >
                          {showScreenIndicator && (
                            <div className="absolute inset-0 rounded-lg -z-10 bg-slate-50/80 dark:bg-white/5" />
                          )}
                          {showScreenIndicator && (
                            <div className="absolute left-0 top-0 bottom-0 my-auto w-[3px] h-4 rounded-full bg-slate-900 dark:bg-slate-100" />
                          )}
                          <span className="truncate mr-3 relative z-10">{screen.name}</span>
                          {isScreenActive && (
                            <Check className="h-3.5 w-3.5 text-slate-900 dark:text-white shrink-0 relative z-10" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-0.5 px-3 text-[12px] font-semibold text-slate-800 dark:text-slate-100">{screenName}</div>
            )}
          </div>
          <span className="shrink-0 rounded-full bg-slate-50 px-2 py-1 text-[8px] font-extrabold uppercase tracking-[0.12em] text-slate-400 ring-1 ring-slate-950/[0.06] dark:bg-white/5 dark:ring-white/[0.06]">
            One screen
          </span>
        </div>

        <div className="space-y-0.5">
          {selectedScreenBlockedReason ? (
            <div className="mx-2.5 mb-1.5 flex items-start gap-2 rounded-lg bg-amber-50 px-2.5 py-2 text-[9px] font-semibold leading-4 text-amber-800" data-testid="selected-export-blocked">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              {selectedScreenBlockedReason}
            </div>
          ) : null}
          <ExportRow
            icon={Bot}
            title={copiedAction === "agent" ? "Copied for AI agent" : "Copy for AI agent"}
            description="HTML source + complete design context"
            recommended
            onClick={() => void markCopied("agent", agentPrompt)}
            disabled={selectedActionsDisabled}
            testId="copy-for-agent"
            trailing={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Download agent prompt"
                title="Download agent prompt (.md)"
                disabled={selectedActionsDisabled}
                onClick={(event) => {
                  event.stopPropagation();
                  downloadBlob([agentPrompt], "text/markdown;charset=utf-8", `${screenSlug}-agent-prompt.md`);
                }}
                className="h-7 w-7 rounded-lg text-slate-400 hover:bg-white hover:text-slate-950 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <FileDown className="h-3.5 w-3.5" />
              </Button>
            }
          />
          <ExportRow
            icon={Code2}
            title="Download HTML / Tailwind"
            description="Reliable standalone visual source"
            meta="HTML"
            onClick={() => downloadBlob([htmlExport], "text/html;charset=utf-8", `${screenSlug}.html`)}
            disabled={selectedActionsDisabled}
            testId="download-screen-html"
          />
          <ExportRow
            icon={Layers3}
            title="Native Scaffolds"
            description="Structural starting points, may need fixes"
            meta="Beta"
            expanded={scaffoldsOpen}
            onClick={() => {
              if (selectedActionsDisabled) return;
              setScaffoldsOpen((value) => !value);
              setScaffoldError(null);
            }}
            disabled={selectedActionsDisabled}
            testId="toggle-scaffolds"
            trailing={<ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-slate-300 transition-transform", scaffoldsOpen && "rotate-90")} />}
          />
          {scaffoldsOpen && !selectedActionsDisabled ? (
            <div className="ml-[26px] grid grid-cols-2 gap-1.5 pb-2 pr-3 pt-0.5" data-testid="scaffold-options">
              {SCAFFOLD_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  disabled={selectedActionsDisabled}
                  onClick={() => downloadScaffold(option.id)}
                  className="flex h-8 items-center justify-between rounded-lg border border-slate-950/[0.06] bg-slate-50 px-2.5 text-[9px] font-bold text-slate-600 transition hover:border-slate-950/[0.12] hover:bg-white hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[0.06] dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  {option.label}
                  <Download className="h-3 w-3 text-slate-300" />
                </button>
              ))}
            </div>
          ) : null}
          {scaffoldError ? (
            <div className="mx-2.5 mb-1.5 ml-[26px] flex items-start gap-2 rounded-lg bg-rose-50 px-2.5 py-2 text-[10px] font-semibold leading-4 text-rose-700" data-testid="scaffold-error">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              {scaffoldError}
            </div>
          ) : null}
        </div>

        <div className="my-2 border-t border-slate-950/[0.06] dark:border-white/[0.06]" />
        {agentPackBlockedReason ? (
          <div className="mx-2.5 mb-1.5 flex items-start gap-2 rounded-lg bg-amber-50 px-2.5 py-2 text-[9px] font-semibold leading-4 text-amber-800" data-testid="agent-pack-blocked">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            {agentPackBlockedReason}
          </div>
        ) : null}
        <ExportRow
          icon={FolderArchive}
          title="Download Agent Pack"
          description={agentPackBlockedReason ?? `Every screen + Design.md + agent skills`}
          meta={`All ${screens.length} · ZIP`}
          onClick={downloadAgentPack}
          disabled={agentPackDisabled}
          testId="download-agent-pack"
        />
        {packDownloaded ? (
          <button
            type="button"
            onClick={() => void markCopied("pack-instruction", HANDOFF_INSTRUCTION)}
            className="mx-2.5 mt-1 flex w-[calc(100%-20px)] items-center gap-2 rounded-lg border border-emerald-600/10 bg-emerald-50 px-2.5 py-2 text-left text-[9px] font-semibold leading-4 text-emerald-800"
            data-testid="pack-after-download"
          >
            {copiedAction === "pack-instruction" ? <Check className="h-3.5 w-3.5 shrink-0" /> : <Clipboard className="h-3.5 w-3.5 shrink-0" />}
            <span className="min-w-0 flex-1">{copiedAction === "pack-instruction" ? "Instruction copied" : "Copy instruction for your agent"}</span>
            <Sparkles className="h-3 w-3 shrink-0 opacity-60" />
          </button>
        ) : null}
      </div>
    </PremiumDropdown>
  );
}
