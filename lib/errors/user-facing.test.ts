import { describe, expect, it } from "vitest";
import { cleanErrorMessage } from "./user-facing";

const SAFETY = "Your description could not be processed. Please try rephrasing your request.";

describe("cleanErrorMessage", () => {
  it("keeps Drawgle's own progress text even when it mentions blocked work", () => {
    const stop = "Some approved screens could not be built. Completed screens are kept; resume to retry the failed ones and finish the flow.";
    expect(cleanErrorMessage(stop)).toBe(stop);
    expect(cleanErrorMessage("2 states are blocked until Home is built.")).toBe("2 states are blocked until Home is built.");
  });

  it("maps provider safety blocks to the rephrase message", () => {
    expect(cleanErrorMessage("Candidate was blocked due to SAFETY")).toBe(SAFETY);
    expect(cleanErrorMessage("Prompt blocked: PROHIBITED_CONTENT")).toBe(SAFETY);
    expect(cleanErrorMessage("Response was blocked, blockReason: OTHER")).toBe(SAFETY);
  });
});
