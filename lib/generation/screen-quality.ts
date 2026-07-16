import { load } from "cheerio";

import type { ScreenAssetManifest, ScreenPlan, ScreenStatus } from "@/lib/types";

export const REQUIRED_ANCHORS_LABEL = "Required screen anchors:";
export const DRAWGLE_GENERATION_COMPLETE_SENTINEL = "<!-- DRAWGLE_GENERATION_COMPLETE -->";

export type ScreenHealthStatus =
  | "healthy"
  | "incomplete"
  | "structurally_broken"
  | "missing_required_content";

export type StaticDrawgleHtmlDiagnosticCode =
  | "empty_code"
  | "jsx_leak"
  | "script_tag"
  | "duplicated_screen_fragment"
  | "duplicate_drawgle_ids"
  | "tag_imbalance"
  | "rendered_code_text";

export type SourceCompletionDiagnosticCode =
  | "missing_completion_sentinel"
  | "max_tokens_finish"
  | "trailing_open_tag"
  | "unclosed_comment"
  | "unterminated_raw_text";

export type StaticDrawgleHtmlSanitizationCode =
  | "script_tag"
  | "inline_event_handler"
  | "javascript_url";

const completionSentinelPattern = /<!--\s*DRAWGLE_GENERATION_COMPLETE\s*-->\s*$/i;

type HtmlParseError = {
  code: string;
  startLine?: number;
  startCol?: number;
  startOffset?: number;
};

const parseHtmlFragment = (code: string) => {
  const parseErrors: HtmlParseError[] = [];
  const $ = load(code, {
    onParseError: (error) => {
      parseErrors.push({
        code: error.code,
        startLine: error.startLine,
        startCol: error.startCol,
        startOffset: error.startOffset,
      });
    },
  }, false);

  return {
    $,
    parseErrors,
    code: ($.root().html() ?? "").trim(),
  };
};

const isIncompleteParseError = (error: HtmlParseError) => error.code.startsWith("eof-");

export function stripGenerationCompleteSentinel(code: string) {
  return code.replace(completionSentinelPattern, "").trim();
}

export function hasGenerationCompleteSentinel(code: string) {
  return completionSentinelPattern.test(code.trim());
}

