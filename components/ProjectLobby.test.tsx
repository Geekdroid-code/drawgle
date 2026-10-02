import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ push: vi.fn(), fetch: vi.fn(), readDraft: vi.fn(), imagePayload: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("next/image", () => ({ default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} /> }));
vi.mock("@/lib/client-entry-draft", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/client-entry-draft")>(),
  readClientEntryDraft: mocks.readDraft,
  draftImageToPromptPayload: mocks.imagePayload,
}));

import { ProjectLobby } from "./ProjectLobby";
import { getStylePresetSlug, showcaseCollections } from "@/lib/showcase";

const preset = { slug: "minimal-habit-premium", version: 2, title: "Quiet Habit", description: "Calm routines." };
const imagePayload = { data: "reference-pixels", mimeType: "image/png" };
const imageFile = () => new File(["reference-pixels"], "reference.png", { type: "image/png" });
const success = () => ({ ok: true, json: async () => ({ projectId: "created-project" }) });
const field = () => screen.getByRole("textbox", { name: "Describe the mobile app you want to design" }) as HTMLTextAreaElement;
const startButton = () => screen.getByRole("button", { name: "Start project" }) as HTMLButtonElement;
const referenceMode = () => screen.getByRole("combobox", { name: "How to use your reference" }) as HTMLSelectElement;
const postedBody = (index = 0) => JSON.parse(mocks.fetch.mock.calls[index][1].body);
const renderLobby = (props: Partial<ComponentProps<typeof ProjectLobby>> = {}) => render(<ProjectLobby user={{ id: "owner" }} initialProjects={[]} {...props} />);
const uploadImage = async (file = imageFile()) => {
  const input = screen.getByLabelText("Upload a reference image") as HTMLInputElement;
  await userEvent.upload(input, file);
  await screen.findByRole("button", { name: "Remove reference image" });
  return input;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetch.mockReset().mockResolvedValue(success());
  mocks.readDraft.mockReset().mockResolvedValue(null);
  mocks.imagePayload.mockReset().mockResolvedValue(imagePayload);
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("project lobby creation", () => {
  it("rejects empty and whitespace-only briefs through every submit path", () => {
    renderLobby();
    expect(startButton().disabled).toBe(true);
    fireEvent.submit(field().closest("form")!);
    fireEvent.change(field(), { target: { value: " \n  " } });
    fireEvent.keyDown(field(), { key: "Enter" });
    fireEvent.submit(field().closest("form")!);
    expect(startButton().disabled).toBe(true);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("trims the brief, posts once while busy, and opens the created project", async () => {
    renderLobby({ initialPrompt: "  A useful banking app  " });
    fireEvent.click(startButton());
    fireEvent.submit(field().closest("form")!);
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/project/created-project"));
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.fetch.mock.calls[0]).toMatchObject(["/api/projects", { method: "POST", headers: { "Content-Type": "application/json" } }]);
    expect(postedBody()).toEqual({
      clientRequestId: expect.stringMatching(/^[0-9a-f-]{36}$/i), prompt: "A useful banking app",
      image: null, imageReferenceMode: "style", stylePresetSlug: null,
    });
    expect(field().readOnly).toBe(true);
  });

  it("retains the request identity and selected preset after an uncertain response", async () => {
    mocks.fetch.mockRejectedValueOnce(new Error("Connection interrupted")).mockResolvedValueOnce(success());
    renderLobby({ initialPrompt: "  My habit app  ", initialStylePreset: preset });
    fireEvent.click(startButton());
    expect((await screen.findByRole("alert")).textContent).toContain("Connection interrupted");
    expect(field().value).toBe("  My habit app  ");
    fireEvent.click(startButton());
    await waitFor(() => expect(mocks.push).toHaveBeenCalled());
    expect(postedBody(1)).toEqual(postedBody(0));
    expect(postedBody().stylePresetSlug).toBe(preset.slug);
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });

  it("removes a curated style while preserving the brief", async () => {
    renderLobby({ initialPrompt: "My own habit app", initialStylePreset: preset });
    fireEvent.click(screen.getByRole("button", { name: "Remove curated style" }));
    expect(field().value).toBe("My own habit app");
    expect(screen.queryByRole("button", { name: "Remove curated style" })).toBeNull();
    fireEvent.click(startButton());
    await waitFor(() => expect(mocks.push).toHaveBeenCalled());
    expect(postedBody()).toMatchObject({ prompt: "My own habit app", stylePresetSlug: null, image: null });
  });

  it("applies a starter prompt and style while replacing an attached image", async () => {
    const direction = showcaseCollections.find((item) => item.id === "neo-mint")!;
    renderLobby({ initialPrompt: "An earlier idea" });
    await uploadImage();
    fireEvent.click(screen.getByRole("button", { name: /Neo Mint/ }));
    expect(field().value).toBe(direction.prompt);
    expect(screen.queryByRole("button", { name: "Remove reference image" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "How to use your reference" })).toBeNull();
    expect(screen.getByRole("button", { name: "Add reference" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove curated style" })).toBeTruthy();
    fireEvent.click(startButton());
    await waitFor(() => expect(mocks.push).toHaveBeenCalled());
    expect(postedBody()).toMatchObject({ prompt: direction.prompt, stylePresetSlug: getStylePresetSlug(direction), image: null });
  });

  it.each(["recreate", "style"] as const)("submits an image-only brief in %s mode and replaces its curated preset", async (mode) => {
    renderLobby({ initialStylePreset: preset });
    expect(screen.getByRole("button", { name: "Remove curated style" })).toBeTruthy();
    await uploadImage();
    expect(screen.queryByRole("button", { name: "Remove curated style" })).toBeNull();
    if (mode === "style") await userEvent.selectOptions(referenceMode(), "style");
    expect(referenceMode().value).toBe(mode);
    fireEvent.click(startButton());
    await waitFor(() => expect(mocks.push).toHaveBeenCalled());
    expect(postedBody()).toMatchObject({ prompt: "", image: imagePayload, imageReferenceMode: mode, stylePresetSlug: null });
  });

  it("swaps Add reference for the mode selector, restores it on removal, and accepts the same file again", async () => {
    renderLobby();
    expect(screen.getByRole("button", { name: "Add reference" })).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: "How to use your reference" })).toBeNull();
    const file = imageFile();
    const input = await uploadImage(file);
    expect(input.value).toBe("");
    expect(screen.queryByRole("button", { name: "Add reference" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Replace reference" })).toBeNull();
    expect(referenceMode().value).toBe("recreate");
    await userEvent.selectOptions(referenceMode(), "style");
    fireEvent.click(screen.getByRole("button", { name: "Remove reference image" }));
    expect(screen.queryByRole("button", { name: "Remove reference image" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "How to use your reference" })).toBeNull();
    expect(screen.getByRole("button", { name: "Add reference" })).toBeTruthy();
    expect(startButton().disabled).toBe(true);
    await uploadImage(file);
    expect(mocks.imagePayload).toHaveBeenCalledTimes(2);
    expect(referenceMode().value).toBe("recreate");
    expect(screen.queryByRole("button", { name: "Add reference" })).toBeNull();
    fireEvent.click(startButton());
    await waitFor(() => expect(mocks.push).toHaveBeenCalled());
    expect(postedBody()).toMatchObject({ image: imagePayload, imageReferenceMode: "recreate" });
  });

  it("restores the saved homepage brief and image before enabling creation", async () => {
    const savedImage = { blob: imageFile(), name: "homepage-reference.png" };
    mocks.readDraft.mockResolvedValueOnce({ prompt: "  Saved homepage brief  ", image: savedImage });
    renderLobby({ initialPrompt: "URL brief", initialClientDraftId: "saved-draft", initialStylePreset: preset });
    expect(field().readOnly).toBe(true);
    expect(startButton().disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("Restoring your draft");
    await screen.findByRole("button", { name: "Remove reference image" });
    expect(screen.getByTitle("homepage-reference.png")).toBeTruthy();
    expect(field().value).toBe("  Saved homepage brief  ");
    expect(mocks.readDraft).toHaveBeenCalledWith("saved-draft");
    expect(mocks.imagePayload).toHaveBeenCalledWith(savedImage);
    expect(screen.queryByRole("button", { name: "Remove curated style" })).toBeNull();
    fireEvent.click(startButton());
    await waitFor(() => expect(mocks.push).toHaveBeenCalled());
    expect(postedBody()).toMatchObject({ prompt: "Saved homepage brief", image: imagePayload, imageReferenceMode: "recreate", stylePresetSlug: null });
  });

  it("shows an expired-draft alert and lets the user enter a replacement brief", async () => {
    renderLobby({ initialClientDraftId: "expired-draft" });
    expect((await screen.findByRole("alert")).textContent).toContain("expired or is no longer available");
    expect(field().readOnly).toBe(false);
    fireEvent.change(field(), { target: { value: "A replacement idea" } });
    fireEvent.click(startButton());
    await waitFor(() => expect(mocks.push).toHaveBeenCalled());
    expect(postedBody().prompt).toBe("A replacement idea");
  });

  it("keeps Shift+Enter and IME composition available, then submits with Enter", async () => {
    renderLobby({ initialPrompt: "My first line" });
    fireEvent.keyDown(field(), { key: "Enter", shiftKey: true });
    fireEvent.keyDown(field(), { key: "Enter", isComposing: true });
    fireEvent.keyDown(field(), { key: "Enter", keyCode: 229 });
    expect(mocks.fetch).not.toHaveBeenCalled();
    fireEvent.change(field(), { target: { value: "My first line\nMy second line" } });
    fireEvent.keyDown(field(), { key: "Enter" });
    await waitFor(() => expect(mocks.push).toHaveBeenCalled());
    expect(postedBody().prompt).toBe("My first line\nMy second line");
  });
});
