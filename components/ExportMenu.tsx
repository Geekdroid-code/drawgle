"use client";

import { useMemo, useState } from "react";
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
  buildNativeScaffold,
  buildStandaloneHtmlExport,
  cleanExportName,
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
  extension: string;
}> = [
  { id: "reactnative", label: "React Native", extension: "tsx" },
  { id: "swiftui", label: "SwiftUI", extension: "swift" },
  { id: "compose", label: "Compose", extension: "kt" },
  { id: "flutter", label: "Flutter", extension: "dart" },
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
    <div className="px-2.5 pb-1 pt-1 text-[9px] font-extrabold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
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
}) {
  return (
    <div
      className={cn(
        "group flex min-w-0 items-center gap-3 rounded-[11px] px-2.5 py-2 transition-colors",
        onClick && "cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5",
        expanded && "bg-slate-50 dark:bg-white/5",
      )}
      onClick={onClick}
      onKeyDown={onClick ? (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      } : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      data-testid={testId}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-slate-950/[0.06] bg-slate-50 text-slate-600 transition-colors group-hover:bg-white group-hover:text-slate-950 dark:border-white/[0.06] dark:bg-white/5 dark:text-slate-300">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[12px] font-bold text-slate-800 dark:text-slate-100">{title}</span>
          {recommended ? (
            <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[7px] font-extrabold uppercase tracking-[0.1em] text-emerald-700 ring-1 ring-emerald-600/10">
              Recommended
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block truncate text-[9px] font-medium text-slate-400 dark:text-slate-500">{description}</span>
      </span>
      {meta ? <span className="shrink-0 text-[8px] font-bold uppercase tracking-[0.11em] text-slate-400">{meta}</span> : null}
      {trailing}
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
    const bytes = buildAgentPackZip({ context, target: "auto" });
    downloadBlob(
      [new Uint8Array(bytes)],
      "application/zip",
      `drawgle-agent-pack-${slugifyExportName(project.name, "project")}.zip`,
    );
    setPackDownloaded(true);
  };

  const downloadScaffold = (target: NativeScaffoldTarget, extension: string) => {
    if (!activeScreen) return;
    const result = buildNativeScaffold({
      screen: activeScreen,
      target,
      navigationCode,
      designTokens,
      tokenCss,
    });
    if (result.error || !result.code) {
      setScaffoldError(result.error || "This Beta Scaffold could not be generated.");
      return;
    }
    setScaffoldError(null);
    downloadBlob([result.code], "text/plain;charset=utf-8", `${cleanExportName(activeScreen.name)}.${extension}`);
  };

  const screenName = activeScreen?.name || "Screen";
  const screenSlug = slugifyExportName(screenName, "screen");

  return (
    <PremiumDropdown
      open={open}
      onOpenChange={onOpenChange}
      align="end"
      side="bottom"
      width={380}
      trigger={trigger}
      menuClassName="!w-[min(380px,calc(100vw-16px))] max-h-[min(680px,calc(100dvh-72px))] overflow-y-auto bg-white/96 backdrop-blur-xl dark:bg-[#1b1b1b]/96"
    >
      <div className="w-[min(368px,calc(100vw-28px))] p-0.5" data-testid="export-menu">
        <div className="flex items-center justify-between gap-3 px-2.5 pb-2 pt-1">
          <div className="min-w-0">
            <SectionLabel>Selected screen</SectionLabel>
            {screens.length > 1 ? (
              <label className="relative mt-0.5 block">
                <span className="sr-only">Screen to export</span>
                <select
                  aria-label="Screen to export"
                  value={activeScreen?.id || ""}
                  onChange={(event) => {
                    setActiveScreenId(event.target.value);
                    setScaffoldError(null);
                  }}
                  className="h-7 max-w-[250px] appearance-none truncate rounded-lg border border-slate-950/[0.08] bg-slate-50 py-0 pl-2.5 pr-7 text-[11px] font-bold text-slate-800 outline-none hover:bg-slate-100 dark:border-white/[0.08] dark:bg-white/5 dark:text-slate-100"
                >
                  {screens.map((screen) => <option key={screen.id} value={screen.id}>{screen.name}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1.5 h-3.5 w-3.5 text-slate-400" />
              </label>
            ) : (
              <div className="mt-0.5 px-2.5 text-[11px] font-bold text-slate-800 dark:text-slate-100">{screenName}</div>
            )}
          </div>
          <span className="shrink-0 rounded-full bg-slate-50 px-2 py-1 text-[8px] font-extrabold uppercase tracking-[0.12em] text-slate-400 ring-1 ring-slate-950/[0.06] dark:bg-white/5 dark:ring-white/[0.06]">
            One screen
          </span>
        </div>

        <div className="space-y-0.5">
          <ExportRow
            icon={Bot}
            title={copiedAction === "agent" ? "Copied for AI agent" : "Copy for AI agent"}
            description="HTML source + complete design context"
            recommended
            onClick={() => void markCopied("agent", agentPrompt)}
            testId="copy-for-agent"
            trailing={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Download agent prompt"
                title="Download agent prompt (.md)"
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
            testId="download-screen-html"
          />
          <ExportRow
            icon={Layers3}
            title="Native Scaffolds"
            description="Structural starting points, may need fixes"
            meta="Beta"
            expanded={scaffoldsOpen}
            onClick={() => {
              setScaffoldsOpen((value) => !value);
              setScaffoldError(null);
            }}
            testId="toggle-scaffolds"
            trailing={<ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-slate-300 transition-transform", scaffoldsOpen && "rotate-90")} />}
          />
          {scaffoldsOpen ? (
            <div className="ml-11 grid grid-cols-2 gap-1 pb-1.5 pr-2 pt-0.5" data-testid="scaffold-options">
              {SCAFFOLD_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  onClick={() => downloadScaffold(option.id, option.extension)}
                  className="flex h-8 items-center justify-between rounded-lg border border-slate-950/[0.06] bg-slate-50 px-2.5 text-[9px] font-bold text-slate-600 transition hover:border-slate-950/[0.12] hover:bg-white hover:text-slate-950 dark:border-white/[0.06] dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  {option.label}
                  <Download className="h-3 w-3 text-slate-300" />
                </button>
              ))}
            </div>
          ) : null}
          {scaffoldError ? (
            <div className="mx-2.5 mb-1.5 ml-11 flex items-start gap-2 rounded-lg bg-rose-50 px-2.5 py-2 text-[9px] font-semibold leading-4 text-rose-700" data-testid="scaffold-error">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              {scaffoldError}
            </div>
          ) : null}
        </div>

        <div className="my-2 border-t border-slate-950/[0.06] dark:border-white/[0.06]" />
        <SectionLabel>Whole project</SectionLabel>
        <ExportRow
          icon={FolderArchive}
          title="Download Agent Pack"
          description={`Every screen + Design.md + agent skills`}
          meta={`All ${screens.length} · ZIP`}
          onClick={downloadAgentPack}
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
