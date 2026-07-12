import { cleanup, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";
import type { ProjectData, ScreenData } from "@/lib/types";

const { buildAgentHandoffPromptMock, buildAgentPackZipMock, buildStandaloneHtmlExportMock } = vi.hoisted(() => ({
  buildAgentHandoffPromptMock: vi.fn(() => "Auto-detect prompt with compiled selected screen HTML"),
  buildAgentPackZipMock: vi.fn(() => new Uint8Array([1, 2, 3])),
  buildStandaloneHtmlExportMock: vi.fn(() => "compiled standalone html"),
}));

vi.mock("@/lib/export-pipeline", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/export-pipeline")>();
  return {
    ...actual,
    buildAgentHandoffPrompt: buildAgentHandoffPromptMock,
    buildAgentPackZip: buildAgentPackZipMock,
    buildStandaloneHtmlExport: buildStandaloneHtmlExportMock,
  };
});

import { ExportMenu } from "./ExportMenu";

const project: ProjectData = {
  id: "project",
  userId: "user",
  name: "Export project",
  prompt: "Create a useful app.",
  status: "completed",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

const screens: ScreenData[] = [
  {
    id: "home",
    projectId: "project",
    userId: "user",
    name: "Home",
    code: "<main>Home marker</main>",
    prompt: "",
    x: 0,
    y: 0,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  },
  {
    id: "details",
    projectId: "project",
    userId: "user",
    name: "Details",
    code: "<main>Details marker</main>",
    prompt: "",
    x: 500,
    y: 0,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  },
];

function renderMenu(initialScreenId = "details", props: Partial<ComponentProps<typeof ExportMenu>> = {}) {
  return render(
    <ExportMenu
      open
      onOpenChange={() => undefined}
      project={project}
      screens={screens}
      initialScreenId={initialScreenId}
      trigger={<Button>Export</Button>}
      {...props}
    />,
  );
}

describe("ExportMenu", () => {
  afterEach(() => {
    cleanup();
    buildAgentHandoffPromptMock.mockClear();
    buildAgentPackZipMock.mockClear();
    buildStandaloneHtmlExportMock.mockClear();
  });

  it("shows selected-screen and whole-project actions together", () => {
    const view = renderMenu();

    expect(view.getByTestId("export-menu")).toBeTruthy();
    expect(view.getByText("Details")).toBeTruthy();
    expect(view.getByText("Copy Designs for AI Agent")).toBeTruthy();
    expect(view.getByText("Download HTML / Tailwind")).toBeTruthy();
    expect(view.getByText("Download Agent Pack")).toBeTruthy();
    expect(view.queryByText("Native Scaffolds")).toBeNull();
    expect(view.queryByText(/Preview/)).toBeNull();
    expect(buildStandaloneHtmlExportMock).toHaveBeenCalledWith(expect.objectContaining({
      screen: expect.objectContaining({ id: "details" }),
    }));
  });

  it("blocks fidelity exports when design token changes are unsaved", async () => {
    const user = userEvent.setup();
    const view = renderMenu("details", { tokenDirty: true });

    expect(view.getByTestId("selected-export-blocked").textContent).toContain("Save or discard design token changes");
    expect(view.getByTestId("agent-pack-blocked").textContent).toContain("Save or discard design token changes");
    expect(view.getByTestId("copy-for-agent").hasAttribute("disabled")).toBe(true);

    await user.click(view.getByTestId("download-agent-pack"));
    expect(buildAgentPackZipMock).not.toHaveBeenCalled();
  });

  it("blocks selected-screen exports when the selected screen is not ready", async () => {
    const user = userEvent.setup();
    const blockedScreens = screens.map((screen) => screen.id === "details" ? { ...screen, status: "building" as const } : screen);
    const view = renderMenu("details", { screens: blockedScreens });

    expect(view.getByTestId("selected-export-blocked").textContent).toContain("This screen is still building");
    expect(view.getByTestId("copy-for-agent").hasAttribute("disabled")).toBe(true);
  });
  it("always creates agent handoff and Agent Pack with auto detection", async () => {
    const user = userEvent.setup();
    const view = renderMenu();

    expect(buildAgentHandoffPromptMock).toHaveBeenCalledWith(expect.objectContaining({
      screen: expect.objectContaining({ id: "details" }),
      target: "auto",
    }));

    await user.click(view.getByTestId("download-agent-pack"));

    expect(buildAgentPackZipMock).toHaveBeenCalledWith(expect.objectContaining({ target: "auto" }));
  });

  it("changes only the selected-screen actions when the screen selector changes", async () => {
    const user = userEvent.setup();
    const view = renderMenu();

    await user.click(view.getByText("Home"));

    expect(buildAgentHandoffPromptMock).toHaveBeenLastCalledWith(expect.objectContaining({
      screen: expect.objectContaining({ id: "home" }),
      target: "auto",
    }));
  });

  it("keeps the menu open and reveals a copyable instruction after Agent Pack download", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => "blob:drawgle-test");
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL: vi.fn() });

    const view = renderMenu();
    await user.click(view.getByTestId("download-agent-pack"));

    expect(view.getByTestId("export-menu")).toBeTruthy();
    expect(view.getByTestId("pack-after-download")).toBeTruthy();

    click.mockRestore();
    vi.unstubAllGlobals();
  });
});