export function validateSourceCompletion({
  code,
  requireSentinel = false,
  finishReasons = [],
}: {
  code: string;
  requireSentinel?: boolean;
  finishReasons?: string[];
}) {
  const trimmedCode = code.trim();
  const issues: string[] = [];
  const codes: SourceCompletionDiagnosticCode[] = [];
  const push = (code: SourceCompletionDiagnosticCode, issue: string) => {
    if (!codes.includes(code)) {
      codes.push(code);
      issues.push(issue);
    }
  };

  if (requireSentinel && !hasGenerationCompleteSentinel(trimmedCode)) {
    push(
      "missing_completion_sentinel",
      "Generated HTML did not include the Drawgle completion sentinel.",
    );
  }

  if (finishReasons.some((reason) => reason === "MAX_TOKENS" || /max[_\s-]?tokens|length/i.test(reason))) {
    push("max_tokens_finish", `Model generation stopped because of output length: ${finishReasons.join(", ")}.`);
  }

  const codeWithoutSentinel = stripGenerationCompleteSentinel(trimmedCode);

  if (/<[^>]*$/.test(codeWithoutSentinel)) {
    push("trailing_open_tag", "Generated HTML ends inside an unfinished tag.");
  }

  if (/<!--(?:(?!-->)[\s\S])*$/.test(codeWithoutSentinel)) {
    push("unclosed_comment", "Generated HTML ends inside an unfinished comment.");
  }

  const incompleteParseErrors = parseHtmlFragment(codeWithoutSentinel).parseErrors.filter(isIncompleteParseError);
  for (const error of incompleteParseErrors) {
    if (error.code === "eof-in-comment") {
      push("unclosed_comment", "Generated HTML ends inside an unfinished comment.");
    } else if (error.code === "eof-in-element-that-can-contain-only-text") {
      push("unterminated_raw_text", "Generated HTML ends inside an unfinished style or text element.");
    } else {
      push("trailing_open_tag", `Generated HTML ends in an unfinished parser state (${error.code}).`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    codes,
  };
}

const COMMON_ANCHOR_NOISE = new Set([
  "screen",
  "screens",
  "layout",
  "visual",
  "goal",
  "styling",
  "interaction",
  "notes",
  "components",
  "inside",
  "below",
  "above",
  "left",
  "right",
  "center",
  "top",
  "bottom",
  "create",
  "place",
  "insert",
  "include",
  "header",
  "back",
  "the",
  "each",
  "attached",
  "floating",
  "generic",
  "context",
  "text",
  "texts",
  "label",
  "labels",
  "icon",
  "icons",
  "e.g",
  "eg",
]);

const IMPLEMENTATION_ANCHOR_PATTERNS = [
  /\b(?:bg|text|border|shadow|rounded|p|m|px|py|pt|pb|gap|grid|flex|w|h|min|max|inset)-\[/i,
  /\b(?:rounded|shadow|bg|text|border|inset-shadow|drop-shadow|backdrop-blur|z)-/i,
  /\b(?:class|style|tailwind|css|html|div|section|header|footer|main|svg|path|lucide)\b/i,
];

const trimFillerLanguage = (value: string) =>
  value
    .replace(/[\u201c\u201d\u2018\u2019]/g, "'")
    .replace(/\b(?:generic|context|contexts|text|texts|label|labels)\b/gi, " ")
    .replace(/\b(?:icon|icons|button|buttons|card|cards|section|container|containers)\b/gi, " ")
    .replace(/\be\.?g\.?\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/&[a-z]+;/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/[^a-z0-9%+:.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const cleanAnchor = (value: string) => {
  const cleaned = trimFillerLanguage(value)
    .replace(/\s+/g, " ")
    .replace(/^[\s"'`.,:;()[\]{}<>-]+|[\s"'`.,:;()[\]{}<>-]+$/g, "")
    .trim();

  if (cleaned.length < 2 || cleaned.length > 48) {
    return null;
  }

  const normalized = normalize(cleaned);
  if (!normalized || COMMON_ANCHOR_NOISE.has(normalized)) {
    return null;
  }

  if (IMPLEMENTATION_ANCHOR_PATTERNS.some((pattern) => pattern.test(cleaned))) {
    return null;
  }

  const meaningfulWords = normalized.split(" ").filter((word) => word.length > 1 && !COMMON_ANCHOR_NOISE.has(word));
  if (meaningfulWords.length === 0 && !/\d/.test(cleaned)) {
    return null;
  }

  return cleaned;
};

const pushUnique = (anchors: string[], value: string | null) => {
  if (!value) return;
  const key = normalize(value);
  if (!key || anchors.some((anchor) => normalize(anchor) === key)) return;
  anchors.push(value);
};

export function extractRequiredAnchors(text: string, limit = 18) {
  const anchors: string[] = [];

  for (const match of text.matchAll(/["'\u201c\u201d\u2018\u2019]([^"'\u201c\u201d\u2018\u2019]{2,48})["'\u201c\u201d\u2018\u2019]/g)) {
    pushUnique(anchors, cleanAnchor(match[1]));
  }

  for (const match of text.matchAll(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:kcal|cal|kg|km|bpm|am|pm|%|l|m|mins?|minutes?|hours?|hrs?)\b/gi)) {
    pushUnique(anchors, cleanAnchor(match[0]));
  }

  return anchors.slice(0, limit);
}

export function appendRequiredAnchors(description: string, anchors: string[]) {
  const cleanedAnchors = anchors
    .map((anchor) => cleanAnchor(anchor))
    .filter((anchor): anchor is string => Boolean(anchor))
    .slice(0, 18);

  if (cleanedAnchors.length === 0 || description.includes(REQUIRED_ANCHORS_LABEL)) {
    return description;
  }

  return `${description.trim()}\n\n${REQUIRED_ANCHORS_LABEL} ${cleanedAnchors.join("; ")}`;
}

export function readRequiredAnchors(description: string) {
  const markerIndex = description.indexOf(REQUIRED_ANCHORS_LABEL);
  if (markerIndex < 0) {
    return [];
  }

  const anchorText = description.slice(markerIndex + REQUIRED_ANCHORS_LABEL.length).split(/\n/)[0] ?? "";
  return anchorText
    .split(";")
    .map((anchor) => cleanAnchor(anchor))
    .filter((anchor): anchor is string => Boolean(anchor))
    .slice(0, 18);
}

const anchorSatisfied = (normalizedCode: string, anchor: string) => {
  const normalizedAnchor = normalize(anchor);
  if (!normalizedAnchor) {
    return true;
  }

  if (normalizedCode.includes(normalizedAnchor)) {
    return true;
  }

  const words = normalizedAnchor.split(" ").filter((word) => word.length > 2);
  if (words.length <= 1) {
    return false;
  }

  return words.every((word) => normalizedCode.includes(word));
};

const pushDiagnostic = (
  issues: string[],
  codes: StaticDrawgleHtmlDiagnosticCode[],
  code: StaticDrawgleHtmlDiagnosticCode,
  issue: string,
) => {
  if (!codes.includes(code)) {
    codes.push(code);
  }
  issues.push(issue);
};

const addSanitizationCode = (
  codes: StaticDrawgleHtmlSanitizationCode[],
  code: StaticDrawgleHtmlSanitizationCode,
) => {
  if (!codes.includes(code)) {
    codes.push(code);
  }
};

export function sanitizeStaticDrawgleHtml(code: string) {
  let nextCode = code;
  const removedCodes: StaticDrawgleHtmlSanitizationCode[] = [];

  const replaceAndTrack = (pattern: RegExp, replacement: string, code: StaticDrawgleHtmlSanitizationCode) => {
    const replaced = nextCode.replace(pattern, replacement);
    if (replaced !== nextCode) {
      addSanitizationCode(removedCodes, code);
      nextCode = replaced;
    }
  };

  replaceAndTrack(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "", "script_tag");
  replaceAndTrack(/<script\b[^>]*\/?>/gi, "", "script_tag");
  replaceAndTrack(/\s+on[a-z][\w:-]*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+)/gi, "", "inline_event_handler");
  replaceAndTrack(/\s+(?:href|src|action|formaction|xlink:href)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*'|javascript:[^\s"'=<>`]+)/gi, "", "javascript_url");

  return {
    code: nextCode,
    changed: nextCode !== code,
    removedCodes,
  };
}

export function validateStaticDrawgleHtml({
  code,
  requireSingleScreenRoot = false,
}: {
  code: string;
  requireSingleScreenRoot?: boolean;
}) {
  const trimmedCode = code.trim();
  const issues: string[] = [];
  const codes: StaticDrawgleHtmlDiagnosticCode[] = [];

  if (!trimmedCode) {
    pushDiagnostic(issues, codes, "empty_code", "Screen code is empty.");
  }

  const jsxPatterns: Array<[RegExp, string]> = [
    [/\{\s*\[/, "Contains JSX array expression syntax."],
    [/\]\s*\.map\s*\(/, "Contains JSX .map(...) rendering syntax."],
    [/\)\s*=>\s*\(?\s*</, "Contains JSX arrow-rendering syntax."],
    [/\bclassName\s*=/, "Contains React className attribute."],
    [/\bclass\s*=\s*\{[^}]+\}/, "Contains JSX class expression."],
    [/\bstyle\s*=\s*\{\{[\s\S]*?\}\}/, "Contains JSX style object syntax."],
    [/\bdata-[\w-]+\s*=\s*\{[^}]+\}/, "Contains JSX attribute expression."],
    [/\{[a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)+\}/, "Contains JSX data interpolation syntax."],
    [/`[^`]*\$\{[^}]+\}[^`]*`/, "Contains JavaScript template literal syntax."],
  ];

  for (const [pattern, message] of jsxPatterns) {
    if (pattern.test(trimmedCode)) {
      pushDiagnostic(issues, codes, "jsx_leak", message);
      break;
    }
  }

  if (/<script\b/i.test(trimmedCode)) {
    pushDiagnostic(issues, codes, "script_tag", "Screen code contains a <script> tag.");
  }

  if (/\{\s*\[[\s\S]*?\]\s*\.map\s*\(|\{[a-zA-Z_$][\w$]*\.[a-zA-Z_$][\w$]*\}/.test(trimmedCode)) {
    pushDiagnostic(issues, codes, "rendered_code_text", "Screen code contains rendered JavaScript/JSX text.");
  }

  const screenRootMatches = trimmedCode.match(/<div\b[^>]*\bmin-h-screen\b/gi) ?? [];
  if (screenRootMatches.length > 1) {
    pushDiagnostic(
      issues,
      codes,
      "duplicated_screen_fragment",
      `Screen code contains ${screenRootMatches.length} min-h-screen root fragments.`,
    );
  }

  if (requireSingleScreenRoot && screenRootMatches.length === 0) {
    pushDiagnostic(issues, codes, "duplicated_screen_fragment", "Screen code is missing the expected min-h-screen root.");
  }

  const drawgleIds = Array.from(trimmedCode.matchAll(/\sdata-drawgle-id\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'=<>`]+))/g))
    .map((match) => match[1] ?? match[2] ?? match[3])
    .filter(Boolean);
  const seenIds = new Set<string>();
  const duplicateIds = new Set<string>();
  for (const id of drawgleIds) {
    if (seenIds.has(id)) {
      duplicateIds.add(id);
    }
    seenIds.add(id);
  }
  if (duplicateIds.size > 0) {
    pushDiagnostic(
      issues,
      codes,
      "duplicate_drawgle_ids",
      `Screen code contains duplicate data-drawgle-id values: ${Array.from(duplicateIds).slice(0, 8).join(", ")}.`,
    );
  }

  const parseErrors = parseHtmlFragment(trimmedCode).parseErrors.filter(isIncompleteParseError);
  if (parseErrors.length > 0) {
    pushDiagnostic(
      issues,
      codes,
      "tag_imbalance",
      `Screen code ends in an incomplete HTML parser state: ${Array.from(new Set(parseErrors.map((error) => error.code))).join(", ")}.`,
    );
  }

  const unrecoverable = codes.some((code) =>
    code === "empty_code" ||
    code === "jsx_leak" ||
    code === "script_tag" ||
    code === "duplicated_screen_fragment" ||
    code === "duplicate_drawgle_ids" ||
    code === "tag_imbalance",
  );

  return {
    valid: issues.length === 0,
    issues,
    codes,
    unrecoverable,
  };
}

export function validateGeneratedScreenCode({
  code,
  screenPlan,
}: {
  code: string;
  screenPlan: Pick<ScreenPlan, "name" | "description">;
}) {
  const issues: string[] = [];
  const warnings: string[] = [];
  const missingAnchors: string[] = [];
  const trimmedCode = code.trim();
  const staticValidation = validateStaticDrawgleHtml({ code, requireSingleScreenRoot: true });

  issues.push(...staticValidation.issues);

  if (screenPlan.description.length > 800 && trimmedCode.length < 1400) {
    warnings.push("Generated HTML is short for the detailed screen brief.");
  }

  if (/[…]|TODO|placeholder(?:\s+(?:content|copy|text))?|lorem ipsum|generic\s+(?:date|label|text|copy|content)|context\s+text|sample\s+text|dummy\s+copy/i.test(trimmedCode)) {
    warnings.push("Generated HTML contains placeholder-like or weak draft copy.");
  }

  const openDivs = (trimmedCode.match(/<div\b/gi) ?? []).length;
  const closeDivs = (trimmedCode.match(/<\/div>/gi) ?? []).length;
  if (Math.abs(openDivs - closeDivs) > 2) {
    issues.push(`Generated HTML looks structurally unbalanced (${openDivs} opening divs, ${closeDivs} closing divs).`);
  }

  const anchors = readRequiredAnchors(screenPlan.description);
  if (anchors.length > 0) {
    const normalizedCode = normalize(trimmedCode);
    for (const anchor of anchors) {
      if (!anchorSatisfied(normalizedCode, anchor)) {
        missingAnchors.push(anchor);
      }
    }
  }

  if (missingAnchors.length > 0) {
    warnings.push(`Missing brief anchors: ${missingAnchors.join(", ")}`);
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
    missingAnchors,
    staticValidation,
  };
}

const extractImageReferences = (code: string) => {
  const refs = new Map<string, "src" | "css-url">();

  for (const match of code.matchAll(/\ssrc\s*=\s*(?:"([^"]+)"|'([^']+)')/gi)) {
    const value = (match[1] ?? match[2] ?? "").trim();
    if (value) refs.set(value, "src");
  }

  for (const match of code.matchAll(/\ssrcset\s*=\s*(?:"([^"]+)"|'([^']+)')/gi)) {
    const value = (match[1] ?? match[2] ?? "").trim();
    for (const candidate of value.split(",")) {
      const url = candidate.trim().split(/\s+/)[0]?.trim();
      if (url) refs.set(url, "src");
    }
  }

  for (const match of code.matchAll(/<image\b[^>]*(?:\shref|\sxlink:href)\s*=\s*(?:"([^"]+)"|'([^']+)')/gi)) {
    const value = (match[1] ?? match[2] ?? "").trim();
    if (value) refs.set(value, "src");
  }

  for (const match of code.matchAll(/url\((?:"([^"]+)"|'([^']+)'|([^)"']+))\)/gi)) {
    const value = (match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (value) refs.set(value, "css-url");
  }

  return Array.from(refs.entries()).map(([url, kind]) => ({ url, kind }));
};

const isAllowedInlineSvg = (url: string) => /^data:image\/svg\+xml/i.test(url);

const assetPlaceholder = ($: ReturnType<typeof load>, element: Parameters<ReturnType<typeof load>>[0], asset?: ScreenAssetManifest) => {
  const $element = $(element);
  const replacement = $("<div></div>");
  for (const attribute of [
    "class",
    "style",
    "width",
    "height",
    "data-drawgle-id",
    "data-asset-requirement-id",
    "data-asset-slot-index",
  ]) {
    const value = $element.attr(attribute);
    if (value) replacement.attr(attribute, value);
  }
  replacement
    .attr("role", "img")
    .attr("aria-label", asset?.alt || $element.attr("alt") || "Image unavailable")
    .attr("data-asset-sanitized", "true")
    .attr("data-asset-role", asset?.role ?? "unknown")
    .addClass("bg-slate-100 border border-slate-200");
  if (asset?.role === "avatar" && asset.semanticCategory === "person") {
    replacement.text((asset.alt || "?").trim().charAt(0).toUpperCase());
  }
  $element.replaceWith(replacement);
};

const assetManifestByRequirement = (manifest: ScreenAssetManifest[]) => {
  const grouped = new Map<string, ScreenAssetManifest[]>();
  for (const asset of manifest) {
    grouped.set(asset.requirementId, [...(grouped.get(asset.requirementId) ?? []), asset]);
  }
  for (const assets of grouped.values()) {
    assets.sort((left, right) =>
      (left.slotIndex ?? 0) - (right.slotIndex ?? 0)
      || left.id.localeCompare(right.id));
  }
  return grouped;
};

const expectedRequirementUses = (assets: ScreenAssetManifest[]) => {
  const first = assets[0];
  if (!first) return 0;
  return first.reusePolicy === "repeat"
    ? Math.max(1, first.expectedUses)
    : Math.max(1, assets.length);
};

const placeholderLabel = (asset: ScreenAssetManifest) => {
  const label = asset.alt.trim();
  return label.length > 48 ? `${label.slice(0, 45).trim()}...` : label;
};

const applyAssetImageMetadata = (
  $image: ReturnType<ReturnType<typeof load>>,
  asset: ScreenAssetManifest,
) => {
  const styleWithoutAssetPositioning = ($image.attr("style") ?? "")
    .replace(/(?:^|;)\s*object-(?:fit|position)\s*:[^;]*/gi, "")
    .replace(/^;+|;+$/g, "")
    .trim();
  $image
    .attr("src", asset.variantUrl || asset.url || "")
    .attr("alt", asset.alt)
    .attr("width", String(asset.width))
    .attr("height", String(asset.height))
    .attr("data-asset-requirement-id", asset.requirementId)
    .attr("data-asset-role", asset.role)
    .attr("data-asset-id", asset.id)
    .attr("data-asset-provider", asset.provider)
    .attr("data-asset-source", asset.source)
    .attr("data-asset-fit", asset.objectFit)
    .attr("data-asset-position", asset.objectPosition)
    .attr("data-asset-critical", asset.critical ? "true" : "false")
    .attr("loading", asset.critical ? "eager" : "lazy")
    .attr("decoding", "async")
    .removeClass("object-contain object-cover")
    .addClass(`w-full h-full ${asset.objectFit === "contain" ? "object-contain" : "object-cover"}`)
    .attr(
      "style",
      `${styleWithoutAssetPositioning ? `${styleWithoutAssetPositioning}; ` : ""}object-fit: ${asset.objectFit}; object-position: ${asset.objectPosition};`,
    );
  if (asset.slotIndex == null) $image.removeAttr("data-asset-slot-index");
  else $image.attr("data-asset-slot-index", String(asset.slotIndex));
  for (const [attribute, value] of [
    ["data-asset-license", asset.license],
    ["data-asset-attribution", asset.attribution],
    ["data-asset-source-url", asset.sourceUrl],
  ] as const) {
    if (value) $image.attr(attribute, value);
    else $image.removeAttr(attribute);
  }
  return $image;
};

export function hydrateScreenAssetSlots({
  code,
  assetManifest = [],
}: {
  code: string;
  assetManifest?: ScreenAssetManifest[] | null;
}) {
  const manifest = assetManifest ?? [];
  const byRequirement = assetManifestByRequirement(manifest);
  const $ = load(code, {}, false);
  const usedDistinctAssetIds = new Set<string>();
  const outcomes: Record<string, {
    expected: number;
    slots: number;
    hydrated: number;
    placeholders: number;
  }> = {};
  let hydratedAssetCount = 0;
  let placeholderUseCount = 0;

  for (const [requirementId, assets] of byRequirement) {
    outcomes[requirementId] = {
      expected: expectedRequirementUses(assets),
      slots: 0,
      hydrated: 0,
      placeholders: 0,
    };
  }

  $("[data-asset-slot][data-asset-requirement-id]").each((_, element) => {
    const $slot = $(element);
    const requirementId = ($slot.attr("data-asset-requirement-id") ?? "").trim();
    const assets = byRequirement.get(requirementId) ?? [];
    if (assets.length === 0) return;

    const declaredRole = ($slot.attr("data-asset-role") ?? "").trim();
    const rawSlotIndex = ($slot.attr("data-asset-slot-index") ?? "").trim();
    const slotIndex = rawSlotIndex && /^\d+$/.test(rawSlotIndex)
      ? Number(rawSlotIndex)
      : null;
    const first = assets[0];
    const asset = first.reusePolicy === "distinct"
      ? (
          (slotIndex == null ? null : assets.find((candidate) => candidate.slotIndex === slotIndex))
          ?? assets.find((candidate) => !usedDistinctAssetIds.has(candidate.id))
          ?? null
        )
      : first;
    if (!asset) return;

    const outcome = outcomes[requirementId];
    outcome.slots += 1;
    $slot
      .attr("data-asset-role", asset.role)
      .attr("data-asset-slot-index", String(asset.slotIndex ?? slotIndex ?? 0));

    if (asset.placeholder || !asset.url) {
      const $placeholder = $slot.is("img, source, image")
        ? $("<div></div>")
            .attr("class", $slot.attr("class") ?? undefined)
            .attr("style", $slot.attr("style") ?? undefined)
            .attr("data-asset-slot", "true")
            .attr("data-asset-requirement-id", asset.requirementId)
            .attr("data-asset-role", asset.role)
            .attr("data-asset-slot-index", String(asset.slotIndex ?? slotIndex ?? 0))
        : $slot;
      if ($placeholder[0] !== $slot[0]) $slot.replaceWith($placeholder);
      $placeholder
        .empty()
        .attr("role", "img")
        .attr("aria-label", asset.alt || "Image unavailable")
        .attr("data-asset-provider", asset.provider)
        .attr("data-asset-source", asset.source)
        .attr("data-asset-placeholder", "true")
        .addClass("bg-slate-100 border border-slate-200 flex items-center justify-center text-center");
      const label = placeholderLabel(asset);
      if (asset.role === "avatar" && asset.semanticCategory === "person") {
        $placeholder.text(label.charAt(0).toUpperCase() || "?");
      } else {
        $placeholder.append(
          $("<span></span>")
            .addClass("px-3 text-xs text-slate-500")
            .text(label || "Image unavailable"),
        );
      }
      placeholderUseCount += 1;
      outcome.placeholders += 1;
      return;
    }

    const useExistingImageSlot = $slot.is("img");
    const replaceNonContainerSlot = $slot.is("source, image");
    const $image = applyAssetImageMetadata(useExistingImageSlot ? $slot : $("<img>"), {
      ...asset,
      slotIndex: asset.slotIndex ?? slotIndex ?? 0,
    });

    if (useExistingImageSlot) {
      $image
        .removeAttr("data-asset-slot")
        .removeAttr("role")
        .removeAttr("aria-label")
        .removeAttr("data-asset-placeholder")
        .attr("data-asset-hydrated", "true");
    } else if (replaceNonContainerSlot) {
      $image.attr("data-asset-hydrated", "true");
      $slot.replaceWith($image);
    } else {
      $slot
        .empty()
        .removeAttr("role")
        .removeAttr("aria-label")
        .removeAttr("data-asset-placeholder")
        .attr("data-asset-hydrated", "true")
        .append($image);
    }
    hydratedAssetCount += 1;
    outcome.hydrated += 1;
    if (asset.reusePolicy === "distinct") usedDistinctAssetIds.add(asset.id);
    if (declaredRole && declaredRole !== asset.role) {
      $slot.attr("data-asset-role-repaired-from", declaredRole);
    }
  });

  const missingCriticalSlotIds = Array.from(byRequirement.entries())
    .filter(([, assets]) => assets.some((asset) => asset.critical))
    .filter(([requirementId, assets]) => {
      const directUses = $(
        `img[data-asset-requirement-id="${requirementId}"], `
        + `svg image[data-asset-requirement-id="${requirementId}"], `
        + `[style*='url('][data-asset-requirement-id="${requirementId}"]`,
      ).filter((_, element) => $(element).closest("[data-asset-slot]").length === 0).length;
      return (outcomes[requirementId]?.slots ?? 0) + directUses < expectedRequirementUses(assets);
    })
    .map(([requirementId]) => requirementId);

  return {
    code: $.html(),
    changed: hydratedAssetCount > 0 || placeholderUseCount > 0,
    hydratedAssetCount,
    placeholderUseCount,
    missingCriticalSlotIds,
    outcomes,
  };
}

export function sanitizeScreenAssetUsage({
  code,
  assetManifest = [],
}: {
  code: string;
  assetManifest?: ScreenAssetManifest[] | null;
}) {
  const manifest = assetManifest ?? [];
  const byRequirement = assetManifestByRequirement(manifest);
  const allowedByUrl = new Map<string, ScreenAssetManifest[]>();
  for (const asset of manifest) {
    for (const url of [asset.url, asset.variantUrl]) {
      if (!url) continue;
      allowedByUrl.set(url, [...(allowedByUrl.get(url) ?? []), asset]);
    }
  }

  const $ = load(code, {}, false);
  const warnings: string[] = [];
  const invalidUrls: string[] = [];
  const roleMismatches: string[] = [];
  const missingMetadata: string[] = [];
  const distinctUrlUses = new Map<string, number>();
  let sanitizedMisuseCount = 0;
  let repairedMetadataCount = 0;

  $("img").each((_, element) => {
    const $image = $(element);
    const src = ($image.attr("src") ?? "").trim();
    if (!src || isAllowedInlineSvg(src)) return;
    const candidates = allowedByUrl.get(src) ?? [];
    const requirementId = ($image.attr("data-asset-requirement-id") ?? "").trim();
    const declaredRole = ($image.attr("data-asset-role") ?? "").trim();
    const matchedCandidate = candidates.find((candidate) => candidate.requirementId === requirementId);
    const requirementAssets = requirementId ? byRequirement.get(requirementId) ?? [] : [];
    const asset = matchedCandidate
      ?? (requirementAssets.length === 1 ? requirementAssets[0] : candidates.length === 1 ? candidates[0] : undefined);
    const context = [$image.attr("class"), $image.attr("id"), $image.attr("alt")]
      .concat($image.parents().slice(0, 3).map((__, parent) => `${$(parent).attr("class") ?? ""} ${$(parent).attr("id") ?? ""}`).get())
      .filter(Boolean)
      .join(" ");
    const avatarContext = /\b(avatar|author|headshot|member|profile|user)\b/i.test(context);
    const invalid = candidates.length === 0;
    const metadataMissing = !requirementId || !declaredRole;
    const hardRoleMismatch = Boolean(asset && avatarContext && asset.role !== "avatar");
    const repairable = Boolean(!invalid && candidates.length === 1 && asset && !hardRoleMismatch);

    if (repairable && asset) {
      const beforeRepair = $image.toString();
      applyAssetImageMetadata($image, asset);
      const metadataChanged = beforeRepair !== $image.toString();
      if (metadataChanged) {
        repairedMetadataCount += 1;
      }
      const distinctReuse = asset.reusePolicy === "distinct" && (distinctUrlUses.get(src) ?? 0) > 0;
      if (!distinctReuse) {
        if (asset.reusePolicy === "distinct") {
          distinctUrlUses.set(src, (distinctUrlUses.get(src) ?? 0) + 1);
        }
        return;
      }
    }

    const roleMismatch = Boolean(asset && (declaredRole !== asset.role || hardRoleMismatch));
    const requirementMismatch = Boolean(requirementId && !matchedCandidate);
    const distinctReuse = Boolean(asset?.reusePolicy === "distinct" && (distinctUrlUses.get(src) ?? 0) > 0);

    if (!invalid && !metadataMissing && !roleMismatch && !requirementMismatch && !distinctReuse) {
      if (asset?.reusePolicy === "distinct") distinctUrlUses.set(src, (distinctUrlUses.get(src) ?? 0) + 1);
      return;
    }
    sanitizedMisuseCount += 1;
    if (invalid) invalidUrls.push(src);
    if (metadataMissing) missingMetadata.push(src);
    if (roleMismatch || requirementMismatch || distinctReuse) roleMismatches.push(`${requirementId || "unknown"}:${declaredRole || "unknown"}`);
    assetPlaceholder($, element, asset ?? candidates[0]);
  });

  $("svg image").each((_, element) => {
    const $image = $(element);
    const url = ($image.attr("href") ?? $image.attr("xlink:href") ?? "").trim();
    if (!url || isAllowedInlineSvg(url)) return;
    const requirementId = ($image.attr("data-asset-requirement-id") ?? "").trim();
    const declaredRole = ($image.attr("data-asset-role") ?? "").trim();
    const candidate = (allowedByUrl.get(url) ?? []).find((asset) => asset.requirementId === requirementId);
    if (candidate && declaredRole === candidate.role) return;
    sanitizedMisuseCount += 1;
    if (!(allowedByUrl.get(url) ?? []).length) invalidUrls.push(url);
    if (!requirementId || !declaredRole) missingMetadata.push(url);
    else roleMismatches.push(`${requirementId}:${declaredRole}`);
    $image.removeAttr("href").removeAttr("xlink:href").attr("data-asset-sanitized", "true");
  });

  $("source[srcset]").each((_, element) => {
    const $source = $(element);
    const urls = ($source.attr("srcset") ?? "").split(",").map((candidate) => candidate.trim().split(/\s+/)[0]).filter(Boolean);
    const requirementId = ($source.attr("data-asset-requirement-id") ?? "").trim();
    const declaredRole = ($source.attr("data-asset-role") ?? "").trim();
    const valid = urls.length > 0 && urls.every((url) =>
      (allowedByUrl.get(url) ?? []).some((asset) => asset.requirementId === requirementId && asset.role === declaredRole));
    if (valid) return;
    sanitizedMisuseCount += 1;
    for (const url of urls) if (!(allowedByUrl.get(url) ?? []).length) invalidUrls.push(url);
    if (!requirementId || !declaredRole) missingMetadata.push(...urls);
    else roleMismatches.push(`${requirementId}:${declaredRole}`);
    $source.removeAttr("srcset").attr("data-asset-sanitized", "true");
  });

  $("[style]").each((_, element) => {
    const $element = $(element);
    const requirementId = ($element.attr("data-asset-requirement-id") ?? "").trim();
    const declaredRole = ($element.attr("data-asset-role") ?? "").trim();
    const style = $element.attr("style") ?? "";
    const sanitized = style.replace(/url\((?:"([^"]+)"|'([^']+)'|([^)'\"]+))\)/gi, (match, doubleQuoted, singleQuoted, bare) => {
      const url = String(doubleQuoted ?? singleQuoted ?? bare ?? "").trim();
      if (!url || isAllowedInlineSvg(url)) return match;
      const assets = allowedByUrl.get(url) ?? [];
      const uniqueAsset = assets.length === 1 ? assets[0] : null;
      const matchedAsset = assets.find((asset) =>
        asset.requirementId === requirementId && asset.role === declaredRole);
      const asset = matchedAsset ?? uniqueAsset;
      const allowedBackground = Boolean(
        asset && (asset.role === "background_photo" || asset.role === "map_texture"),
      );
      if (allowedBackground && asset) {
        if (requirementId !== asset.requirementId || declaredRole !== asset.role) {
          $element
            .attr("data-asset-requirement-id", asset.requirementId)
            .attr("data-asset-role", asset.role)
            .attr("data-asset-id", asset.id);
          repairedMetadataCount += 1;
        }
        return match;
      }
      sanitizedMisuseCount += 1;
      if (assets.length === 0) invalidUrls.push(url);
      else if (!requirementId || !declaredRole) missingMetadata.push(url);
      else roleMismatches.push(`${requirementId}:${declaredRole}:css-background`);
      return "none";
    });
    if (sanitized !== style) $element.attr("style", sanitized);
  });

  $("style").each((_, element) => {
    const $style = $(element);
    const css = $style.html() ?? "";
    const sanitized = css.replace(/url\((?:"([^"]+)"|'([^']+)'|([^)'"]+))\)/gi, (match, doubleQuoted, singleQuoted, bare) => {
      const url = String(doubleQuoted ?? singleQuoted ?? bare ?? "").trim();
      if (!url || isAllowedInlineSvg(url) || !isBitmapLikeUrl(url, "css-url")) return match;
      sanitizedMisuseCount += 1;
      if (!(allowedByUrl.get(url) ?? []).length) invalidUrls.push(url);
      else missingMetadata.push(url);
      return "none";
    });
    if (sanitized !== css) $style.html(sanitized);
  });

  if (invalidUrls.length) warnings.push(`Sanitized ${new Set(invalidUrls).size} unapproved bitmap URL(s).`);
  if (roleMismatches.length) warnings.push(`Sanitized ${roleMismatches.length} bitmap role or requirement mismatch(es).`);
  if (missingMetadata.length) warnings.push(`Sanitized ${missingMetadata.length} bitmap element(s) without asset requirement metadata.`);

  return {
    code: $.html(),
    changed: sanitizedMisuseCount > 0 || repairedMetadataCount > 0,
    sanitizedMisuseCount,
    repairedMetadataCount,
    warnings,
    invalidUrls: Array.from(new Set(invalidUrls)),
    roleMismatches,
    missingMetadata,
  };
}

