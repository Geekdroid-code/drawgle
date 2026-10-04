import { deltaE2000, hexDeltaE, labChroma, rgbToHex, rgbToLab } from "@/lib/color-lab";
import { hasCastShadow, parseShadowLayers } from "@/lib/shadow-css";

/**
 * Cheap, automatic checks on a rendered Drawgle screen.
 *
 * Two halves:
 * - PROBE_SOURCE runs inside Chromium and only collects facts. It is plain source
 *   text on purpose: a function passed to page.evaluate is serialised after
 *   bundling, and the Trigger.dev bundler wraps inner functions in a __name()
 *   helper that only exists in Node (see lib/generation/viewport-health.ts).
 * - evaluateScreen and friends are pure functions from those facts to findings,
 *   so they are unit-tested without a browser.
 */

export type ElevationClass = "flat-tone" | "hairline" | "soft-shadow" | "strong-shadow";
export type ReferenceElevation = ElevationClass | "unknown";

export const MAX_CARD_RADIUS_PX = 24;
/** Acceptance bound from the plan: card and page within this ΔE of the measured reference. */
export const TONE_MATCH_MAX_DELTA_E = 4;
export const SURFACE_MIN_WIDTH_PX = 96;
export const SURFACE_MIN_HEIGHT_PX = 44;

export type ProbeRgba = { r: number; g: number; b: number; a: number };

export type ProbeElement = {
  tag: string;
  label: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Largest corner radius in px. */
  radius: number;
  /** True for capsules and circles: the radius is at least half the shorter side. */
  pill: boolean;
  bg: ProbeRgba | null;
  gradient: boolean;
  image: boolean;
  border: number;
  shadow: string;
  clips: boolean;
  inNav: boolean;
};

export type ProbeLocalNavigation = { label: string; reason: string; itemCount: number };

export type ProbeFacts = {
  viewport: { width: number; height: number };
  scrollHeight: number;
  pageBackground: ProbeRgba | null;
  elements: ProbeElement[];
  localNavigation: ProbeLocalNavigation[];
  sharedNavigation: { present: boolean; itemCount: number };
  assets: { slots: number; placeholders: number; images: number; brokenImages: number };
  /** Elements the screen itself pinned with position: fixed, and the controls or text each one covers. */
  pinned?: { count: number; covering: Array<{ label: string; covers: string }> };
};

