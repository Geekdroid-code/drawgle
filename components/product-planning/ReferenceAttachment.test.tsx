import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ReferenceAttachment } from "./ReferenceAttachment";
afterEach(cleanup);
const props = { image: { data: "pixels", mimeType: "image/png" }, mode: "style" as const, onChange: vi.fn(), onModeChange: vi.fn() };
describe("attachment controls", () => {
  it("explains local canvas use without offering a project recreation switch", () => {
    render(<ReferenceAttachment {...props} screenScoped />);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText("For this request · keeps project design")).toBeTruthy();
  });
  it("retains mode selection during initial discovery", () => {
    render(<ReferenceAttachment {...props} />);
    expect(screen.getByRole("combobox", { name: "Reference use" })).toBeTruthy();
  });
});
