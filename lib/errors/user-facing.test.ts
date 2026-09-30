import { describe, expect, it } from "vitest";
import { cleanErrorMessage } from "./user-facing";

const SAFETY = "Your description could not be processed. Please try rephrasing your request.";

describe("cleanErrorMessage", () => {
  it("keeps Drawgle's own progress text even when it mentions blocked work", () => {
    const stop = "Some approved screens could not be built. Completed screens are kept; resume to retry the failed ones and finish the flow.";
    expect(cleanErrorMessage(stop)).toBe(stop);
    expect(cleanErrorMessage("2 states are blocked until Home is built.")).toBe("2 states are blocked until Home is built.");
  });

  it("reads Drawgle's own diagnostic codes as messages, not as JSON to hide", () => {
    // they start with a bracket, and were once taken for a serialized payload and replaced by the generic message
    expect(cleanErrorMessage("[screen_generation:incomplete] The build stopped at a trailing_open_tag."))
      .toBe("This screen could not be finished because the generated layout was incomplete. Please retry.");
    expect(cleanErrorMessage("[screen_generation:emptied_by_cleanup] Cleaning up the built screen removed most of it, so it was not saved."))
      .toBe("This screen could not be finalized. Please retry.");
    expect(cleanErrorMessage("[screen_health:tag_imbalance] Mismatched closing tags.")).toBe("This screen could not be finalized because the generated layout was invalid. Please retry.");
    // a real serialized payload is still never shown
    expect(cleanErrorMessage('[{"code":"XX000","detail":"internal"}]')).toBe("Something went wrong while designing your screen. Please try again.");
  });

  it("maps provider safety blocks to the rephrase message", () => {
    expect(cleanErrorMessage("Candidate was blocked due to SAFETY")).toBe(SAFETY);
    expect(cleanErrorMessage("Prompt blocked: PROHIBITED_CONTENT")).toBe(SAFETY);
    expect(cleanErrorMessage("Response was blocked, blockReason: OTHER")).toBe(SAFETY);
  });
});
