"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Boxes,
  Check,
  CheckCircle2,
  Clipboard,
  Code2,
  Download,
  FileDown,
  FolderArchive,
  PackageOpen,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PremiumSegmentedTabs, PremiumTabPanel } from "@/components/ui/premium-segmented-tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  buildAgentHandoffPrompt,
  buildAgentPackZip,
  buildNativeScaffold,
  buildStandaloneHtmlExport,
  cleanExportName,
  resolveScreenNavigationCode,
  slugifyExportName,
  type AgentTarget,
  type ExportProjectContext,
  type NativeScaffoldTarget,
} from "@/lib/export-pipeline";
import type { DesignTokens, ProjectData, ProjectNavigationData, ScreenData } from "@/lib/types";

type ExportMode = "agent" | "html" | "scaffolds";

const MODE_TABS = [
  { id: "agent" as const, label: "Agent Handoff", compactLabel: "Agent", icon: Bot },
  { id: "html" as const, label: "HTML / Tailwind", compactLabel: "HTML", icon: Code2 },
  { id: "scaffolds" as const, label: "Scaffolds (Beta)", compactLabel: "Beta", icon: Boxes },
];

const TARGET_OPTIONS: Array<{ id: AgentTarget; label: string }> = [
  { id: "auto", label: "Auto-detect from repository" },
  { id: "html", label: "HTML / Tailwind" },
  { id: "reactnative", label: "React Native" },
  { id: "swiftui", label: "SwiftUI" },
  { id: "compose", label: "Jetpack Compose" },
  { id: "flutter", label: "Flutter" },
];

const SCAFFOLD_OPTIONS: Array<{ id: NativeScaffoldTarget; label: string; extension: string }> = [
  { id: "reactnative", label: "React Native", extension: "tsx" },
  { id: "swiftui", label: "SwiftUI", extension: "swift" },
  { id: "compose", label: "Jetpack Compose", extension: "kt" },
  { id: "flutter", label: "Flutter", extension: "dart" },
];

const CONTEXT_ITEMS = [
  "Selected screen HTML and screen intent",
  "Project Design.md and universal tokens",
  "Shared navigation plan and visual shell",
  "Repository-first implementation workflow",
  "Build, test, and self-correction checklist",
];

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

function ExportSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ id: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="h-10 min-w-0 rounded-[12px] border border-slate-950/[0.1] bg-white px-3 text-xs font-semibold text-slate-800 outline-none transition hover:border-slate-950/20 focus:border-slate-950/30 focus:ring-2 focus:ring-slate-950/[0.08]"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function CodePreview({
  value,
  emptyMessage,
}: {
  value?: string | null;
  emptyMessage?: string;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-hidden rounded-[16px] border border-slate-950/[0.08] bg-[#07090c] shadow-sm">
      {value ? (
        <pre className="h-full overflow-auto p-4 font-mono text-[11px] leading-5 text-slate-200 scrollbar-thin scrollbar-thumb-white/15 scrollbar-track-transparent">
          <code>{value}</code>
        </pre>
      ) : (
        <div className="flex h-full min-h-48 items-center justify-center px-6 text-center text-xs font-medium text-slate-400">
          {emptyMessage || "No export content is available."}
        </div>
      )}
    </div>
  );
}

export function MobileExportDrawer({
  open,
  onClose,
  project,
  screens,
  initialScreenId,
  projectNavigation,
  designTokens,
  tokenCss,
  googleFontAssetLinks,
}: {
  open: boolean;
  onClose: () => void;
  project: ProjectData;
  screens: ScreenData[];
  initialScreenId?: string | null;
  projectNavigation?: ProjectNavigationData | null;
  designTokens?: DesignTokens | null;
  tokenCss?: string;
  googleFontAssetLinks?: string;
}) {
  const [mode, setMode] = useState<ExportMode>("agent");
  const [target, setTarget] = useState<AgentTarget>("auto");
  const [scaffoldTarget, setScaffoldTarget] = useState<NativeScaffoldTarget>("reactnative");
  const [copiedAction, setCopiedAction] = useState<string | null>(null);
  const [packInstructionVisible, setPackInstructionVisible] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevInitialScreenId, setPrevInitialScreenId] = useState<string | null | undefined>(initialScreenId);
  const [activeScreenId, setActiveScreenId] = useState(initialScreenId || screens[0]?.id || "");

  if (open !== prevOpen || initialScreenId !== prevInitialScreenId) {
    setPrevOpen(open);
    setPrevInitialScreenId(initialScreenId);
    if (open) {
      setActiveScreenId(initialScreenId || screens[0]?.id || "");
      setMode("agent");
      setPackInstructionVisible(false);
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

  const navigationCode = activeScreen
    ? resolveScreenNavigationCode(activeScreen, projectNavigation)
    : "";
  const agentPrompt = useMemo(
    () => activeScreen ? buildAgentHandoffPrompt({ context, screen: activeScreen, target }) : "",
    [activeScreen, context, target],
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
  const scaffoldResult = useMemo(
    () => mode === "scaffolds" && activeScreen
      ? buildNativeScaffold({
        screen: activeScreen,
        target: scaffoldTarget,
        navigationCode,
        designTokens,
        tokenCss,
      })
      : null,
    [activeScreen, designTokens, mode, navigationCode, scaffoldTarget, tokenCss],
  );

  const markCopied = async (key: string, value: string) => {
    await navigator.clipboard?.writeText(value).catch(() => undefined);
    setCopiedAction(key);
    window.setTimeout(() => setCopiedAction(null), 1400);
  };

  const handleAgentPackDownload = () => {
    const bytes = buildAgentPackZip({ context, target });
    downloadBlob(
      [new Uint8Array(bytes)],
      "application/zip",
      `drawgle-agent-pack-${slugifyExportName(project.name, "project")}.zip`,
    );
    setPackInstructionVisible(true);
  };

  const scaffoldOption = SCAFFOLD_OPTIONS.find((option) => option.id === scaffoldTarget) || SCAFFOLD_OPTIONS[0];
  const cleanScreenName = activeScreen ? cleanExportName(activeScreen.name) : "Screen";

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="right"
        className="dg-export-drawer !w-full !max-w-none border-l border-slate-950/[0.1] bg-[#f4f5f6] p-0 text-slate-900 shadow-2xl sm:!w-[min(920px,calc(100vw-32px))] sm:!max-w-[920px]"
      >
        <div className="flex h-full min-h-0 flex-col">
          <SheetHeader className="shrink-0 border-b border-slate-950/[0.08] bg-white px-4 pb-4 pt-5 sm:px-6">
            <div className="flex items-start justify-between gap-5 pr-10">
              <div className="min-w-0 text-left">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-[11px] bg-slate-950 text-white shadow-sm">
                    <PackageOpen className="h-4 w-4" />
                  </span>
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.14em] text-emerald-700 ring-1 ring-emerald-600/15">
                    Agent-ready
                  </span>
                </div>
                <SheetTitle className="text-[20px] font-extrabold tracking-[-0.025em] text-slate-950">
                  Ship to Code
                </SheetTitle>
                <SheetDescription className="mt-1 max-w-2xl text-[12px] leading-5 text-slate-500">
                  Hand polished HTML and complete design context to your coding agent, or use a structural native scaffold as a starting point.
                </SheetDescription>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <ExportSelect
                label="Screen"
                value={activeScreenId}
                options={screens.map((screen) => ({ id: screen.id, label: screen.name }))}
                onChange={setActiveScreenId}
              />
              {mode === "scaffolds" ? (
                <ExportSelect
                  label="Beta scaffold"
                  value={scaffoldTarget}
                  options={SCAFFOLD_OPTIONS}
                  onChange={setScaffoldTarget}
                />
              ) : (
                <ExportSelect
                  label="Implementation target"
                  value={target}
                  options={TARGET_OPTIONS}
                  onChange={setTarget}
                />
              )}
            </div>

            <PremiumSegmentedTabs
              items={MODE_TABS}
              value={mode}
              onValueChange={setMode}
              layoutId="ship-to-code-mode"
              size="sm"
              className="mt-4"
              tabClassName="text-[10px] sm:text-[11px]"
            />
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-hidden p-3 sm:p-4">
            <PremiumTabPanel panelKey={mode} className="h-full min-h-0">
              {mode === "agent" ? (
                <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
                  <aside className="flex min-h-0 flex-col gap-3 overflow-auto rounded-[18px] border border-slate-950/[0.08] bg-white p-4 shadow-sm">
                    <div className="rounded-[15px] bg-slate-950 p-4 text-white">
                      <div className="flex items-center gap-2 text-xs font-extrabold">
                        <Sparkles className="h-4 w-4 text-emerald-300" />
                        Recommended workflow
                      </div>
                      <p className="mt-2 text-[11px] leading-5 text-slate-300">
                        Your local agent already knows your repository. Drawgle gives it the visual source, design contract, and implementation checklist.
                      </p>
                    </div>

                    <div>
                      <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">Included context</div>
                      <div className="mt-2 space-y-2">
                        {CONTEXT_ITEMS.map((item) => (
                          <div key={item} className="flex items-start gap-2 text-[11px] font-medium leading-4 text-slate-600">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-auto space-y-2">
                      <Button
                        type="button"
                        onClick={() => void markCopied("agent", agentPrompt)}
                        className="h-10 w-full rounded-[12px] bg-slate-950 text-xs font-bold text-white hover:bg-slate-800"
                        data-testid="copy-for-agent"
                      >
                        {copiedAction === "agent" ? <Check className="mr-2 h-4 w-4" /> : <Clipboard className="mr-2 h-4 w-4" />}
                        {copiedAction === "agent" ? "Copied for Agent" : "Copy for Agent"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => downloadBlob([agentPrompt], "text/markdown;charset=utf-8", `${slugifyExportName(activeScreen?.name || "screen")}-agent-prompt.md`)}
                        className="h-9 w-full rounded-[11px] border-slate-950/[0.1] bg-white text-[11px] font-bold"
                      >
                        <FileDown className="mr-2 h-3.5 w-3.5" />
                        Download Prompt (.md)
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAgentPackDownload}
                        className="h-9 w-full rounded-[11px] border-emerald-600/20 bg-emerald-50 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100"
                        data-testid="download-agent-pack"
                      >
                        <FolderArchive className="mr-2 h-3.5 w-3.5" />
                        Download Project Agent Pack
                      </Button>
                    </div>

                    {packInstructionVisible ? (
                      <div className="rounded-[13px] border border-emerald-600/15 bg-emerald-50 p-3">
                        <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-emerald-800">After adding the pack</div>
                        <button
                          type="button"
                          onClick={() => void markCopied("pack-instruction", "Read .drawgle/handoff.md and implement the Drawgle screens in this repository.")}
                          className="mt-2 flex w-full items-start justify-between gap-2 rounded-[9px] bg-white px-2.5 py-2 text-left font-mono text-[10px] leading-4 text-slate-700 ring-1 ring-emerald-600/10"
                        >
                          Read .drawgle/handoff.md and implement the Drawgle screens in this repository.
                          {copiedAction === "pack-instruction" ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> : <Clipboard className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                        </button>
                      </div>
                    ) : null}
                  </aside>
                  <CodePreview value={agentPrompt} />
                </div>
              ) : null}

              {mode === "html" ? (
                <div className="flex h-full min-h-0 flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-slate-950/[0.08] bg-white px-4 py-3 shadow-sm">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-extrabold text-slate-900">
                        <Code2 className="h-4 w-4 text-sky-600" />
                        High-fidelity HTML source
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">Standalone Tailwind HTML with tokens, fonts, and selected-screen navigation state.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" onClick={() => void markCopied("html", htmlExport)} className="h-8 rounded-[10px] text-[11px] font-bold">
                        {copiedAction === "html" ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Clipboard className="mr-1.5 h-3.5 w-3.5" />}
                        Copy HTML
                      </Button>
                      <Button onClick={() => downloadBlob([htmlExport], "text/html;charset=utf-8", `${slugifyExportName(activeScreen?.name || "screen")}.html`)} className="h-8 rounded-[10px] bg-slate-950 text-[11px] font-bold text-white hover:bg-slate-800">
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        Download
                      </Button>
                    </div>
                  </div>
                  <CodePreview value={htmlExport} />
                </div>
              ) : null}

              {mode === "scaffolds" ? (
                <div className="flex h-full min-h-0 flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-amber-500/20 bg-amber-50 px-4 py-3 shadow-sm">
                    <div className="max-w-xl">
                      <div className="flex items-center gap-2 text-xs font-extrabold text-amber-950">
                        <AlertTriangle className="h-4 w-4 text-amber-700" />
                        Structural scaffold, Beta
                      </div>
                      <p className="mt-1 text-[11px] leading-4 text-amber-900/70">
                        Generates visual structure and token constants to accelerate implementation. Adjust it for your architecture, dependencies, and platform conventions.
                      </p>
                    </div>
                    {scaffoldResult?.code ? (
                      <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => void markCopied("scaffold", scaffoldResult.code || "")} className="h-8 rounded-[10px] border-amber-700/20 bg-white text-[11px] font-bold">
                          {copiedAction === "scaffold" ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Clipboard className="mr-1.5 h-3.5 w-3.5" />}
                          Copy Scaffold
                        </Button>
                        <Button
                          onClick={() => downloadBlob([scaffoldResult.code || ""], "text/plain;charset=utf-8", `${cleanScreenName}.${scaffoldOption.extension}`)}
                          className="h-8 rounded-[10px] bg-amber-900 text-[11px] font-bold text-white hover:bg-amber-800"
                        >
                          <Download className="mr-1.5 h-3.5 w-3.5" />
                          Download Beta
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  {scaffoldResult?.error ? (
                    <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-[16px] border border-rose-500/20 bg-white px-6 text-center shadow-sm" data-testid="scaffold-error">
                      <AlertTriangle className="h-7 w-7 text-rose-500" />
                      <div className="mt-3 text-sm font-extrabold text-slate-900">This Beta Scaffold could not be generated</div>
                      <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">{scaffoldResult.error}</p>
                      <p className="mt-3 text-[11px] font-semibold text-emerald-700">Agent Handoff and HTML export are still available.</p>
                    </div>
                  ) : (
                    <CodePreview value={scaffoldResult?.code} emptyMessage="Open a Beta Scaffold to generate its structural starting point." />
                  )}
                </div>
              ) : null}
            </PremiumTabPanel>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
