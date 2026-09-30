import { describe, expect, it } from "vitest";

import { extractStyleComponents } from "@/lib/generation/style-component-extraction";
import { MAX_STYLE_COMPONENT_HTML_CHARS, MAX_STYLE_COMPONENTS } from "@/lib/generation/style-components";

const specimen = `
<div class="w-full min-h-screen dg-bg-primary" data-drawgle-id="root">
  <header class="px-4"><h1 class="dg-type-screen-title">Good morning, Alexandra Whitfield-Montgomery</h1></header>
  <div data-dg-component="calendar-strip" data-dg-use="a week selector at the top of a day view" id="week" class="dg-surface-card dg-radius-app flex gap-2 p-3">
    <div class="dg-tint-1 dg-radius-pill px-3">Mon</div>
    <div class="dg-tint-1 dg-radius-pill px-3">Tue</div>
    <div class="dg-tint-1 dg-radius-pill px-3">Wed</div>
    <div class="dg-tint-1 dg-radius-pill px-3">Thu</div>
    <div class="dg-tint-1 dg-radius-pill px-3">Fri</div>
  </div>
  <div data-dg-component="stat-tile-pair" data-dg-use="two counts side by side" class="grid grid-cols-2 gap-2" onclick="track()">
    <div class="dg-surface-inset dg-radius-inner p-3"><p class="dg-type-caption">Meals eaten by the whole family today</p><p class="dg-type-metric-value">3</p></div>
    <div class="dg-surface-inset dg-radius-inner p-3"><p class="dg-type-caption">Medications given</p><p class="dg-type-metric-value">2</p></div>
  </div>
  <div data-dg-component="calendar-strip" class="second-instance">Another calendar strip that must not win</div>
  <section data-dg-component="Health Progress Donut" class="dg-surface-card dg-radius-app p-4">
    <svg viewBox="0 0 40 40" width="64" height="64"><circle cx="20" cy="20" r="16" fill="none" stroke-width="6"></circle></svg>
    <img src="https://example.com/photo.jpg" srcset="a.jpg 1x" class="h-8 w-8" alt="">
    <a href="/details" class="dg-type-supporting">See the full vaccination record and history</a>
    <script>alert(1)</script>
  </section>
</div>`;

