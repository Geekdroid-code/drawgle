import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductQuestionCard } from "./ProductQuestionCard";
import type { ProductQuestions } from "@/lib/product-planning/questions";

const questions: ProductQuestions = [{
  question: "How does your shop work?",
  consequence: "This shapes product discovery.",
  choices: [
    { label: "Always available", description: "An evergreen catalog makes repeat shopping simple." },
    { label: "Limited drops", description: "Highlight the current release and availability." },
    { label: "Both", description: "Keep essentials available alongside special releases." },
  ],
}];
const messageId = "11111111-1111-4111-8111-111111111111";

afterEach(cleanup);

describe("optional product question cards", () => {
  it("shows three choices, one recommendation, custom input and Skip without auto-submitting", async () => {
    const onSubmit = vi.fn(async (_input: unknown) => true);
    render(<ProductQuestionCard questions={questions} messageId={messageId} active onSubmit={onSubmit} />);
    expect(screen.getAllByText("Recommended")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Write my own/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Skip" })).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /Always available/ })));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      productAnswers: { messageId, answers: [{ kind: "choice", index: 0 }] },
    });
  });

  it("selects choices and opens custom answers via keyboard shortcuts 1-4 and supports cancelation", async () => {
    const onSubmit = vi.fn(async (_input: unknown) => true);
    const view = render(<ProductQuestionCard questions={questions} messageId={messageId} active onSubmit={onSubmit} />);

    // Press '4' to open custom answer form
    fireEvent.keyDown(window, { key: "4" });
    expect(screen.getByRole("textbox", { name: "Your answer" })).toBeTruthy();

    // Click 'Cancel' to close custom answer form
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("textbox", { name: "Your answer" })).toBeNull();

    // Press '4' again, then Escape to close
    fireEvent.keyDown(window, { key: "4" });
    expect(screen.getByRole("textbox", { name: "Your answer" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("textbox", { name: "Your answer" })).toBeNull();

    // Press '1' to select first choice
    await act(async () => {
      fireEvent.keyDown(window, { key: "1" });
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      productAnswers: { messageId, answers: [{ kind: "choice", index: 0 }] },
    });

    view.unmount();
  });

  it("shows one question at a time and submits skipped decisions as assumptions", async () => {
    const onSubmit = vi.fn(async (_input: unknown) => true);
    render(
      <ProductQuestionCard
        questions={[...questions, { ...questions[0], question: "What about onboarding?" }]}
        messageId={messageId}
        active
        onSubmit={onSubmit}
      />
    );
    expect(screen.queryByText("What about onboarding?")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("What about onboarding?")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Skip" })));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      productAnswers: { answers: [{ kind: "skip" }, { kind: "skip" }] },
    });
  });

  it("accepts a custom answer and retains the identical turn ID on failed retries", async () => {
    const onSubmit = vi.fn(async (_input: unknown) => false);
    render(<ProductQuestionCard questions={questions} messageId={messageId} active onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: /Write my own/ }));
    expect((screen.getByRole("button", { name: "Use my answer" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox", { name: "Your answer" }), { target: { value: "Preorders only" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Use my answer" })));
    expect(screen.getByRole("alert")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Retry" })));
    expect(onSubmit.mock.calls[0][0]).toEqual(onSubmit.mock.calls[1][0]);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      productAnswers: { answers: [{ kind: "custom", text: "Preorders only" }] },
    });
  });

  it("prevents double submissions and collapses obsolete cards", async () => {
    let resolve!: (ok: boolean) => void;
    const onSubmit = vi.fn(() => new Promise<boolean>((done) => { resolve = done; }));
    const view = render(<ProductQuestionCard questions={questions} messageId={messageId} active onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(onSubmit).toHaveBeenCalledOnce();
    await act(async () => resolve(true));
    view.rerender(<ProductQuestionCard questions={questions} messageId={messageId} active={false} onSubmit={onSubmit} />);
    expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();
  });
});
