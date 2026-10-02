import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SelectedElementInfo } from "@/components/ScreenNode";
import { selectionFixture } from "@/lib/visual-editor/test-fixtures";
import { useEditorDraft } from "./use-editor-draft";
import { VisualEditor } from "./VisualEditor";

function Fixture({ info, open = true }: { info: SelectedElementInfo; open?: boolean }) {
  const editor = useEditorDraft({ info, revision: 1, save: vi.fn(), upload: vi.fn() });
  return <VisualEditor info={info} editor={editor} tokens={[]} open={open} disabled={false} onClose={vi.fn()} onDelete={vi.fn()} />;
}
afterEach(cleanup);
describe("contextual inspector controls", () => {
  it("keeps a basic card compact and excludes destructive replacement", () => {
    const view = render(<Fixture info={selectionFixture("div", { "padding-top": "16px", "padding-right": "16px", "padding-bottom": "16px", "padding-left": "16px", "border-radius": "24px" })} />);
    expect(view.container.querySelectorAll("input,select,textarea")).toHaveLength(3);
    expect(view.queryByLabelText("Replace image")).toBeNull();
    expect(view.queryByLabelText("Thickness")).toBeNull();
    expect(view.getByRole("button", { name: "Apply changes" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(view.getByRole("button", { name: "More" }));
    expect(view.getByLabelText("Thickness")).toBeTruthy();
    expect(view.queryByLabelText("Transform")).toBeNull();
    expect(view.queryByText("Advanced details")).toBeNull();
  });
  it("offers only typography for text and retains asymmetric corners when opening", () => {
    const view = render(<Fixture info={selectionFixture("p")} />);
    expect(view.getByLabelText("Text content")).toBeTruthy(); expect(view.getByLabelText("Size")).toBeTruthy();
    expect(view.queryByLabelText("Padding")).toBeNull(); expect(view.queryByLabelText("Radius")).toBeNull();
    view.rerender(<Fixture info={selectionFixture("button", { "border-radius": "8px 16px 24px 4px" })} />);
    expect((view.getByLabelText("Radius") as HTMLInputElement).value).toBe("8px 16px 24px 4px");
    expect(view.getByRole("button", { name: "Apply changes" }).hasAttribute("disabled")).toBe(true);
  });
  it("retains grid structure and offers no flex direction or wrap controls", () => {
    const view = render(<Fixture info={selectionFixture("div", { display: "grid", gap: "12px", "align-items": "stretch", "justify-content": "space-between" })} />);
    expect(view.getByText("Grid layout")).toBeTruthy(); expect(view.getByLabelText("Gap")).toBeTruthy();
    expect(view.queryByLabelText("Direction")).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "More" })); expect(view.queryByLabelText("Wrap")).toBeNull();
    expect(view.getByRole("button", { name: "Apply changes" }).hasAttribute("disabled")).toBe(true);
  });
  it("hides the closed panel and excludes it from canvas obstacle measurement", () => {
    const view = render(<Fixture info={selectionFixture()} open={false} />);
    expect(view.container.querySelector('[data-canvas-obstacle="right"]')).toBeNull();
    expect(view.container.querySelector("aside")?.className).toContain("!hidden");
  });
});
