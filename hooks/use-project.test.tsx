import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProject } from "./use-project";
import { PlanningConversation } from "@/components/product-planning/PlanningConversation";
import { notifyProjectChanged } from "@/lib/project-refresh";
import { productFixture } from "@/lib/product-planning/test-fixtures";
import type { ProjectRow } from "@/lib/supabase/database.types";
import { mapProjectRow } from "@/lib/supabase/mappers";
import type { ProjectData } from "@/lib/types";

const mocks = vi.hoisted(() => ({ fetchProject: vi.fn(), realtime: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({
  channel: () => ({ on: (_event: string, _filter: unknown, callback: (payload: unknown) => void) => {
    mocks.realtime.mockImplementation(callback);
    return { subscribe: () => ({}) };
  } }), removeChannel: vi.fn(),
}) }));
vi.mock("@/lib/supabase/queries", () => ({ fetchProject: mocks.fetchProject }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
// Realtime delivers database rows, not client objects.
const toRow = (project: ProjectData): ProjectRow => ({
  id: project.id, owner_id: project.userId, name: project.name, prompt: project.prompt, status: project.status,
  project_charter: (project.charter ?? null) as ProjectRow["project_charter"],
  product_planning: (project.productPlanning ?? null) as ProjectRow["product_planning"],
  design_tokens: (project.designTokens ?? null) as ProjectRow["design_tokens"], token_revision: project.tokenRevision ?? 0,
  public_preview_token: null, public_preview_enabled: false, public_preview_created_at: null,
  next_screen_x: 0, screen_origin_y: 0, created_at: project.createdAt, updated_at: project.updatedAt,
});
const initial: ProjectData = mapProjectRow(toRow({ id: "11111111-1111-4111-8111-111111111111", userId: "owner", name: "Tacozz", prompt: "T-shirts", status: "draft", createdAt: "2026-09-14", updatedAt: "2026-09-14", productPlanning: productFixture() }));

// Mirrors ProjectShell's loading boundary with the real planning initializer.
function Canvas({ project: seed }: { project: ProjectData }) {
  const { project, isLoading } = useProject(seed.id, seed);
  if (isLoading || !project) return <p>Loading canvas</p>;
  return <><input aria-label="Chat draft" /><PlanningConversation project={project} /></>;
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("project refresh lifecycle", () => {
  it("keeps the canvas and draft mounted through initial fetch, twelve updates and planning completion", async () => {
    const projectLoad = deferred<ProjectData>();
    const agent = deferred<Response>();
    mocks.fetchProject.mockReturnValue(projectLoad.promise);
    const fetch = vi.fn(() => agent.promise);
    vi.stubGlobal("fetch", fetch);
    render(<Canvas project={initial} />);
    const composer = screen.getByRole("textbox", { name: "Chat draft" });
    fireEvent.change(composer, { target: { value: "Keep onboarding short" } });
    expect(fetch).toHaveBeenCalledOnce();
    await act(async () => projectLoad.resolve(initial));
    for (let revision = 1; revision <= 12; revision += 1) {
      const updated = { ...initial, productPlanning: { ...initial.productPlanning!, revision } };
      mocks.fetchProject.mockResolvedValue(updated);
      await act(async () => {
        mocks.realtime({ eventType: "UPDATE", new: toRow(updated) });
        notifyProjectChanged(initial.id);
      });
      expect(screen.getByRole("textbox", { name: "Chat draft" })).toBe(composer);
      expect((composer as HTMLInputElement).value).toBe("Keep onboarding short");
      expect(fetch).toHaveBeenCalledOnce();
    }
    mocks.fetchProject.mockResolvedValue({ ...initial, productPlanning: { ...initial.productPlanning!, initialTurnComplete: true } });
    await act(async () => agent.resolve(new Response(JSON.stringify({ intent: "product_planning" }), { status: 200 })));
    expect(screen.getByRole("textbox", { name: "Chat draft" })).toBe(composer);
    expect(screen.queryByText("Loading canvas")).toBeNull();
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("does not overwrite a newer realtime blueprint with an older in-flight fetch", async () => {
    const old = deferred<ProjectData>();
    mocks.fetchProject.mockReturnValue(old.promise);
    const { result } = renderHook(() => useProject(initial.id, initial));
    const newer = { ...initial, productPlanning: { ...initial.productPlanning!, revision: 12, initialTurnComplete: true } };
    act(() => mocks.realtime({ eventType: "UPDATE", new: toRow(newer) }));
    await act(async () => old.resolve(initial));
    expect(result.current.project).toEqual(mapProjectRow(toRow(newer)));
    expect(result.current.isLoading).toBe(false);
  });

  it("keeps the design tokens when an update omits unchanged large columns", async () => {
    const styled = { ...initial, charter: { appType: "Pet care" } as ProjectData["charter"],
      designTokens: { system_schema: "mobile_universal_core", tokens: { color: { background: { primary: "#F5F1EA" } } } } as ProjectData["designTokens"] };
    mocks.fetchProject.mockResolvedValue(styled);
    const { result } = renderHook(() => useProject(styled.id, styled));
    await act(async () => {});
    // A charter-only UPDATE: Realtime leaves out unchanged out-of-line values.
    const { design_tokens: _tokens, product_planning: _planning, ...record } = toRow({
      ...styled, charter: { appType: "Pet care", designRationale: "Second batch" } as ProjectData["charter"], updatedAt: "2026-09-29",
    });
    act(() => mocks.realtime({ eventType: "UPDATE", new: record }));
    expect(result.current.project?.designTokens).toEqual(styled.designTokens);
    expect(result.current.project?.productPlanning).toEqual(styled.productPlanning);
    expect(result.current.project?.charter).toEqual({ appType: "Pet care", designRationale: "Second batch" });
    expect(mocks.fetchProject).toHaveBeenCalledTimes(1);
  });

  it("refetches instead of guessing when a partial update arrives before any project is held", async () => {
    const pending = deferred<ProjectData>();
    mocks.fetchProject.mockReturnValueOnce(pending.promise).mockResolvedValue(initial);
    const { result } = renderHook(() => useProject(initial.id, null));
    const { design_tokens: _tokens, ...record } = toRow(initial);
    await act(async () => mocks.realtime({ eventType: "UPDATE", new: record }));
    expect(mocks.fetchProject).toHaveBeenCalledTimes(2);
    expect(result.current.project).toEqual(initial);
  });

  it("ignores out-of-order refresh responses", async () => {
    mocks.fetchProject.mockResolvedValue(initial);
    const { result } = renderHook(() => useProject(initial.id, initial));
    await act(async () => {});
    const old = deferred<ProjectData>();
    const recent = deferred<ProjectData>();
    mocks.fetchProject.mockReturnValueOnce(old.promise).mockReturnValueOnce(recent.promise);
    act(() => { notifyProjectChanged(initial.id); notifyProjectChanged(initial.id); });
    const newer = { ...initial, name: "Latest product" };
    await act(async () => recent.resolve(newer));
    await act(async () => old.resolve(initial));
    expect(result.current.project).toEqual(newer);
  });

  it("shows initial loading only when project data is missing and isolates navigation", async () => {
    const first = deferred<ProjectData>();
    const second = deferred<ProjectData>();
    mocks.fetchProject.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(({ id }) => useProject(id, null), { initialProps: { id: initial.id } });
    expect(result.current.isLoading).toBe(true);
    rerender({ id: "second" });
    await act(async () => first.resolve(initial));
    expect(result.current.project).toBeNull();
    await act(async () => second.resolve({ ...initial, id: "second" }));
    expect(result.current.project?.id).toBe("second");
    expect(result.current.isLoading).toBe(false);
  });
});
