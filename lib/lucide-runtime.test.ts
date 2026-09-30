// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { LUCIDE_DRAW_ICONS_CALL, LUCIDE_NAME_REPAIR_SCRIPT } from "./lucide-runtime";

type LucideWindow = Window & { lucide?: { icons: Record<string, unknown>; createIcons: () => void } };

/** The script as the screen's page runs it: its own function, called in the page. */
const repair = () => new Function(`${LUCIDE_NAME_REPAIR_SCRIPT}; return drawgleRepairLucideNames();`)() as number;

const page = (...names: string[]) => {
  document.body.innerHTML = names.map((name) => `<i data-lucide="${name}"></i>`).join("");
  return () => [...document.querySelectorAll("[data-lucide]")].map((node) => node.getAttribute("data-lucide"));
};

describe("repairing Lucide icon names before they are drawn", () => {
  afterEach(() => {
    delete (window as LucideWindow).lucide;
    document.body.innerHTML = "";
  });

  it("matches a name written without its dashes to the icon it means, and leaves names Lucide finds alone", () => {
    (window as LucideWindow).lucide = { icons: { FileText: [], BarChart3: [], Home: [], Grid2x2: [] }, createIcons: vi.fn() };
    const names = page("filetext", "barchart3", "file-text", "FileText", "home", "grid2x2", "no-such-icon");
    expect(repair()).toBe(2);
    expect(names()).toEqual(["FileText", "BarChart3", "file-text", "FileText", "home", "grid2x2", "no-such-icon"]);
  });

  it("does nothing before Lucide has loaded", () => {
    const names = page("filetext");
    expect(repair()).toBe(0);
    expect(names()).toEqual(["filetext"]);
  });

  it("is run before Lucide draws the page", () => {
    const createIcons = vi.fn(() => {
      // what Lucide sees when it draws
      expect(document.querySelector("[data-lucide]")?.getAttribute("data-lucide")).toBe("FileText");
    });
    (window as LucideWindow).lucide = { icons: { FileText: [] }, createIcons };
    page("filetext");
    new Function(`${LUCIDE_NAME_REPAIR_SCRIPT}; ${LUCIDE_DRAW_ICONS_CALL}`)();
    expect(createIcons).toHaveBeenCalledTimes(1);
  });
});