export const PROBE_SOURCE = `() => {
  const MAX_ELEMENTS = 1800;
  const root = document.querySelector("#drawgle-export-root");
  const navigationRoot = document.querySelector("#drawgle-export-navigation");
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const scrollHeight = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
  const facts = {
    viewport: viewport,
    scrollHeight: scrollHeight,
    pageBackground: null,
    elements: [],
    localNavigation: [],
    sharedNavigation: { present: false, itemCount: 0 },
    assets: { slots: 0, placeholders: 0, images: 0, brokenImages: 0 },
  };
  if (!root) return facts;

  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const toRgba = (value) => {
    if (!value || value === "transparent") return null;
    const match = /^rgba?\\(\\s*([\\d.]+)[,\\s]+([\\d.]+)[,\\s]+([\\d.]+)(?:[,\\s/]+([\\d.]+%?))?\\s*\\)$/.exec(value);
    if (match) {
      let alpha = 1;
      if (match[4] !== undefined) alpha = match[4].slice(-1) === "%" ? parseFloat(match[4]) / 100 : parseFloat(match[4]);
      if (!(alpha > 0.004)) return null;
      return { r: Math.round(parseFloat(match[1])), g: Math.round(parseFloat(match[2])), b: Math.round(parseFloat(match[3])), a: Math.round(alpha * 1000) / 1000 };
    }
    // color-mix(), color(), oklch() and friends: let the canvas resolve them to sRGB.
    if (!context) return null;
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = "#000000";
    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);
    const data = context.getImageData(0, 0, 1, 1).data;
    return data[3] === 0 ? null : { r: data[0], g: data[1], b: data[2], a: Math.round((data[3] / 255) * 1000) / 1000 };
  };
  const cornerRadius = (raw, width, height) => {
    if (!raw) return 0;
    const first = String(raw).split(" ")[0];
    if (first.slice(-1) === "%") return (parseFloat(first) / 100) * Math.min(width, height);
    const parsed = parseFloat(first);
    return isNaN(parsed) ? 0 : parsed;
  };
  const labelOf = (element) => {
    const className = (element.getAttribute("class") || "").trim().split(/\\s+/).filter(Boolean).slice(0, 4).join(".");
    return (element.tagName.toLowerCase() + (className ? "." + className : "")).slice(0, 96);
  };
  const ownText = (element) => {
    let text = "";
    for (const node of element.childNodes) if (node.nodeType === 3) text += node.textContent;
    return text.replace(/\\s+/g, " ").trim().slice(0, 36);
  };
  // The page is the innermost full-bleed opaque fill. Cards never span the whole viewport.
  const pageBackgroundOf = () => {
    let found = null;
    const candidates = [root].concat(Array.from(root.querySelectorAll("*")).slice(0, 600));
    for (const candidate of candidates) {
      if (navigationRoot && navigationRoot.contains(candidate)) continue;
      const rect = candidate.getBoundingClientRect();
      if (rect.width < viewport.width - 1 || rect.height < viewport.height * 0.85) continue;
      const color = toRgba(getComputedStyle(candidate).backgroundColor);
      if (color && color.a >= 0.95) found = color;
    }
    if (found) return found;
    for (const candidate of [document.body, document.documentElement]) {
      const color = candidate ? toRgba(getComputedStyle(candidate).backgroundColor) : null;
      if (color && color.a >= 0.95) return color;
    }
    return null;
  };
  facts.pageBackground = pageBackgroundOf();

  const skipTags = { SCRIPT: 1, STYLE: 1, LINK: 1, META: 1, NOSCRIPT: 1, TEMPLATE: 1, HEAD: 1 };
  const all = root.querySelectorAll("*");
  for (let index = 0; index < all.length && facts.elements.length < MAX_ELEMENTS; index++) {
    const element = all[index];
    if (skipTags[element.tagName]) continue;
    if (element.closest("svg") && element.tagName.toLowerCase() !== "svg") continue;
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) < 0.05) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) continue;
    const radius = Math.max(
      cornerRadius(style.borderTopLeftRadius, rect.width, rect.height),
      cornerRadius(style.borderTopRightRadius, rect.width, rect.height),
      cornerRadius(style.borderBottomRightRadius, rect.width, rect.height),
      cornerRadius(style.borderBottomLeftRadius, rect.width, rect.height)
    );
    const borderWidths = [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth].map(parseFloat);
    const borderColor = toRgba(style.borderTopColor);
    const border = borderColor && style.borderTopStyle !== "none" ? Math.max.apply(null, borderWidths.map((value) => (isNaN(value) ? 0 : value))) : 0;
    const backgroundImage = style.backgroundImage || "none";
    facts.elements.push({
      tag: element.tagName.toLowerCase(),
      label: labelOf(element),
      text: ownText(element),
      x: Math.round(rect.left),
      y: Math.round(rect.top + window.scrollY),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      radius: Math.round(radius * 100) / 100,
      pill: radius >= Math.min(rect.width, rect.height) / 2 - 0.75,
      bg: toRgba(style.backgroundColor),
      gradient: /gradient\\(/i.test(backgroundImage),
      image: element.tagName === "IMG" || /url\\(/i.test(backgroundImage),
      border: border,
      shadow: style.boxShadow || "none",
      clips: style.overflow === "hidden" || style.overflowX === "hidden" || style.overflowY === "hidden",
      inNav: Boolean(navigationRoot && navigationRoot.contains(element)),
    });
  }

  const interactiveIn = (element) => Array.from(element.querySelectorAll("button, a, [role=tab], [role=button]"));
  const hasIcon = (element) => Boolean(element.querySelector("svg, i[data-lucide], [data-lucide]"));
  const seen = [];
  const pushLocal = (element, reason) => {
    for (const previous of seen) if (previous.contains(element) || element.contains(previous)) return;
    seen.push(element);
    facts.localNavigation.push({ label: labelOf(element), reason: reason, itemCount: interactiveIn(element).length });
  };
  for (const nav of root.querySelectorAll("nav")) {
    if (navigationRoot && navigationRoot.contains(nav)) continue;
    pushLocal(nav, "nav element");
  }
  for (const element of root.querySelectorAll("div, footer, section, aside, ul")) {
    if (navigationRoot && navigationRoot.contains(element)) continue;
    const style = getComputedStyle(element);
    if (style.position !== "fixed" && style.position !== "sticky" && style.position !== "absolute") continue;
    const rect = element.getBoundingClientRect();
    const nearBottom = style.position === "fixed" || style.position === "sticky"
      ? rect.bottom >= viewport.height - 48
      : rect.bottom + window.scrollY >= scrollHeight - 48;
    if (!nearBottom || rect.width < viewport.width * 0.55) continue;
    const controls = interactiveIn(element).filter(hasIcon);
    if (controls.length >= 3) pushLocal(element, "bottom bar with " + controls.length + " icon controls");
  }

  if (navigationRoot) {
    facts.sharedNavigation = {
      present: Boolean(navigationRoot.querySelector("[data-drawgle-primary-nav]")),
      itemCount: navigationRoot.querySelectorAll("[data-nav-item-id]").length,
    };
  }

  // What the screen pinned itself (the shared bar is the renderer's), and whether it lies over a control or text.
  // Full-screen layers are skipped: a texture or a scrim covers everything by design.
  const pinned = [];
  for (const element of root.querySelectorAll("*")) {
    if (navigationRoot && navigationRoot.contains(element)) continue;
    const style = getComputedStyle(element);
    if (style.position !== "fixed") continue;
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) < 0.05) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4 || rect.width * rect.height > viewport.width * viewport.height * 0.6) continue;
    if (pinned.some((outer) => outer.contains(element))) continue;
    pinned.push(element);
  }
  const overlapArea = (a, b) =>
    Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  // Controls, text, and filled surfaces such as cards; never a page-sized container.
  const isFilledSurface = (element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    if (rect.width * rect.height > viewport.width * viewport.height * 0.4) return false;
    return Boolean(toRgba(style.backgroundColor)) || (style.borderTopStyle !== "none" && parseFloat(style.borderTopWidth) > 0);
  };
  const coverTargets = Array.from(root.querySelectorAll("button, a, input, [role=button], h1, h2, h3, h4, p, li, span"))
    .concat(Array.from(root.querySelectorAll("div, section, article")).filter(isFilledSurface))
    .concat(navigationRoot ? Array.from(navigationRoot.querySelectorAll("button, a, [role=button], [data-nav-item-id]")) : []);
  facts.pinned = { count: pinned.length, covering: [] };
  for (const element of pinned) {
    const box = element.getBoundingClientRect();
    for (const target of coverTargets) {
      // The shared bar counts: a screen control lying over it is usually a second copy of the bar's own action.
      if (element.contains(target) || target.contains(element)) continue;
      if (pinned.some((other) => other.contains(target))) continue;
      const targetStyle = getComputedStyle(target);
      if (targetStyle.display === "none" || targetStyle.visibility === "hidden") continue;
      const targetBox = target.getBoundingClientRect();
      if (targetBox.width < 4 || targetBox.height < 4) continue;
      const smaller = Math.min(box.width * box.height, targetBox.width * targetBox.height);
      if (overlapArea(box, targetBox) >= smaller * 0.1) {
        const words = ownText(target);
        facts.pinned.covering.push({ label: labelOf(element), covers: labelOf(target) + (words ? " '" + words + "'" : "") });
        break;
      }
    }
  }

  const images = Array.from(root.querySelectorAll("img"));
  facts.assets = {
    slots: root.querySelectorAll("[data-asset-slot]").length,
    placeholders: root.querySelectorAll("[data-asset-placeholder='true']").length,
    images: images.length,
    brokenImages: images.filter((image) => image.complete && image.naturalWidth === 0).length,
  };
  return facts;
}`;