describe("extractStyleComponents", () => {
  it("keeps one instance for each marked component, in the order they appear", () => {
    const { components, skipped } = extractStyleComponents(specimen);
    expect(components.map((component) => component.name)).toEqual(["calendar-strip", "stat-tile-pair", "health-progress-donut"]);
    expect(skipped).toEqual([]);
    // the first instance, not the second
    expect(components[0].html).toContain("dg-surface-card");
    expect(components[0].html).not.toContain("second-instance");
    expect(components[0].use).toBe("a week selector at the top of a day view");
  });

  it("keeps a top bar built as a <nav>, and still leaves the bottom bar to the renderer", () => {
    const html = `<div>
      <nav data-dg-component="header-detail" data-dg-use="the top bar of a detail screen" class="flex items-center border-b-4 border-black p-3"><button>Back</button><h1>Title</h1></nav>
      <nav data-dg-component="dock" class="fixed bottom-0"><a>Home</a><a>Me</a></nav>
      <nav data-dg-component="links" class="flex"><a>One</a><a>Two</a></nav>
    </div>`;
    const { components, skipped } = extractStyleComponents(html);
    expect(components.map((component) => component.name)).toEqual(["header-detail"]);
    expect(skipped.map((item) => item.name)).toEqual(["dock", "links"]);
  });

  it("falls back to a use that names the component when the build did not say", () => {
    const { components } = extractStyleComponents(specimen);
    expect(components[2].use).toBe("Use as the health progress donut");
  });

  it("removes everything that is not construction", () => {
    const { components } = extractStyleComponents(specimen);
    const all = components.map((component) => component.html).join("\n");
    for (const dropped of ["data-dg-component", "data-dg-use", "data-drawgle-id", "id=", "onclick", "srcset", "src=", "href=", "<script"]) {
      expect(all, `still contains ${dropped}`).not.toContain(dropped);
    }
    // classes and structure are what a builder copies
    expect(components[2].html).toContain("<svg");
    expect(components[2].html).toContain('class="dg-surface-card dg-radius-app p-4"');
    expect(components[2].html).toContain('class="h-8 w-8"');
  });

  it("cuts the text to short samples", () => {
    const { components } = extractStyleComponents(specimen);
    expect(components[1].html).toContain(">Meals eaten by the whole<");
    expect(components[1].html).not.toContain("family today");
    expect(components[2].html).not.toContain("See the full vaccination record and history");
    expect(components[2].html).toMatch(/See the full vaccination/);
    // a short label is left alone
    expect(components[0].html).toContain(">Mon<");
  });

  it("shows a repeating pattern with a few instances and leaves a pair alone", () => {
    const rows = Array.from({ length: 8 }, (_, index) => `<div class="dg-surface-inset flex gap-3 p-3 dg-radius-inner"><span class="dg-type-body">Row ${index}</span><i data-lucide="chevron-right"></i></div>`).join("");
    const { components } = extractStyleComponents(`<div data-dg-component="row-list" class="dg-surface-card dg-radius-app p-4 flex flex-col gap-2">${rows}${rows}</div>`);
    expect(components).toHaveLength(1);
    expect(components[0].html.length).toBeLessThanOrEqual(MAX_STYLE_COMPONENT_HTML_CHARS);
    expect(components[0].html.match(/dg-surface-inset/g)).toHaveLength(2);
    // the pair in the stat tiles is not a repeat
    expect(extractStyleComponents(specimen).components[1].html.match(/dg-surface-inset/g)).toHaveLength(2);
  });

  it("writes a long token class as its short utility class, and an action fill with its text colour as the action class", () => {
    const { components } = extractStyleComponents(`
      <div data-dg-component="search-bar" class="rounded-[var(--dg-radii-app)] bg-[var(--dg-color-surface-card)] px-[var(--dg-mobile-layout-screen-margin)] gap-[var(--dg-mobile-layout-element-gap)] shadow-[var(--dg-shadows-overlay)] flex">
        <span class="text-[var(--dg-color-text-medium-emphasis)] text-[var(--dg-color-text-medium-emphasis)]">Search</span>
        <button class="rounded-[var(--dg-radii-pill)] bg-[var(--dg-color-action-primary)] text-[var(--dg-color-action-on-primary-text)] w-10">Go</button>
        <button class="bg-[var(--dg-color-action-primary)] w-10">Fill only</button>
        <i class="bg-[#FFE082] rounded-[12px]">Custom</i>
      </div>`);
    expect(components[0].html).toContain('class="dg-radius-app dg-surface-card dg-screen-padding dg-element-gap dg-shadow-overlay flex"');
    // said twice, kept once
    expect(components[0].html).toContain('<span class="dg-text-medium">Search</span>');
    // the fill and its text colour together are the action class; a fill alone is left as it was
    expect(components[0].html).toContain('<button class="dg-radius-pill dg-action-primary w-10">Go</button>');
    expect(components[0].html).toContain('<button class="bg-[var(--dg-color-action-primary)] w-10">Fill only</button>');
    // a value the runtime has no class for stays as the build wrote it
    expect(components[0].html).toContain('class="bg-[#FFE082] rounded-[12px]"');
  });

  it("gets a component that was over the size limit only by its long class names under it", () => {
    const long = "rounded-[var(--dg-radii-app)] bg-[var(--dg-color-surface-card)] text-[var(--dg-color-text-high-emphasis)] shadow-[var(--dg-shadows-overlay)]";
    const item = `<div class="${long}"><span class="${long}">x</span></div>`;
    // enough of them to be over the limit as written, and under it once their classes are the short ones
    const markup = `<div data-dg-component="row" class="${long} flex">${item.repeat(2)}${item.repeat(2)}${item.repeat(2)}</div>`;
    expect(markup.length - "<div data-dg-component=\"row\" data-dg-use=\"\"></div>".length).toBeGreaterThan(MAX_STYLE_COMPONENT_HTML_CHARS);
    const { components, skipped } = extractStyleComponents(markup);
    expect(skipped).toEqual([]);
    expect(components[0].html.length).toBeLessThanOrEqual(MAX_STYLE_COMPONENT_HTML_CHARS);
  });

  it("skips a component that is still too large to copy, and says why", () => {
    const huge = `<div data-dg-component="chart-panel" class="p-4">${Array.from({ length: 6 }, (_, index) => `<svg viewBox="0 0 10 10"><path d="${"M0 0L1 1".repeat(400)}" data-n="${index}"></path></svg>`).join("")}</div>`;
    const { components, skipped } = extractStyleComponents(`${huge}<div data-dg-component="chip" class="dg-tint-1 dg-radius-pill px-3">Label</div>`);
    expect(components.map((component) => component.name)).toEqual(["chip"]);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].name).toBe("chart-panel");
    expect(skipped[0].reason).toContain("too large to copy");
  });

  it("leaves out a marked element inside a component that is kept, and keeps it when the outer one was too large", () => {
    const huge = Array.from({ length: 6 }, () => `<svg viewBox="0 0 10 10"><path d="${"M0 0L1 1".repeat(400)}"></path></svg>`).join("");
    const { components, skipped } = extractStyleComponents(`
      <section data-dg-component="mood-card" class="dg-surface-card dg-radius-app p-4">
        <div data-dg-component="mood-item" class="dg-tint-1 dg-radius-pill">Mon</div>
      </section>
      <div data-dg-component="chart-panel" class="p-4">${huge}<div data-dg-component="legend-item" class="dg-tint-2 dg-radius-pill">Sleep</div></div>
      <div data-dg-component="stat-tile" class="dg-surface-inset dg-radius-inner p-3">3h 15m</div>`);
    expect(components.map((component) => component.name)).toEqual(["mood-card", "legend-item", "stat-tile"]);
    expect(skipped.map((item) => item.name)).toEqual(["mood-item", "chart-panel"]);
    expect(skipped[0].reason).toBe("part of mood-card, which is kept whole");
    expect(skipped[1].reason).toContain("too large to copy");
  });

  it("skips markers with no usable name and elements with nothing in them", () => {
    const { components, skipped } = extractStyleComponents(`
      <div data-dg-component="" class="a">x</div>
      <div data-dg-component="!!!" class="b">y</div>
      <div data-dg-component="empty-box"></div>
      <div data-dg-component="badge" class="dg-tint-2">New</div>`);
    expect(components.map((component) => component.name)).toEqual(["badge"]);
    expect(skipped.map((item) => item.reason)).toEqual([
      "the marker has no usable name",
      "the marker has no usable name",
      "the marked element is empty",
    ]);
  });

  it("keeps at most ten components", () => {
    const many = Array.from({ length: 13 }, (_, index) => `<div data-dg-component="component-${index}" class="c${index}">Item ${index}</div>`).join("");
    const { components, skipped } = extractStyleComponents(many);
    expect(components).toHaveLength(MAX_STYLE_COMPONENTS);
    expect(skipped).toHaveLength(3);
    expect(skipped[0].reason).toContain("only the first 10");
  });

  it("finds nothing in a build that marked nothing", () => {
    expect(extractStyleComponents("<div class=\"p-4\">Plain</div>")).toEqual({ components: [], skipped: [] });
    expect(extractStyleComponents("")).toEqual({ components: [], skipped: [] });
  });
});