/**
 * Parse and serialize generated markup with the same HTML5 recovery rules used
 * by browsers. This closes ordinary omitted tags and removes stray closing tags
 * without another model call. Lexically truncated tags/comments remain blocked
 * by validateSourceCompletion before this function is used.
 */
export function normalizeStaticDrawgleHtml(code: string) {
  const sourceCode = code.trim();
  const parsed = parseHtmlFragment(sourceCode);
  const incompleteParseErrors = parsed.parseErrors.filter(isIncompleteParseError);

  return {
    code: parsed.code,
    changed: parsed.code !== sourceCode,
    valid: incompleteParseErrors.length === 0 && parsed.code.length > 0,
    parseErrors: parsed.parseErrors.map((error) => error.code),
    incompleteParseErrors: incompleteParseErrors.map((error) => error.code),
  };
}

const isBitmapLikeUrl = (url: string, kind: "src" | "css-url") => {
  if (isAllowedInlineSvg(url) || url.startsWith("#") || /^var\(/i.test(url)) {
    return false;
  }

  if (kind === "src") {
    return true;
  }

  return /^https?:\/\//i.test(url) ||
    /^data:image\//i.test(url) ||
    /^blob:/i.test(url) ||
    /^\/(?!\/)/.test(url) ||
    /^\.\.?\//.test(url) ||
    /\.(png|jpe?g|webp|gif|avif|bmp|svg)(?:[?#].*)?$/i.test(url);
};

export function validateScreenAssetPolicy({
  code,
  assetManifest = [],
}: {
  code: string;
  assetManifest?: ScreenAssetManifest[] | null;
}) {
  const manifest = assetManifest ?? [];
  const allowedUrls = new Set(
    manifest
      .flatMap((asset) => [asset.url, asset.variantUrl])
      .filter((url): url is string => typeof url === "string" && url.trim().length > 0),
  );
  const imageRefs = extractImageReferences(code);
  const $ = load(code, {}, false);
  const usesByRequirement = new Map<string, number>();
  $("img[data-asset-requirement-id], svg image[data-asset-requirement-id], source[data-asset-requirement-id], [style*='url('][data-asset-requirement-id], [data-asset-placeholder='true'][data-asset-requirement-id]").each((_, element) => {
    const requirementId = ($(element).attr("data-asset-requirement-id") ?? "").trim();
    if (requirementId) usesByRequirement.set(requirementId, (usesByRequirement.get(requirementId) ?? 0) + 1);
  });
  const usedUrls = new Set(imageRefs.map((ref) => ref.url));
  const usedApprovedUrls = Array.from(usedUrls).filter((url) => allowedUrls.has(url));
  const ignoredResolvedAssetIds = manifest
    .filter((asset) => !asset.placeholder && asset.url && !usedUrls.has(asset.url))
    .map((asset) => asset.id);
  const placeholderUseCount = $("[data-asset-placeholder='true'][data-asset-requirement-id]").length;
  const invalidUrls = imageRefs.map((ref) => ref.url).filter((url, index, urls) => {
    const ref = imageRefs.find((candidate) => candidate.url === url);
    if (!ref || urls.indexOf(url) !== index) return false;
    if (allowedUrls.has(url)) return false;
    if (/^data:image\/svg\+xml/i.test(url)) return false;
    return isBitmapLikeUrl(url, ref.kind);
  });
  const missingRequiredUrls = manifest
    .filter((asset) =>
      asset.critical &&
      !asset.placeholder &&
      Boolean(asset.url) &&
      (!usedUrls.has(asset.url as string) || (usesByRequirement.get(asset.requirementId) ?? 0) === 0)
    )
    .map((asset) => asset.url)
    .filter((url): url is string => Boolean(url));
  const missingCriticalSlotIds = Array.from(assetManifestByRequirement(manifest).entries())
    .filter(([, assets]) => assets.some((asset) => asset.critical))
    .filter(([requirementId, assets]) =>
      (usesByRequirement.get(requirementId) ?? 0) < expectedRequirementUses(assets))
    .map(([requirementId]) => requirementId);

  const warnings = invalidUrls.map((url) => `Generated screen used unapproved external image URL: ${url}`);
  for (const asset of manifest) {
    if (asset.placeholder || asset.expectedUses <= 1) continue;
    const actualUses = usesByRequirement.get(asset.requirementId) ?? 0;
    if (actualUses < asset.expectedUses) {
      warnings.push(`Asset requirement ${asset.requirementId} expected ${asset.expectedUses} compatible uses but generated ${actualUses}.`);
    }
  }
  const distinctRequirements = new Set(manifest.filter((asset) => asset.reusePolicy === "distinct").map((asset) => asset.requirementId));
  for (const requirementId of distinctRequirements) {
    const requiredUrls = new Set(manifest.filter((asset) => asset.requirementId === requirementId && asset.url).map((asset) => asset.url));
    const actualUrls = new Set(Array.from(requiredUrls).filter((url) => usedUrls.has(url as string)));
    if (actualUrls.size < requiredUrls.size) {
      warnings.push(`Distinct asset requirement ${requirementId} used ${actualUrls.size} of ${requiredUrls.size} resolved identities.`);
    }
  }
  const blocking = missingRequiredUrls.length > 0 || missingCriticalSlotIds.length > 0;

  return {
    valid: !blocking,
    blocking,
    warnings,
    invalidUrls,
    missingRequiredUrls,
    missingCriticalSlotIds,
    usedApprovedUrls,
    ignoredResolvedAssetIds,
    resolvedAssetUseCount: usedApprovedUrls.length,
    placeholderUseCount,
    usesByRequirement: Object.fromEntries(usesByRequirement),
  };
}

export function detectScreenHealth({
  code,
  screenPrompt,
}: {
  code: string;
  screenPrompt: string;
}) {
  const validation = validateGeneratedScreenCode({
    code,
    screenPlan: {
      name: "Screen",
      description: screenPrompt,
    },
  });
  const trimmedCode = code.trim();
  const issues = [...validation.issues];
  const warnings = [...validation.warnings];
  const staticValidation = validateStaticDrawgleHtml({ code, requireSingleScreenRoot: true });

  if (/class=["'][^"']*\bmin-h-screen\b[^"']*\boverflow-hidden\b/i.test(trimmedCode) && trimmedCode.length > 5000) {
    warnings.push("Outermost screen wrapper may clip required lower content with overflow-hidden.");
  }

  let status: ScreenHealthStatus = "healthy";
  if (staticValidation.unrecoverable || issues.some((issue) => /unbalanced|imbalance|structurally/i.test(issue))) {
    status = "structurally_broken";
  } else if (issues.length > 0) {
    status = "incomplete";
  } else if (validation.missingAnchors.length > 0) {
    status = "missing_required_content";
  }

  return {
    status,
    healthy: status === "healthy",
    issues,
    warnings,
    missingAnchors: validation.missingAnchors,
    staticValidation,
  };
}

export type ScreenHealthResult = ReturnType<typeof detectScreenHealth>;

export function isBlockingScreenHealthFailure(health: ScreenHealthResult) {
  return (
    health.status === "structurally_broken" ||
    health.status === "incomplete" ||
    health.staticValidation.unrecoverable ||
    health.staticValidation.codes.length > 0
  );
}

export function screenStatusForHealth(health: ScreenHealthResult): ScreenStatus {
  return isBlockingScreenHealthFailure(health) ? "failed" : "ready";
}

export function buildScreenHealthError(health: ScreenHealthResult) {
  if (!isBlockingScreenHealthFailure(health)) {
    return null;
  }

  const staticCodes = health.staticValidation.codes.length > 0
    ? ` [static_html:${health.staticValidation.codes.join(",")}]`
    : "";
  return `[screen_health:${health.status}]${staticCodes} ${health.issues.join(" | ")}`;
}
