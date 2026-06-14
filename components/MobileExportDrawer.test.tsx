import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProjectData, ScreenData } from "@/lib/types";

const { buildNativeScaffoldMock } = vi.hoisted(() => ({
  buildNativeScaffoldMock: vi.fn(() => ({ code: null, error: "Mock scaffold parse failure." })),
}));

vi.mock("@/lib/export-pipeline", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/export-pipeline")>();
  return {
    ...actual,
    buildNativeScaffold: buildNativeScaffoldMock,
  };
});

import { MobileExportDrawer } from "./MobileExportDrawer";

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

describe("MobileExportDrawer", () => {
  afterEach(() => {
    cleanup();
    buildNativeScaffoldMock.mockClear();
  });

  it("opens on Agent Handoff with the requested screen and actions", () => {
    render(
      <MobileExportDrawer
        open
        onClose={() => undefined}
        project={project}
        screens={screens}
        initialScreenId="details"
      />,
    );

    expect(screen.getByText("Ship to Code")).toBeTruthy();
    expect(screen.getByTestId("copy-for-agent")).toBeTruthy();
    expect(screen.getByTestId("download-agent-pack")).toBeTruthy();
    expect(screen.getByText(/Details marker/)).toBeTruthy();
    expect(screen.getByText("Recommended workflow")).toBeTruthy();
    expect(buildNativeScaffoldMock).not.toHaveBeenCalled();
  });

  it("updates the prompt target and selected screen", () => {
    render(
      <MobileExportDrawer
        open
        onClose={() => undefined}
        project={project}
        screens={screens}
        initialScreenId="home"
      />,
    );

    fireEvent.change(screen.getByLabelText("Implementation target"), { target: { value: "swiftui" } });
    fireEvent.change(screen.getByLabelText("Screen"), { target: { value: "details" } });

    expect(screen.getByText(/Implement this screen in SwiftUI/)).toBeTruthy();
    expect(screen.getByText(/Details marker/)).toBeTruthy();
  });

  it("copies the agent prompt and downloads the project pack", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const createObjectURL = vi.fn(() => "blob:drawgle-test");
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL: vi.fn() });

    render(
      <MobileExportDrawer
        open
        onClose={() => undefined}
        project={project}
        screens={screens}
        initialScreenId="home"
      />,
    );

    fireEvent.click(screen.getByTestId("copy-for-agent"));
    fireEvent.click(screen.getByTestId("download-agent-pack"));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Home marker"));
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(await screen.findByText("After adding the pack")).toBeTruthy();

    click.mockRestore();
    vi.unstubAllGlobals();
  });

  it("isolates Beta Scaffold failures from Agent Handoff and HTML", async () => {
    render(
      <MobileExportDrawer
        open
        onClose={() => undefined}
        project={project}
        screens={screens}
        initialScreenId="home"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Scaffolds/ }));
    expect(await screen.findByTestId("scaffold-error")).toBeTruthy();
    expect(screen.getByText("Agent Handoff and HTML export are still available.")).toBeTruthy();
    expect(buildNativeScaffoldMock).toHaveBeenCalledTimes(1);
  });
});