/** The expression to hand to page.evaluate: the probe called with no arguments. */
export const PROBE_EXPRESSION = `(${PROBE_SOURCE})()`;

// Shadow parsing lives in lib/shadow-css.ts, shared with the token calibration.
export { hasCastShadow, parseShadowLayers };

// ---------------------------------------------------------------------------
// Brief scanning
// ---------------------------------------------------------------------------

export type BriefValueScan = { px: number; hex: number; opacity: number; total: number; samples: string[] };

const BRIEF_PATTERNS = {
  px: /\b\d+(?:\.\d+)?\s?px\b/gi,
  hex: /(?<![\w&])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/gi,
  opacity: /\b\d+(?:\.\d+)?\s?%\s*(?:opacity|alpha|transparen\w*)|\bopacity\b[^.\n]{0,14}\d+(?:\.\d+)?\s?%|\brgba?\([^)]*\)/gi,
} as const;

/** Counts raw design values written into a brief: px sizes, hex colours and opacity percentages. */
export const scanBriefValues = (brief: string | null | undefined): BriefValueScan => {
  const text = brief ?? "";
  const samples: string[] = [];
  const counts = { px: 0, hex: 0, opacity: 0 };
  for (const kind of ["px", "hex", "opacity"] as const) {
    for (const match of text.matchAll(BRIEF_PATTERNS[kind])) {
      counts[kind] += 1;
      if (samples.length < 4) {
        const at = match.index ?? 0;
        samples.push(text.slice(Math.max(0, at - 18), at + match[0].length + 12).replace(/\s+/g, " ").trim());
      }
    }
  }
  return { ...counts, total: counts.px + counts.hex + counts.opacity, samples };
};

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

