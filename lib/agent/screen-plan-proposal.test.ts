import { describe, expect, it } from "vitest";

import { buildScreenSuggestionSummary, isGenericScreenSuggestion } from "@/lib/agent/screen-plan-proposal";

const product = {
  projectName: "Premium Calisthenics Tracker",
  projectPrompt: "Build a premium calisthenics tracker with personalized goals and weekly schedule.",
  appType: "Fitness & Performance Tracker",
  targetAudience: "Calisthenics athletes focused on skill progression and routine consistency.",
  keyFeatures: [
    "Daily Workout Dashboard",
    "Interactive Weekly Schedule",
    "Skill-based Goal Progression",
  ],
};

describe("screen plan approval summaries", () => {
  it.each(["planner screen", "detail screen", "A new screen that follows the existing project direction."])(
    "rejects a generic router role: %s",
    (role) => expect(isGenericScreenSuggestion(role)).toBe(true),
  );

  it("keeps a concrete router role", () => {
    const role = "Shows the athlete's scheduled workouts by day and lets them open or adjust each training block.";
    expect(buildScreenSuggestionSummary({
      screenName: "Weekly Schedule",
      routerRole: role,
      instruction: "Design a weekly schedule",
      product,
    })).toBe(role);
  });

  it("expands a plausible but thin role that lacks enough product detail", () => {
    const summary = buildScreenSuggestionSummary({
      screenName: "Weekly Schedule",
      routerRole: "A view for weekly planning.",
      instruction: "Design a weekly schedule",
      product,
    });

    expect(summary).toContain("Fitness & Performance Tracker");
    expect(summary).not.toBe("A view for weekly planning.");
  });

  it("replaces a generic role with a project-aware deterministic fallback", () => {
    const summary = buildScreenSuggestionSummary({
      screenName: "Weekly Schedule",
      routerRole: "planner screen",
      instruction: "Let's design weekly schedule",
      product,
    });

    expect(summary).toContain("Fitness & Performance Tracker");
    expect(summary).toContain("Calisthenics athletes");
    expect(summary).toContain("interactive weekly schedule");
    expect(summary).not.toContain("planner screen");
  });
});
