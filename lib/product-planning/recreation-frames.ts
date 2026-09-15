import type { NavigationArchitecture, NavigationPlan, ScreenPlan } from "@/lib/types";

// Each supplied frame owns its chrome. A shared renderer shell cannot represent
// two reference frames with different overlays, navigation visibility or anatomy.
export function recreationFrameChrome(screens: ScreenPlan[]): {
  screens: ScreenPlan[]; navigationArchitecture: NavigationArchitecture; navigationPlan: NavigationPlan; requiresBottomNav: false;
} {
  return {
    requiresBottomNav: false,
    navigationArchitecture: { kind: "hierarchical", primaryNavigation: "none", rootChrome: "immersive", detailChrome: "immersive",
      consistencyRules: ["Recreate each frame's own visible chrome directly from its source."], rationale: "Supplied frames own their navigation markup." },
    navigationPlan: { version: 2, decision: "none", enabled: false, kind: "none", items: [], screenChrome: [],
      evidence: { source: null, reason: "Each source frame is reproduced independently, including its visible navigation." },
      visualBrief: "No injected navigation shell. Preserve navigation visible within each supplied frame." },
    screens: screens.map(screen => ({ ...screen, navigationItemId: null,
      chromePolicy: { chrome: "immersive", showPrimaryNavigation: false, showsBackButton: false } })),
  };
}