export type CheckContext = {
  screenName: string;
  /** The stored brief (screens.prompt). */
  brief: string;
  /** The elevation of the reference: flat-tone and hairline references expect no cast shadows. */
  elevation: ReferenceElevation;
  /** Measured reference colours, when known. Enables the card and page match. */
  expected?: { background?: string | null; card?: string | null } | null;
  /** Whether the project's shared navigation is enabled. */
  sharedNavigationEnabled: boolean;
  /** Whether the approved product flow describes persistent navigation. null when unknown. */
  flowHasNavigation: boolean | null;
  /** Whether this screen is a root destination (bottom-tabs or top-bar chrome). */
  isRoot: boolean;
  /** Whether the screen's chrome policy asks for the shared navigation. */
  showsSharedNavigation: boolean;
  /**
   * The project's own card radius (radii.app), in px. A project whose user asked for rounder cards, or whose reviewed
   * reference has them, has one above 24px, and a card at that radius is what was asked for, not an offender.
   */
  cardRadiusPx?: number | null;
};

export type ScreenCheckFlag =
  | "radius"
  | "shadow"
  | "tone"
  | "local-nav"
  | "no-shared-nav"
  | "placeholders"
  | "pinned"
  | "brief-values";

export type ScreenCheckResult = {
  screen: string;
  radius: { offenders: number; max: number; samples: string[] };
  shadows: { applicable: boolean; count: number; samples: string[] };
  tone: {
    page: string | null;
    card: string | null;
    cardVsPage: number | null;
    pageVsExpected: number | null;
    cardVsExpected: number | null;
    applicable: boolean;
  };
  localNavigation: { count: number; applicable: boolean; samples: string[] };
  sharedNavigation: { present: boolean; expected: boolean; missing: boolean };
  assets: { placeholders: number; slots: number; brokenImages: number; imageryInBrief: boolean };
  pinned: { count: number; covering: number; samples: string[] };
  brief: BriefValueScan;
  flags: ScreenCheckFlag[];
};

const IMAGERY_IN_BRIEF = /\b(?:photo|photograph|avatar|portrait|image|imagery|illustration|thumbnail|cover art|hero image)\b/i;

const toHex = (color: ProbeRgba | null) => (color ? rgbToHex([color.r, color.g, color.b]) : null);

const describeElement = (element: ProbeElement) =>
  `${element.label}${element.text ? ` “${element.text}”` : ""} ${element.width}×${element.height}`;

/** Elements that read as cards: sizeable, mostly opaque, rounded fills outside the navigation. */
export const isSurface = (element: ProbeElement) =>
  !element.inNav
  && element.bg !== null
  && element.bg.a >= 0.55
  && element.width >= SURFACE_MIN_WIDTH_PX
  && element.height >= SURFACE_MIN_HEIGHT_PX
  && element.radius >= 6
  && !element.image;

/**
 * The card colour: the neutral, light fill that covers the most area and is not
 * the page colour. Accent fills and dark controls are not cards.
 */
