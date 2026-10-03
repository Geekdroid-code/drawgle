"use client";

import { useEffect, useMemo, useState } from "react";

import { CanvasStage } from "@/components/CanvasArea";
import { HistoryControls, type CanvasHistoryPreview } from "@/components/HistoryControls";
import { HistoryPreviewBar } from "@/components/HistoryPreviewBar";
import { useEditorDraft } from "@/components/visual-editor/use-editor-draft";
import { VisualEditor } from "@/components/visual-editor/VisualEditor";
import type { CanvasTool } from "@/lib/canvas-interactions";
import type { ProjectNavigationRow, ProjectRow, ScreenRow } from "@/lib/supabase/database.types";
import { mapProjectNavigationRow, mapProjectRow, mapScreenRow } from "@/lib/supabase/mappers";
import type { ScreenData } from "@/lib/types";

/**
 * Dev only (/dev/history-preview): Recent changes for a recorded project's first screen, with a saved earlier version
 * of it, so previewing on the canvas, Before/After, Exit preview and Restore can be seen without signing in. History
 * requests are answered in the page; nothing reaches the database.
 */

const PROJECT_ID = "history-fixture";
type Export = { project: ProjectRow; screens: ScreenRow[]; navigation: ProjectNavigationRow | null };
type Version = { id: string; label: string; createdAt: string; before: string; after: string };

/** An earlier version of a screen: its first words (usually its title) said something else. */
function earlierVersion(code: string) {
  // Style and script contents are blanked, not removed, so positions in the masked code match the code.
  const masked = code.replace(/<(style|script)\b[\s\S]*?<\/\1\s*>/gi, (block) => " ".repeat(block.length));
  const words = /(>\s*)([A-Za-z][^<>]{2,60}?)(\s*<)/.exec(masked);
  if (!words) return { code, now: "" };
  const start = words.index + words[1].length;
  return { code: `${code.slice(0, start)}Earlier title${code.slice(start + words[2].length)}`, now: words[2].trim() };
}

export function HistoryPreviewFixture() {
  const [data, setData] = useState<Export | null>(null);
  const [screens, setScreens] = useState<ScreenData[]>([]);
  const [preview, setPreview] = useState<CanvasHistoryPreview | null>(null);
  const [tool, setTool] = useState<CanvasTool>("element-select");
  const [historyOpen, setHistoryOpen] = useState(true);
  const [historyHost, setHistoryHost] = useState<HTMLDivElement | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [version, setVersion] = useState<Version | null>(null);
  const editor = useEditorDraft({ info: null, revision: 0, save: async () => false, upload: async () => "" });

  useEffect(() => {
    void fetch("/dev/chat-replay/data").then((response) => response.json()).then(async ({ ids }: { ids: string[] }) => {
      const id = new URLSearchParams(window.location.search).get("id") ?? ids[0];
      if (!id) return;
      const loaded = await (await fetch(`/dev/chat-replay/data?id=${id}`)).json() as Export;
      const loadedScreens = loaded.screens.map(mapScreenRow).map((screen) => ({ ...screen, sourceLoaded: true }));
      const first = loadedScreens.find((screen) => screen.code?.trim());
      if (first) {
        const earlier = earlierVersion(first.code);
        setVersion({ id: "44444444-4444-4444-8444-444444444444", label: `Changed text to “${earlier.now}”`,
          createdAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(), before: earlier.code, after: first.code });
      }
      setData(loaded);
      setScreens(loadedScreens);
    });
  }, []);

  const target = screens.find((screen) => screen.code?.trim()) ?? null;
  const targetId = target?.id;

  useEffect(() => {
    if (!version || !targetId) return;
    const original = window.fetch;
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!url.startsWith(`/api/projects/${PROJECT_ID}/`)) return original(input, init);
      const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
      if (init?.method === "POST") {
        const { side } = JSON.parse(String(init.body)) as { side?: "before" | "after" };
        setScreens((current) => current.map((screen) => screen.id === targetId ? { ...screen, code: side === "before" ? version.before : version.after } : screen));
        return json({ status: "success", revision: 4 });
      }
      if (url.includes("/history/")) return json({ id: version.id, label: version.label, createdAt: version.createdAt, payload: { code: version.after }, beforePayload: { code: version.before } });
      return json({ revision: 3, canUndo: true, canRedo: false, entries: [{ id: version.id, label: version.label, createdAt: version.createdAt, isCurrent: true }] });
    };
    return () => { window.fetch = original; };
  }, [targetId, version]);

  const canvasScreens = useMemo(() => preview?.context === "screen"
    ? screens.map((screen) => screen.id === preview.screenId ? { ...screen, code: preview.code } : screen)
    : screens, [preview, screens]);
  const project = data ? mapProjectRow(data.project) : null;
  const navigation = data?.navigation ? mapProjectNavigationRow(data.navigation) : null;
  if (!project || !target) return <main className="grid h-dvh place-items-center text-sm text-[var(--dg-text-muted)]">Loading a recorded project…</main>;

  const historyControls = <HistoryControls projectId={PROJECT_ID} target={{ context: "screen", screenId: target.id }} screenName={target.name}
    screens={screens} refreshVersion={refresh} onApplied={() => setRefresh((value) => value + 1)} local={editor}
    viewOpen={historyOpen} onViewOpenChange={setHistoryOpen} panelTarget={historyHost} onCanvasPreviewChange={setPreview} />;

  return (
    <main className="relative h-dvh overflow-hidden bg-[var(--dg-bg)] text-[var(--dg-text)]">
      <CanvasStage
        screens={canvasScreens}
        projectNavigation={navigation}
        designTokens={project.designTokens}
        tool={tool}
        onToolChange={setTool}
        selectedScreen={target}
        onSelectScreen={() => undefined}
        onCanvasClick={() => undefined}
        readOnly
        hasSelectedElement={false}
        selectedElementCanEditText={false}
        selectedElementCanEditDesign={false}
      />
      <HistoryPreviewBar preview={preview} />
      <VisualEditor info={null} editor={editor} tokens={[]} open disabled={false} onClose={() => setHistoryOpen(false)} onDelete={() => undefined}
        historyControls={historyControls} historyOpen={historyOpen} historyPanelRef={setHistoryHost} />
    </main>
  );
}
