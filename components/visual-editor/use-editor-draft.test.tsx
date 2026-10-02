import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useEditorDraft } from "./use-editor-draft";
import { selectionFixture } from "@/lib/visual-editor/test-fixtures";

describe("visual edit session", () => {
  it("preserves pending changes on rehydration and disables stale saves", async () => {
    const save = vi.fn(); const info = selectionFixture();
    const { result, rerender } = renderHook(({ revision, selected }) => useEditorDraft({ info: selected, revision, save, upload: vi.fn() }), { initialProps: { revision: 1, selected: info } });
    act(() => result.current.styles({ "border-radius": "12px" }));
    rerender({ revision: 1, selected: { ...info, selectionReason: "rehydrated" } });
    expect(result.current.dirty).toBe(true); expect(result.current.preview?.styles).toEqual({ "border-radius": "12px" });
    rerender({ revision: 2, selected: info });
    expect(result.current.stale).toBe(true); await act(async () => { expect(await result.current.apply()).toBe(false); });
    expect(save).not.toHaveBeenCalled();
    act(() => result.current.discard()); expect(result.current.dirty).toBe(false);
  });
  it("retains a failed save and retries with the same request identity", async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error("Connection lost")).mockResolvedValue({ revision: 2, changed: true });
    const { result } = renderHook(() => useEditorDraft({ info: selectionFixture(), revision: 1, save, upload: vi.fn() }));
    act(() => result.current.text("label", "Find nearby"));
    expect(result.current.preview?.text).toEqual({ label: "Find nearby" });
    await act(async () => { await result.current.apply(); });
    expect(result.current.dirty).toBe(true); expect(result.current.error).toBe("Connection lost");
    await act(async () => { await result.current.apply(); });
    expect(save.mock.calls[0][1]).toEqual(save.mock.calls[1][1]); expect(result.current.dirty).toBe(false);
  });
  it("keeps redo after draft undo without entering saved history", () => {
    const { result } = renderHook(() => useEditorDraft({ info: selectionFixture(), revision: 1, save: vi.fn(), upload: vi.fn() }));
    act(() => result.current.styles({ "border-radius": "12px" })); act(() => result.current.undo());
    expect(result.current.dirty).toBe(false); expect(result.current.hasLocalHistory).toBe(true); expect(result.current.canRedo).toBe(true);
    act(() => result.current.redo()); expect(result.current.dirty).toBe(true);
  });
  it("retains a replacement through upload failure and saves media and style in one batch", async () => {
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:preview"), revokeObjectURL: vi.fn() }));
    const upload = vi.fn().mockRejectedValueOnce(new Error("Upload interrupted")).mockResolvedValue("/uploaded.png");
    const save = vi.fn().mockResolvedValue({ revision: 2, changed: true });
    const { result } = renderHook(() => useEditorDraft({ info: selectionFixture("img"), revision: 1, save, upload }));
    act(() => { result.current.image({ kind: "img", label: "Image", drawgleId: "card", tagName: "img", src: "/original.png" }, new File(["image"], "image.png", { type: "image/png" })); });
    act(() => result.current.styles({ "border-radius": "12px" }));
    await act(async () => { await result.current.apply(); });
    expect(result.current.preview?.image?.src).toBe("blob:preview"); expect(save).not.toHaveBeenCalled();
    await act(async () => { await result.current.apply(); });
    expect(save).toHaveBeenCalledOnce(); expect(save.mock.calls[0][0]).toEqual([
      { type: "setStyle", property: "border-radius", value: "12px" },
      { type: "replaceImage", drawgleId: "card", mode: "src", src: "/uploaded.png", alt: "Project image", targetIndex: undefined },
    ]);
  });
  it("rejects apply when the selected target disappears, retaining the draft", async () => {
    const save = vi.fn();
    const { result, rerender } = renderHook(({ unavailable }) => useEditorDraft({ info: selectionFixture(), revision: 1, unavailable, save, upload: vi.fn() }), { initialProps: { unavailable: false } });
    act(() => result.current.styles({ "border-radius": "12px" })); rerender({ unavailable: true });
    expect(result.current.stale).toBe(true); await act(async () => { expect(await result.current.apply()).toBe(false); });
    expect(save).not.toHaveBeenCalled(); expect(result.current.dirty).toBe(true);
  });
});