export const dominantCardColor = (elements: ProbeElement[], pageBackground: ProbeRgba | null) => {
  const pageLab = pageBackground ? rgbToLab([pageBackground.r, pageBackground.g, pageBackground.b]) : null;
  const areaByColor = new Map<string, number>();
  for (const element of elements) {
    if (!isSurface(element) || !element.bg) continue;
    const lab = rgbToLab([element.bg.r, element.bg.g, element.bg.b]);
    if (labChroma(lab) > 14 || lab[0] < 60) continue;
    if (pageLab && deltaE2000(lab, pageLab) < 0.8) continue;
    const hex = rgbToHex([element.bg.r, element.bg.g, element.bg.b]);
    areaByColor.set(hex, (areaByColor.get(hex) ?? 0) + element.width * element.height);
  }
  let best: string | null = null;
  let bestArea = 0;
  for (const [hex, area] of areaByColor) {
    if (area > bestArea) {
      best = hex;
      bestArea = area;
    }
  }
  return best;
};

const round = (value: number | null, digits = 1) => (value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits);

export const evaluateScreen = (facts: ProbeFacts, context: CheckContext): ScreenCheckResult => {
  const flags: ScreenCheckFlag[] = [];

  const radiusLimit = Math.max(MAX_CARD_RADIUS_PX, context.cardRadiusPx ?? 0);
  const radiusOffenders = facts.elements.filter((element) =>
    !element.inNav
    && element.radius > radiusLimit + 0.01
    && !element.pill
    && (element.bg !== null || element.border > 0 || element.clips || element.image));
  if (radiusOffenders.length) flags.push("radius");

  const flatReference = context.elevation === "flat-tone" || context.elevation === "hairline";
  const surfaces = facts.elements.filter(isSurface);
  const shadowed = surfaces.filter((element) => hasCastShadow(element.shadow));
  if (flatReference && shadowed.length) flags.push("shadow");

  const page = toHex(facts.pageBackground);
  const card = dominantCardColor(facts.elements, facts.pageBackground);
  const cardVsPage = page && card ? hexDeltaE(card, page) : null;
  const expectedCard = context.expected?.card ?? null;
  const expectedPage = context.expected?.background ?? null;
  const cardVsExpected = card && expectedCard ? hexDeltaE(card, expectedCard) : null;
  const pageVsExpected = page && expectedPage ? hexDeltaE(page, expectedPage) : null;
  const toneApplicable = cardVsExpected !== null || pageVsExpected !== null;
  if ((cardVsExpected !== null && cardVsExpected > TONE_MATCH_MAX_DELTA_E)
    || (pageVsExpected !== null && pageVsExpected > TONE_MATCH_MAX_DELTA_E)) {
    flags.push("tone");
  }

  const localNavApplicable = !context.sharedNavigationEnabled;
  if (localNavApplicable && facts.localNavigation.length) flags.push("local-nav");

  const navExpected = context.flowHasNavigation === true && context.isRoot;
  const navMissing = navExpected && !(facts.sharedNavigation.present && context.showsSharedNavigation);
  if (navMissing) flags.push("no-shared-nav");

  if (facts.assets.placeholders > 0) flags.push("placeholders");

  const covering = facts.pinned?.covering ?? [];
  if (covering.length) flags.push("pinned");

  const brief = scanBriefValues(context.brief);
  if (brief.total > 0) flags.push("brief-values");

  return {
    screen: context.screenName,
    radius: {
      offenders: radiusOffenders.length,
      max: radiusOffenders.reduce((max, element) => Math.max(max, Math.min(element.radius, 9999)), 0),
      samples: radiusOffenders
        .sort((a, b) => b.width * b.height - a.width * a.height)
        .slice(0, 3)
        .map((element) => `${describeElement(element)} r=${element.radius}`),
    },
    shadows: {
      applicable: flatReference,
      count: shadowed.length,
      samples: shadowed.slice(0, 3).map((element) => `${describeElement(element)} ${element.shadow.slice(0, 60)}`),
    },
    tone: {
      page,
      card,
      cardVsPage: round(cardVsPage),
      pageVsExpected: round(pageVsExpected),
      cardVsExpected: round(cardVsExpected),
      applicable: toneApplicable,
    },
    localNavigation: {
      count: facts.localNavigation.length,
      applicable: localNavApplicable,
      samples: facts.localNavigation.slice(0, 3).map((entry) => `${entry.label} (${entry.reason})`),
    },
    sharedNavigation: { present: facts.sharedNavigation.present, expected: navExpected, missing: navMissing },
    assets: {
      placeholders: facts.assets.placeholders,
      slots: facts.assets.slots,
      brokenImages: facts.assets.brokenImages,
      imageryInBrief: IMAGERY_IN_BRIEF.test(context.brief),
    },
    pinned: {
      count: facts.pinned?.count ?? 0,
      covering: covering.length,
      samples: covering.slice(0, 3).map((entry) => `${entry.label} covers ${entry.covers}`),
    },
    brief,
    flags,
  };
};

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

