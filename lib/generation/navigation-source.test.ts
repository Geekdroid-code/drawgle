// @vitest-environment node
import { describe, expect, it } from "vitest";
import { findNavigationSource, navigationFromScreen } from "./navigation-source";
import { renderDeterministicNavigationShell, sanitizeScreenCodeForSharedNavigation } from "@/lib/project-navigation";

const bar = `<nav class="fixed bottom-4 left-4 right-4 flex gap-3" aria-label="Bottom navigation"><div class="flex rounded-full bg-black p-1"><button aria-label="Home" data-active="true" class="rounded-full bg-zinc-800 p-4"><i data-lucide="house"></i></button><button aria-label="Health" class="p-4"><i data-lucide="activity"></i></button><button aria-label="Messages" class="p-4"><i data-lucide="message-circle"></i></button></div><button class="rounded-full bg-yellow-400 p-4"><i data-lucide="plus"></i></button></nav>`;
const screen = { id: "health", name: "Health Dashboard", code: `<main><h1>Health</h1><section>Vaccination</section>${bar}</main>` };

describe("adopting a screen's accepted navigation", () => {
  it("keeps the pill, its separate action, and exact destination icons", () => {
    const plan = navigationFromScreen(screen)!;
    expect(plan).not.toBeNull();
    expect(plan.items.map(item => item.icon)).toEqual(["house", "activity", "message-circle"]);
    const rendered = renderDeterministicNavigationShell(plan);
    expect(rendered).toContain("bg-black");
    expect(rendered).toContain("bg-yellow-400");
    expect(rendered).toContain('data-lucide="plus"');
    expect(rendered).not.toContain("Vaccination");
    expect(rendered).not.toContain("dumbbell");
    expect(rendered).toContain('data-dg-nav-state="active"');
  });
  it("uses the referenced source rather than the other screen's different icons", () => {
    const training = { ...screen, id: "training", name: "Training Tracker", code: screen.code.replace('data-lucide="activity"', 'data-lucide="dumbbell"') };
    const source = findNavigationSource([screen, training], "Use the Health Dashboard nav", [], null)!;
    expect(source.screen.id).toBe("health");
    expect(source.plan.items[1].icon).toBe("activity");
    expect(() => findNavigationSource([screen, training], "Use the same nav", [], null)).toThrow("several");
  });
  it("finds the existing source even when only the destination without a bar is named", () => {
    const training = { id: "training", name: "Training Tracker", code: "<main><h1>Training</h1></main>" };
    expect(findNavigationSource([screen, training], "Add the bottom nav to Training Tracker", [])?.screen.id).toBe("health");
    expect(() => findNavigationSource([screen, training], "Use that nav", ["other-project-screen"])).toThrow("no longer available");
  });
  it("does not promote a top menu or a bottom-positioned entire screen", () => {
    expect(navigationFromScreen({ ...screen, code: bar.replace("fixed bottom-4 left-4 right-4", "flex").replace("Bottom navigation", "Site menu") })).toBeNull();
    expect(navigationFromScreen({ ...screen, code: `<div class="fixed bottom-0"><h1>Screen</h1><button>A</button><button>B</button></div>` })).toBeNull();
  });
  it("removes adopted marked div bars from display without removing an unrelated top menu", () => {
    const local = bar.replace(/^<nav/, '<div data-dg-nav="bar"').replace(/<\/nav>$/, "</div>").replace("fixed bottom-4 left-4 right-4", "");
    const code = `<main><nav aria-label="Breadcrumb"><a>Home</a><a>Health</a></nav>${"<section><h2>Exercise</h2><p>Keep this content</p></section>".repeat(12)}${local}</main>`;
    const cleaned = sanitizeScreenCodeForSharedNavigation(code, { name: "Training", type: "root", description: "" }, { projectNavigationEnabled: true });
    expect(cleaned).not.toContain('data-dg-nav="bar"');
    expect(cleaned).toContain("Breadcrumb");
    expect(cleaned.match(/Keep this content/g)).toHaveLength(12);
  });
  it("does not silently replace a bar whose SVG destination identities are unknown", () => {
    const svg = screen.code.replace(/<i data-lucide="[^"]+"><\/i>/g, "<svg><path d=\"M0 0\"/></svg>");
    expect(() => findNavigationSource([{ ...screen, code: svg }], "Use the existing nav", [], null)).toThrow("could not safely extract");
  });
});
