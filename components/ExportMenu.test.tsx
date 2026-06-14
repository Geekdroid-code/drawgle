import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";
import type { ProjectData, ScreenData } from "@/lib/types";

const { buildAgentHandoffPromptMock, buildAgentPackZipMock, buildNativeScaffoldMock } = vi.hoisted(() => ({
  buildAgentHandoffPromptMock: vi.fn(() => "Auto-detect prompt with selected screen HTML"),
  buildAgentPackZipMock: vi.fn(() => new Uint8Array([1, 2, 3])),
  buildNativeScaffoldMock: vi.fn(() => ({ code: null, error: "Mock scaffold parse failure." })),
}));

vi.mock("@/lib/export-pipeline", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/export-pipeline")>();
  return {
    ...actual,
    buildAgentHandoffPrompt: buildAgentHandoffPromptMock,
    buildAgentPackZip: buildAgentPackZipMock,
    buildNativeScaffold: buildNativeScaffoldMock,
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

function renderMenu(initialScreenId = "details") {
  return render(
    <ExportMenu
      open
      onOpenChange={() => undefined}
      project={project}
      screens={screens}
      initialScreenId={initialScreenId}
      trigger={<Button>Export</Button>}
    />,
  );
}

describe("ExportMenu", () => {
  afterEach(() => {
    cleanup();
    buildAgentHandoffPromptMock.mockClear();
    buildAgentPackZipMock.mockClear();
    buildNativeScaffoldMock.mockClear();
  });

  it("shows selected-screen and whole-project actions together", () => {
    renderMenu();

    expect(screen.getByTestId("export-menu")).toBeTruthy();
    expect((screen.getByLabelText("Screen to export") as HTMLSelectElement).value).toBe("details");
    expect(screen.getByText("Copy for AI agent")).toBeTruthy();
    expect(screen.getByText("Download HTML / Tailwind")).toBeTruthy();
    expect(screen.getByText("Native Scaffolds")).toBeTruthy();
    expect(screen.getByText("Download Agent Pack")).toBeTruthy();
    expect(screen.queryByText(/Preview/)).toBeNull();
    expect(buildNativeScaffoldMock).not.toHaveBeenCalled();
  });

  it("always creates agent handoff and Agent Pack with auto detection", () => {
    renderMenu();

    expect(buildAgentHandoffPromptMock).toHaveBeenCalledWith(expect.objectContaining({
      screen: expect.objectContaining({ id: "details" }),
      target: "auto",
    }));

    fireEvent.click(screen.getByTestId("download-agent-pack"));

    expect(buildAgentPackZipMock).toHaveBeenCalledWith(expect.objectContaining({ target: "auto" }));
  });

  it("changes only the selected-screen actions when the screen selector changes", () => {
    renderMenu();

    fireEvent.change(screen.getByLabelText("Screen to export"), { target: { value: "home" } });

    expect(buildAgentHandoffPromptMock).toHaveBeenLastCalledWith(expect.objectContaining({
      screen: expect.objectContaining({ id: "home" }),
      target: "auto",
    }));
  });

  it("generates native scaffolds only after a Beta framework is clicked", () => {
    renderMenu();

    fireEvent.click(screen.getByTestId("toggle-scaffolds"));
    expect(screen.getByTestId("scaffold-options")).toBeTruthy();
    expect(buildNativeScaffoldMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /SwiftUI/ }));

    expect(buildNativeScaffoldMock).toHaveBeenCalledWith(expect.objectContaining({
      screen: expect.objectContaining({ id: "details" }),
      target: "swiftui",
    }));
    expect(screen.getByTestId("scaffold-error")).toBeTruthy();
    expect(screen.getByText("Download HTML / Tailwind")).toBeTruthy();
  });

  it("keeps the menu open and reveals a copyable instruction after Agent Pack download", () => {
    const createObjectURL = vi.fn(() => "blob:drawgle-test");
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL: vi.fn() });

    renderMenu();
    fireEvent.click(screen.getByTestId("download-agent-pack"));

    expect(screen.getByTestId("export-menu")).toBeTruthy();
    expect(screen.getByTestId("pack-after-download")).toBeTruthy();

    click.mockRestore();
    vi.unstubAllGlobals();
  });
});