const cell = (value: string | number | null, failing: boolean) => {
  const text = value === null ? "-" : String(value);
  return failing ? `${text}!` : text;
};

export const CHECK_LEGEND = [
  `r>${MAX_CARD_RADIUS_PX}   elements with a corner radius over ${MAX_CARD_RADIUS_PX}px that are not pills or circles`,
  "shadow  cast box-shadows on cards; only counted when the reference is flat (- otherwise)",
  `card/page  ΔE between the card fill and the page (and to the measured reference when known; ! when over ${TONE_MATCH_MAX_DELTA_E})`,
  "local-nav  a <nav> or tab bar drawn inside a screen while shared navigation is disabled",
  "no-nav  a root screen without the shared navigation the approved flow describes",
  "asset ph  bitmap placeholders left in the screen",
  "pinned  controls the screen pinned itself (position: fixed) that lie over a button or text",
  "brief px/hex/%  raw px, hex and opacity values inside the stored brief",
].join("\n");

export const formatCheckTable = (results: ScreenCheckResult[]) => {
  const rows = results.map((result) => {
    const toneText = result.tone.cardVsPage === null
      ? "-"
      : `${result.tone.cardVsPage}${result.tone.cardVsExpected !== null || result.tone.pageVsExpected !== null
        ? ` (${result.tone.cardVsExpected ?? "-"}/${result.tone.pageVsExpected ?? "-"})`
        : ""}`;
    return [
      result.screen,
      cell(result.radius.offenders, result.flags.includes("radius")),
      result.shadows.applicable ? cell(result.shadows.count, result.flags.includes("shadow")) : "-",
      cell(toneText, result.flags.includes("tone")),
      result.localNavigation.applicable ? cell(result.localNavigation.count, result.flags.includes("local-nav")) : "-",
      result.sharedNavigation.expected ? cell(result.sharedNavigation.missing ? "missing" : "ok", result.sharedNavigation.missing) : "-",
      cell(result.assets.placeholders, result.flags.includes("placeholders")),
      cell(result.pinned.covering, result.flags.includes("pinned")),
      cell(`${result.brief.px}/${result.brief.hex}/${result.brief.opacity}`, result.flags.includes("brief-values")),
    ];
  });
  const header = ["screen", `r>${MAX_CARD_RADIUS_PX}`, "shadow", "card/page ΔE", "local-nav", "no-nav", "asset ph", "pinned", "brief px/hex/%"];
  const widths = header.map((title, column) => Math.max(title.length, ...rows.map((row) => row[column].length)));
  const line = (row: string[]) => row.map((value, column) => value.padEnd(widths[column])).join("  ").trimEnd();
  const flagged = results.filter((result) => result.flags.length).length;
  return [
    line(header),
    line(widths.map((width) => "-".repeat(width))),
    ...rows.map(line),
    "",
    `${results.length - flagged} of ${results.length} screens pass every applicable check.`,
    ...results.filter((result) => result.flags.length).map((result) => `  ${result.screen}: ${result.flags.join(", ")}`),
  ].join("\n");
};

export const formatCheckMarkdown = (title: string, results: ScreenCheckResult[]) => [
  `# ${title}`,
  "",
  "```text",
  formatCheckTable(results),
  "```",
  "",
  "## Legend",
  "",
  "```text",
  CHECK_LEGEND,
  "```",
  "",
  ...results.flatMap((result) => {
    const details = [
      ...result.radius.samples.map((sample) => `- radius: ${sample}`),
      ...result.shadows.samples.map((sample) => `- shadow: ${sample}`),
      ...result.localNavigation.samples.map((sample) => `- local navigation: ${sample}`),
      ...result.pinned.samples.map((sample) => `- pinned: ${sample}`),
      ...result.brief.samples.map((sample) => `- brief: “${sample}”`),
    ];
    return details.length ? [`### ${result.screen}`, "", ...details, ""] : [];
  }),
].join("\n");
